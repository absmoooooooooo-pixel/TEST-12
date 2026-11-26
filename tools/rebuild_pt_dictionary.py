#!/usr/bin/env python3
"""Regenerate only the Portuguese browser dictionary from pt.json.

This avoids running build_i18n.py, which would also rewrite the English
master pages and every other language dictionary.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CODE = "pt"


def main() -> None:
    source = ROOT / "frontend" / "i18n" / CODE / f"{CODE}.json"
    data = json.loads(source.read_text(encoding="utf-8"))
    payload = {
        "code": CODE,
        "terms": data.get("terms", {}),
        "strings": data.get("strings", {}),
        "templates": data.get("templates", {}),
        "technical": data.get("technical", {}),
    }
    text = (
        f"/* Language dictionary: {CODE} - generated, do not edit. */\n"
        "window.MW_I18N_DICTIONARIES = window.MW_I18N_DICTIONARIES || {};\n"
        f"window.MW_I18N_DICTIONARIES[{json.dumps(CODE)}]="
        + json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        + ";\n"
    )
    output = ROOT / "frontend" / "i18n" / CODE / f"dict-{CODE}.js"
    output.write_text(text, encoding="utf-8", newline="\n")
    print(f"wrote {output.relative_to(ROOT).as_posix()}")


if __name__ == "__main__":
    main()
