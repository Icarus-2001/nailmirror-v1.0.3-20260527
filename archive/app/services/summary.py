"""运营数据汇总（dashboard summary / 日报生成共用）。"""

from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models import ExternalTrend, Style, TryOnLog


def build_summary_data(db: Session, now: datetime | None = None) -> dict:
    now = now or datetime.utcnow()
    seven_days_ago = now - timedelta(days=7)
    fourteen_days_ago = now - timedelta(days=14)

    active_styles = db.query(Style).filter(Style.is_active.is_(True)).all()
    try_counts: dict[int, int] = {}
    last_tried: dict[int, datetime | None] = {}

    for style in active_styles:
        logs_q = db.query(TryOnLog).filter(TryOnLog.style_id == style.id)
        try_counts[style.id] = logs_q.filter(TryOnLog.tried_at >= seven_days_ago).count()
        last_log = logs_q.order_by(TryOnLog.tried_at.desc()).first()
        last_tried[style.id] = last_log.tried_at if last_log else None

    hot_sorted = sorted(active_styles, key=lambda s: try_counts[s.id], reverse=True)[:5]
    hot_styles = [
        {
            "style_id": s.id,
            "name": s.name,
            "color": s.color,
            "design": s.design,
            "shape": s.shape,
            "style": s.style,
            "try_count_7d": try_counts[s.id],
        }
        for s in hot_sorted
    ]

    cold_styles = []
    for s in active_styles:
        if try_counts[s.id] != 0:
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
        "cold_styles": cold_styles,
        "external_hot": {
            "xiaohongshu": _top_trends("xiaohongshu"),
            "douyin": _top_trends("douyin"),
        },
    }
