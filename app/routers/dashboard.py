from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ExternalTrend, Style, TryOnLog
from app.schemas import HotStyleOut

router = APIRouter()


def _compute_growth_rate(try_count_3d: int, try_count_prev_3d: int) -> float:
    if try_count_prev_3d == 0 and try_count_3d > 0:
        return round(try_count_3d * 100.0, 1)
    rate = (try_count_3d - try_count_prev_3d) / max(try_count_prev_3d, 1) * 100
    return round(rate, 1)


def _build_dashboard_summary(db: Session) -> dict:
    now = datetime.utcnow()
    three_days_ago = now - timedelta(days=3)
    six_days_ago = now - timedelta(days=6)
    seven_days_ago = now - timedelta(days=7)
    fourteen_days_ago = now - timedelta(days=14)

    active_styles = db.query(Style).filter(Style.is_active.is_(True)).all()
    style_ids = [s.id for s in active_styles]

    logs_by_style: dict[int, list] = {sid: [] for sid in style_ids}
    if style_ids:
        for log in db.query(TryOnLog).filter(TryOnLog.style_id.in_(style_ids)).all():
            logs_by_style[log.style_id].append(log.tried_at)

    try_counts_7d: dict[int, int] = {}
    try_counts_3d: dict[int, int] = {}
    try_counts_prev_3d: dict[int, int] = {}
    last_tried: dict[int, datetime | None] = {}

    for style in active_styles:
        tried_at_list = logs_by_style[style.id]
        try_counts_7d[style.id] = sum(1 for t in tried_at_list if t >= seven_days_ago)
        try_counts_3d[style.id] = sum(1 for t in tried_at_list if t >= three_days_ago)
        try_counts_prev_3d[style.id] = sum(
            1 for t in tried_at_list if six_days_ago <= t < three_days_ago
        )
        last_tried[style.id] = max(tried_at_list) if tried_at_list else None

    hot_sorted = sorted(active_styles, key=lambda s: try_counts_7d[s.id], reverse=True)[:5]
    hot_styles = []
    for s in hot_sorted:
        tc3 = try_counts_3d[s.id]
        tc_prev3 = try_counts_prev_3d[s.id]
        hot_styles.append(
            {
                "style_id": s.id,
                "name": s.name,
                "color": s.color,
                "design": s.design,
                "shape": s.shape,
                "style": s.style,
                "try_count_7d": try_counts_7d[s.id],
                "try_count_3d": tc3,
                "try_count_prev_3d": tc_prev3,
                "growth_rate": _compute_growth_rate(tc3, tc_prev3),
            }
        )

    trending_candidates = []
    for s in active_styles:
        tc3 = try_counts_3d[s.id]
        tc_prev3 = try_counts_prev_3d[s.id]
        growth = _compute_growth_rate(tc3, tc_prev3)
        if tc3 >= 3 and growth >= 50.0:
            trending_candidates.append(
                {
                    "style_id": s.id,
                    "name": s.name,
                    "color": s.color,
                    "design": s.design,
                    "shape": s.shape,
                    "style": s.style,
                    "try_count_3d": tc3,
                    "try_count_prev_3d": tc_prev3,
                    "growth_rate": growth,
                    "trend_signal": "rapidly_rising" if growth >= 200 else "rising",
                }
            )
    trending_up = sorted(trending_candidates, key=lambda x: x["growth_rate"], reverse=True)[:5]

    cold_styles = []
    for s in active_styles:
        if try_counts_7d[s.id] != 0:
            continue
        last_at = last_tried[s.id]
        cold_styles.append(
            {
                "style_id": s.id,
                "name": s.name,
                "design": s.design,
                "color": s.color,
                "try_count_7d": 0,
                "last_tried_at": last_at.isoformat() if last_at else None,
            }
        )
    cold_styles.sort(key=lambda x: x["style_id"])

    trends = (
        db.query(ExternalTrend)
        .filter(ExternalTrend.posted_at.isnot(None))
        .filter(ExternalTrend.posted_at >= fourteen_days_ago)
        .all()
    )

    def _top_trends(platform: str) -> list[dict]:
        platform_trends = [t for t in trends if t.platform == platform]
        platform_trends.sort(key=lambda t: t.engagement or 0, reverse=True)
        return [
            {
                "design": t.design,
                "color": t.color,
                "shape": t.shape,
                "engagement": t.engagement,
                "posted_at": t.posted_at.isoformat() if t.posted_at else None,
            }
            for t in platform_trends[:3]
        ]

    return {
        "snapshot_time": now.isoformat(),
        "hot_styles": hot_styles,
        "trending_up": trending_up,
        "cold_styles": cold_styles,
        "external_hot": {
            "xiaohongshu": _top_trends("xiaohongshu"),
            "douyin": _top_trends("douyin"),
        },
    }

EXPECTED_TABLES = {
    "styles",
    "users",
    "try_on_logs",
    "favorites",
    "external_trends",
    "daily_reports",
    "operation_logs",
}


@router.get("/summary")
def dashboard_summary(db: Session = Depends(get_db)):
    """运营数据快照：热款、上升趋势、冷款、外部趋势。"""
    return _build_dashboard_summary(db)


@router.get("/hot", response_model=List[HotStyleOut])
def hot_styles(db: Session = Depends(get_db)):
    """按试戴次数取 Top5 爆款款式。"""
    rows = (
        db.query(
            Style.id.label("style_id"),
            Style.name,
            Style.color,
            Style.design,
            Style.shape,
            Style.style,
            Style.image_url,
            Style.rank_weight,
            func.count(TryOnLog.id).label("try_count"),
        )
        .join(TryOnLog, TryOnLog.style_id == Style.id)
        .group_by(Style.id)
        .order_by(func.count(TryOnLog.id).desc())
        .limit(5)
        .all()
    )
    return [HotStyleOut.model_validate(dict(row._mapping)) for row in rows]


@router.get("/tables")
def list_tables(db: Session = Depends(get_db)):
    """验收用：列出已创建的 SQLite 表"""
    rows = db.execute(
        text(
            "SELECT name FROM sqlite_master "
            "WHERE type='table' AND name NOT LIKE 'sqlite_%' "
            "ORDER BY name"
        )
    ).fetchall()
    tables = [row[0] for row in rows]
    missing = sorted(EXPECTED_TABLES - set(tables))
    return {
        "count": len(tables),
        "tables": tables,
        "expected": sorted(EXPECTED_TABLES),
        "all_created": len(missing) == 0,
        "missing": missing,
    }
