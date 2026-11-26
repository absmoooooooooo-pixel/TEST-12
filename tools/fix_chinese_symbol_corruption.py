#!/usr/bin/env python3
"""Repair Chinese strings where a standalone dimension symbol was substituted
into a product name or prose (L Channel -> 长 槽钢, T Channel -> 翼缘厚 槽钢).
"""
from __future__ import annotations

import json
from pathlib import Path

PATH = Path(__file__).resolve().parents[1] / "frontend/i18n/zh/zh.json"

REPLACEMENTS = {
    "长 型槽钢": "L 型槽钢",
    "长 槽钢": "L 型槽钢",
    "翼缘厚 型钢": "T 型钢",
    "翼缘厚 槽钢": "T 型槽钢",
    "全长 长 作为": "全长 L 作为",
    "全长 长 显示": "全长 L 显示",
}


def fix(value: str) -> str:
    for old, new in REPLACEMENTS.items():
        value = value.replace(old, new)
    return value


def main() -> None:
    data = json.loads(PATH.read_text(encoding="utf-8"))
    changed = 0
    for section in ("terms", "strings"):
        for key, value in list(data[section].items()):
            if not isinstance(value, str):
                continue
            fixed = fix(value)
            if fixed != value:
                data[section][key] = fixed
                changed += 1
    PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"chinese symbol corruption fixes: {changed}")


if __name__ == "__main__":
    main()
