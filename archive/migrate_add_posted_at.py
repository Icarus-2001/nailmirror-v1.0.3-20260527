"""
为 external_trends 表新增 posted_at 列并清空旧数据。
用法：在项目根目录执行  python migrate_add_posted_at.py
"""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "nail_ops.db"


def main() -> None:
    conn = sqlite3.connect(DB_PATH)
    try:
        try:
            conn.execute("ALTER TABLE external_trends ADD COLUMN posted_at DATETIME")
            conn.commit()
            print("已添加列 posted_at")
        except sqlite3.OperationalError as exc:
            if "duplicate column name" in str(exc).lower():
                print("列已存在，跳过")
            else:
                raise

        conn.execute("DELETE FROM external_trends")
        conn.commit()
        print("Migration 完成，external_trends 已清空，等待重新 seed")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
