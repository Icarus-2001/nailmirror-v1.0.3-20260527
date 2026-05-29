"""Moonshot LLM 日报与策略生成。"""

from __future__ import annotations

import json
import os
import re
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv()

MOONSHOT_API_KEY = os.getenv("MOONSHOT_API_KEY", "")
MOONSHOT_BASE_URL = os.getenv("MOONSHOT_BASE_URL", "https://api.moonshot.cn/v1")
MOONSHOT_MODEL = os.getenv("MOONSHOT_MODEL", "moonshot-v1-8k")

SYSTEM_PROMPT = """你是美甲门店AI运营助手，具备商业分析能力。
根据提供的运营数据，生成日报和调权策略。
严格按指定格式输出，不得有任何多余文字。"""

USER_PROMPT_TEMPLATE = """当前运营数据（{snapshot_time}）：

【近7天热门款式TOP5】
{hot_lines}

【近7天无人试戴的款式】
{cold_lines}

【外部社区趋势（近14天）】
{external_lines}

请严格按以下格式输出：

===日报开始===
（Markdown格式日报，150-250字，包含：
  1. 热款概况：TOP3款式及试戴量
  2. 趋势简析：外部社区与店内热款是否有重叠的图案/颜色
  3. 风险提示：列出需关注的冷款
  4. 建议：2条可操作的运营建议）
===日报结束===

===策略开始===
{{
  "boosts": [
    {{"style_id": int, "new_weight": float, "reason": "str"}}
  ],
  "demotes": [
    {{"style_id": int, "new_weight": float, "reason": "str"}}
  ],
  "alerts": [
    {{"style_id": int, "reason": "str"}}
  ]
}}
===策略结束===

策略规则：
- boosts：从热门款式中选择表现最好的款式，new_weight设在2.0~5.0之间，
  热度越高设得越高，最多选3款
- demotes：从冷款中选try_count_7d=0且last_tried_at超过14天（或从未试戴）的款式，
  new_weight统一设为0.5，最多选3款
- alerts：冷款列表中所有款式都列入
- style_id必须是真实存在的整数，new_weight必须是浮点数
"""


def _format_hot_lines(hot_styles: list[dict]) -> str:
    lines = []
    for item in hot_styles:
        lines.append(
            f"款式{item['style_id']}「{item['name']}」"
            f"{item.get('design') or ''}/{item.get('color') or ''} "
            f"近7天试戴:{item['try_count_7d']}次"
        )
    return "\n".join(lines) if lines else "（无）"


def _format_cold_lines(cold_styles: list[dict]) -> str:
    lines = []
    for item in cold_styles:
        last = item.get("last_tried_at") or "从未试戴"
        lines.append(
            f"款式{item['style_id']}「{item['name']}」"
            f"{item.get('design') or ''}/{item.get('color') or ''} "
            f"近7天0次 上次试戴:{last}"
        )
    return "\n".join(lines) if lines else "（无）"


def _format_external_lines(external_hot: dict) -> str:
    lines = []
    for platform in ("xiaohongshu", "douyin"):
        label = "小红书" if platform == "xiaohongshu" else "抖音"
        for item in external_hot.get(platform, []):
            lines.append(
                f"{label} {item.get('design') or ''}/{item.get('color') or ''} "
                f"互动量:{item.get('engagement', 0)}"
            )
    return "\n".join(lines) if lines else "（无）"


def _build_user_prompt(summary_data: dict) -> str:
    return USER_PROMPT_TEMPLATE.format(
        snapshot_time=summary_data.get("snapshot_time", ""),
        hot_lines=_format_hot_lines(summary_data.get("hot_styles", [])),
        cold_lines=_format_cold_lines(summary_data.get("cold_styles", [])),
        external_lines=_format_external_lines(summary_data.get("external_hot", {})),
    )


def _parse_llm_response(text: str) -> tuple[str, dict]:
    report_match = re.search(
        r"===日报开始===\s*(.*?)\s*===日报结束===",
        text,
        re.DOTALL,
    )
    strategy_match = re.search(
        r"===策略开始===\s*(.*?)\s*===策略结束===",
        text,
        re.DOTALL,
    )

    content_md = report_match.group(1).strip() if report_match else text.strip()

    strategy_json: dict[str, Any] = {
        "boosts": [],
        "demotes": [],
        "alerts": [],
        "parse_error": True,
    }
    if strategy_match:
        raw_json = strategy_match.group(1).strip()
        try:
            strategy_json = json.loads(raw_json)
        except json.JSONDecodeError:
            pass

    return content_md, strategy_json


def generate_daily_report(summary_data: dict) -> dict:
    """调用 Moonshot 生成日报与调权策略。"""
    if not MOONSHOT_API_KEY:
        raise RuntimeError("MOONSHOT_API_KEY 未配置")

    user_prompt = _build_user_prompt(summary_data)
    url = f"{MOONSHOT_BASE_URL.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {MOONSHOT_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": MOONSHOT_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.3,
    }

    with httpx.Client(timeout=60.0) as client:
        resp = client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()

    content = data["choices"][0]["message"]["content"]
    content_md, strategy_json = _parse_llm_response(content)
    return {"content_md": content_md, "strategy_json": strategy_json}
