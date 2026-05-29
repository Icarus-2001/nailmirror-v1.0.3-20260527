"""
种子数据脚本：下载款式图 + 写入 styles / users / try_on_logs / external_trends。
用法：在项目根目录执行  python seed.py
"""

from __future__ import annotations

import random
import sys
from datetime import datetime, timedelta
from pathlib import Path

import httpx
from sqlalchemy import text

from app.database import SessionLocal, engine
from app.models import Base, ExternalTrend, Style, TryOnLog, User

ROOT = Path(__file__).resolve().parent
STATIC_STYLES_DIR = ROOT / "static" / "styles"

IMAGE_URLS = [
    "http://p0.meituan.net/pilotimages/87797733466cfd525625a5947767e2ff1794125.png",
    "http://p0.meituan.net/pilotimages/162afb52255bd908ba3ec418fd61824a2254875.png",
    "http://p1.meituan.net/pilotimages/7bb5bc0c2c741f9f0aa63787a601d7ad2604877.png",
    "http://p0.meituan.net/pilotimages/fc8fe60e78341d77a5070fc2f8e520072098070.png",
    "http://p1.meituan.net/pilotimages/3c0d090e20f0cb56f70fcb56c54dd6582416974.png",
    "http://p0.meituan.net/pilotimages/6c857edd85a5fa4bcec59698fe9416cb1913981.png",
    "http://p0.meituan.net/pilotimages/2ac2d01a9bc78320edbe2b545b485b4a2132292.png",
    "http://p1.meituan.net/pilotimages/d15c06e8c2137d4f39f3b60476a90cf92026957.png",
    "http://p1.meituan.net/pilotimages/69614397f0ecb559b98cb46a5a46f3b32642714.png",
    "http://p1.meituan.net/pilotimages/2277d6f9d82264fa6a3c986373e5e44c2292083.png",
    "http://p0.meituan.net/pilotimages/bc153edf655dd6961dc9f8e95ad8cd1e2561531.png",
    "http://p0.meituan.net/pilotimages/43cc4ced977a3dd271f60ee2f05607772681747.png",
    "http://p0.meituan.net/pilotimages/682c173ae3a95d0b838655e8337b30d72213857.png",
    "http://p1.meituan.net/pilotimages/eecfba4ab276e895b579a79491b2d0211982788.png",
    "http://p0.meituan.net/pilotimages/1248ad42d355b98257e5fbcdf90efc552138079.png",
    "http://p0.meituan.net/pilotimages/137aad1f6a36655ae395cf7dc57604642782680.png",
    "http://p0.meituan.net/pilotimages/ec437f6291295904c2f894edb8c01cb82131722.png",
    "http://p0.meituan.net/pilotimages/5591229138c4e7e1d183b59be442d9dc2267735.png",
    "http://p0.meituan.net/pilotimages/5fad21e6d38656170bf726ff3973a4501918338.png",
    "http://p1.meituan.net/pilotimages/d5eedc75b0021f79381962fc145b0bc62301165.png",
    "http://p0.meituan.net/pilotimages/f4b69d45af5d3b496adbd9d21e768a8e2195181.png",
    "http://p0.meituan.net/pilotimages/5b985a1c661ae2e964286178e6c0b0f92258113.png",
    "http://p1.meituan.net/pilotimages/bf8657d94693fb0fe1da3f7729d5667d2020119.png",
    "http://p0.meituan.net/pilotimages/e80e1d25e48d7ef5c505b29ee8e331822641412.png",
    "http://p1.meituan.net/pilotimages/73ee568aa09547d8bfc0168113ac9ebc2712329.png",
]

DOWNLOAD_HEADERS = {
    "Referer": "https://www.meituan.com/",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
}

COLORS = ["冰透粉", "大地色", "奶白色", "豆沙色", "法式白", "焦糖色"]
DESIGNS = ["纯色", "法式", "渐变", "猫眼", "魔镜粉", "镶钻", "碎钻", "手绘"]
SHAPES = ["杏仁形", "方形", "圆形", "梯形", "椭圆形", "长尖形"]
STYLES = ["日常通勤", "酷飒个性", "甜美少女", "中式典雅", "创意小众"]

HOT_COLORS = ["冰透粉", "奶白色"]
HOT_DESIGNS = ["猫眼", "法式"]
HOT_SHAPES = ["杏仁形", "椭圆形"]

random.seed(42)


def _pick(candidates: list[str], index: int) -> str:
    """按序号对列表长度取模循环分配。"""
    return candidates[index % len(candidates)]


def download_images() -> tuple[int, int, list[str | None]]:
    STATIC_STYLES_DIR.mkdir(parents=True, exist_ok=True)
    success = 0
    failed = 0
    image_paths: list[str | None] = [None] * len(IMAGE_URLS)

    with httpx.Client(headers=DOWNLOAD_HEADERS, timeout=30.0, follow_redirects=True) as client:
        for i, url in enumerate(IMAGE_URLS, start=1):
            dest = STATIC_STYLES_DIR / f"style_{i}.png"
            try:
                resp = client.get(url)
                resp.raise_for_status()
                dest.write_bytes(resp.content)
                image_paths[i - 1] = f"/static/styles/style_{i}.png"
                success += 1
            except Exception as exc:
                failed += 1
                print(f"[警告] 图片 style_{i}.png 下载失败: {exc}", file=sys.stderr)

    return success, failed, image_paths


def seed_styles(db, image_paths: list[str | None]) -> tuple[int, str | None]:
    if db.query(Style).count() > 0:
        print("  styles 表已有数据，跳过")
        return db.query(Style).count(), None
    try:
        for i in range(1, 26):
            idx = i - 1
            db.add(
                Style(
                    name=f"款式{i:03d}",
                    color=_pick(COLORS, idx),
                    design=_pick(DESIGNS, idx),
                    shape=_pick(SHAPES, idx),
                    style=_pick(STYLES, idx),
                    image_url=image_paths[idx],
                    rank_weight=1.0,
                    is_active=True,
                )
            )
        db.commit()
        return 25, None
    except Exception as exc:
        db.rollback()
        return 0, str(exc)


def seed_users(db) -> tuple[int, str | None]:
    if db.query(User).count() > 0:
        print("  users 表已有数据，跳过")
        return db.query(User).count(), None
    try:
        now = datetime.utcnow()
        users = [
            User(
                nickname="测试用户A",
                is_member=True,
                member_expires_at=now + timedelta(days=90),
            ),
            User(nickname="测试用户B", is_member=False),
            User(nickname="测试用户C", is_member=False),
            User(nickname="测试用户D", is_member=False),
            User(nickname="测试用户E", is_member=False),
        ]
        db.add_all(users)
        db.commit()
        return 5, None
    except Exception as exc:
        db.rollback()
        return 0, str(exc)


def _random_dt_in_last_days(days: int) -> datetime:
    now = datetime.utcnow()
    start = now - timedelta(days=days)
    delta = now - start
    return start + timedelta(seconds=random.randint(0, int(delta.total_seconds())))


def _random_dt_between_days_ago(min_days: int, max_days: int) -> datetime:
    now = datetime.utcnow()
    start = now - timedelta(days=max_days)
    end = now - timedelta(days=min_days)
    span = end - start
    return start + timedelta(seconds=random.randint(0, max(1, int(span.total_seconds()))))


def seed_try_on_logs(db) -> tuple[int, str | None]:
    if db.query(TryOnLog).count() > 0:
        print("  try_on_logs 表已有数据，跳过")
        return db.query(TryOnLog).count(), None
    try:
        logs: list[TryOnLog] = []

        for style_id in range(1, 6):
            count = random.randint(80, 120)
            for _ in range(count):
                logs.append(
                    TryOnLog(
                        style_id=style_id,
                        user_id=random.randint(1, 5),
                        tried_at=_random_dt_in_last_days(7),
                    )
                )

        for style_id in range(6, 16):
            count = random.randint(15, 35)
            for _ in range(count):
                logs.append(
                    TryOnLog(
                        style_id=style_id,
                        user_id=random.randint(1, 5),
                        tried_at=_random_dt_in_last_days(14),
                    )
                )

        for style_id in range(16, 21):
            count = random.randint(1, 3)
            for _ in range(count):
                logs.append(
                    TryOnLog(
                        style_id=style_id,
                        user_id=random.randint(1, 5),
                        tried_at=_random_dt_between_days_ago(15, 30),
                    )
                )

        db.add_all(logs)
        db.commit()
        return len(logs), None
    except Exception as exc:
        db.rollback()
        return 0, str(exc)


def seed_external_trends(db) -> tuple[int, str | None]:
    try:
        db.execute(text("DELETE FROM external_trends"))
        db.commit()

        trends: list[ExternalTrend] = []
        now = datetime.utcnow()

        for i in range(1, 11):
            scraped = now - timedelta(
                days=random.randint(0, 2),
                hours=random.randint(0, 23),
                minutes=random.randint(0, 59),
            )
            trends.append(
                ExternalTrend(
                    platform=random.choice(["xiaohongshu", "douyin"]),
                    post_url=f"https://mock.xiaohongshu.com/post/trend_{i:03d}",
                    engagement=random.randint(5000, 20000),
                    color=random.choice(HOT_COLORS),
                    design=random.choice(HOT_DESIGNS),
                    shape=random.choice(HOT_SHAPES),
                    posted_at=_random_dt_between_days_ago(1, 5),
                    scraped_at=scraped,
                )
            )

        for i in range(11, 31):
            idx = i - 1
            scraped = now - timedelta(
                days=random.randint(0, 2),
                hours=random.randint(0, 23),
                minutes=random.randint(0, 59),
            )
            trends.append(
                ExternalTrend(
                    platform=random.choice(["xiaohongshu", "douyin"]),
                    post_url=f"https://mock.xiaohongshu.com/post/trend_{i:03d}",
                    engagement=random.randint(200, 2000),
                    color=_pick(COLORS, idx),
                    design=_pick(DESIGNS, idx),
                    shape=_pick(SHAPES, idx),
                    style=_pick(STYLES, idx),
                    posted_at=_random_dt_between_days_ago(7, 13),
                    scraped_at=scraped,
                )
            )

        db.add_all(trends)
        db.commit()
        return 30, None
    except Exception as exc:
        db.rollback()
        return 0, str(exc)


def _fmt(count: int, expected: int, err: str | None) -> str:
    if err:
        return f"失败，错误原因：{err}"
    if count == expected:
        return f"已插入 {count} 条"
    return f"已插入 {count} 条（预期 {expected} 条）"


def main() -> None:
    Base.metadata.create_all(bind=engine)

    img_ok, img_fail, image_paths = download_images()

    db = SessionLocal()
    try:
        styles_n, styles_err = seed_styles(db, image_paths)
        users_n, users_err = seed_users(db)
        logs_n, logs_err = seed_try_on_logs(db)
        trends_n, trends_err = seed_external_trends(db)
    finally:
        db.close()

    print("========== 种子数据汇总 ==========")
    print(f"  图片下载：{img_ok} 成功 / {img_fail} 失败")
    print(f"  styles 表：{_fmt(styles_n, 25, styles_err)}")
    print(f"  users 表：{_fmt(users_n, 5, users_err)}")
    print(f"  try_on_logs 表：{_fmt(logs_n, -1, logs_err) if logs_err else f'已插入约 {logs_n} 条'}")
    print(f"  external_trends 表：{_fmt(trends_n, 30, trends_err)}")


if __name__ == "__main__":
    main()
