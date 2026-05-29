import json
from datetime import date, datetime

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import DailyReport, OperationLog, Style
from app.services import llm
from app.services.summary import build_summary_data

router = APIRouter()


def _report_to_dict(report: DailyReport) -> dict:
    strategy = {}
    if report.strategy_json:
        try:
            strategy = json.loads(report.strategy_json)
        except json.JSONDecodeError:
            strategy = {"parse_error": True}
    return {
        "id": report.id,
        "report_date": report.report_date.isoformat() if report.report_date else None,
        "content_md": report.content_md,
        "strategy_json": strategy,
        "status": report.status,
        "created_at": report.created_at.isoformat() if report.created_at else None,
    }


@router.post("/generate")
def generate_report(db: Session = Depends(get_db)):
    """生成今日运营日报与调权策略。"""
    today = date.today()
    existing = (
        db.query(DailyReport)
        .filter(DailyReport.report_date == today)
        .filter(DailyReport.status != "rejected")
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail={"error": "今日日报已存在", "report_id": existing.id},
        )

    summary_data = build_summary_data(db)

    try:
        result = llm.generate_daily_report(summary_data)
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="LLM 请求超时") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=504, detail=f"LLM 请求失败: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=504, detail=f"LLM 生成失败: {exc}") from exc

    rejected = (
        db.query(DailyReport)
        .filter(DailyReport.report_date == today)
        .filter(DailyReport.status == "rejected")
        .first()
    )
    if rejected:
        rejected.content_md = result["content_md"]
        rejected.strategy_json = json.dumps(result["strategy_json"], ensure_ascii=False)
        rejected.status = "pending"
        rejected.created_at = datetime.utcnow()
        report = rejected
    else:
        report = DailyReport(
            report_date=today,
            content_md=result["content_md"],
            strategy_json=json.dumps(result["strategy_json"], ensure_ascii=False),
            status="pending",
        )
        db.add(report)
    db.commit()
    db.refresh(report)
    return _report_to_dict(report)


@router.post("/{report_id}/execute")
def execute_report(report_id: int, db: Session = Depends(get_db)):
    """执行日报中的调权策略。"""
    report = db.query(DailyReport).filter(DailyReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="日报不存在")

    if report.status == "executed":
        raise HTTPException(status_code=409, detail={"error": "已执行过"})

    try:
        strategy = json.loads(report.strategy_json or "{}")
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="strategy_json 解析失败") from exc

    changes: list[dict] = []
    for section in ("boosts", "demotes"):
        for item in strategy.get(section, []):
            style_id = item.get("style_id")
            new_weight = item.get("new_weight")
            if style_id is None or new_weight is None:
                continue

            style = (
                db.query(Style)
                .filter(Style.id == style_id, Style.is_active.is_(True))
                .first()
            )
            if not style:
                continue

            weight_before = style.rank_weight
            style.rank_weight = float(new_weight)
            db.add(
                OperationLog(
                    report_id=report.id,
                    style_id=style_id,
                    weight_before=weight_before,
                    weight_after=float(new_weight),
                    source="auto",
                    executed_at=datetime.utcnow(),
                )
            )
            changes.append(
                {
                    "style_id": style_id,
                    "old": weight_before,
                    "new": float(new_weight),
                }
            )

    report.status = "executed"
    db.commit()

    return {"executed": True, "changes": changes}
