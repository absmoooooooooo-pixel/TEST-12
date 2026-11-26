#!/usr/bin/env python3
"""Compare the numbers in every localized string with its English source.

    python tools/audit_numbers.py [--top N] [--lang mr]

A translation may reword a sentence freely, but the figures it quotes must stay
the same. Every page carries a "localized text -> English source" map, so the
numeric tokens of each pair can be compared directly. Formatted thousands
separators are normalised (1,963.495 and 1963.495 are the same number) and the
comparison only reports pairs whose number sets actually differ.
"""
from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAP = re.compile(r'id="mw-i18n-sources">(.*?)</script>', re.S)
NUMBER = re.compile(r"\d+")
# Separators between digits are locale formatting, not value: 1,000,000 /
# 1.000.000 / 1 000 000 and 7.85 / 7,85 all collapse to their digits.
SEPARATOR = re.compile(r"(?<=\d)[.,\u00a0\u202f ](?=\d)")
# A localized page may legitimately write a number in its own digits; they are
# normalised to ASCII before comparing.
DIGITS = {
    **{ord(c): str(i) for i, c in enumerate("०१२३४५६७८९")},
    **{ord(c): str(i) for i, c in enumerate("٠١٢٣٤٥٦٧٨٩")},
    **{ord(c): str(i) for i, c in enumerate("۰۱۲۳۴۵۶۷۸۹")},
    **{ord(c): str(i) for i, c in enumerate("０１２３４５６７８９")},
}


def numbers(text: str) -> Counter:
    text = SEPARATOR.sub("", text.translate(DIGITS))
    return Counter(NUMBER.findall(text))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lang", action="append", help="limit to one language code")
    parser.add_argument("--top", type=int, default=4, help="examples per language")
    parser.add_argument("--show", action="store_true", help="print every mismatch")
    args = parser.parse_args()

    languages = args.lang
    if not languages:
        languages = sorted(
            p.name for p in ROOT.iterdir() if (p / "index.html").exists() and p.name.isalpha()
        )
        languages = [code for code in languages if code != "frontend"]

    total = 0
    for code in languages:
        mismatches: list[tuple[str, str, str, str, list[str]]] = []
        pages = sorted((ROOT / code).glob("**/index.html"))
        for page in pages:
            match = MAP.search(page.read_text(encoding="utf-8"))
            if not match:
                continue
            try:
                data = json.loads(match.group(1))
            except json.JSONDecodeError:
                continue
            for section in ("text", "attrs"):
                for key, value in (data.get(section) or {}).items():
                    if not isinstance(value, str):
                        continue
                    # Only figures the source does not contain are wrong; a
                    # localized string may be shorter than a truncated source.
                    extra = numbers(key) - numbers(value)
                    if not extra:
                        continue
                    mismatches.append(
                        (page.as_posix(), key.strip(), value.strip(), section, sorted(extra))
                    )

        total += len(mismatches)
        print(f"[{code}] {len(mismatches)} number mismatch(es) over {len(pages)} pages")
        shown = mismatches if args.show else mismatches[: args.top]
        for path, key, value, section, extra in shown:
            print(f"   {path} [{section}] extra numbers: {extra}")
            print(f"     LOCAL: {key[:180]}")
            print(f"     EN   : {value[:180]}")
    print(f"total mismatches: {total}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
