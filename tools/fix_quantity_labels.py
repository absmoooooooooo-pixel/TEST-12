#!/usr/bin/env python3
"""Give every language a real piece-count label and localize the static result.

    python tools/fix_quantity_labels.py            # report only
    python tools/fix_quantity_labels.py --write

The shared engine writes "1 pc" / "3 pcs" into #resultQuantity and the i18n
runtime swaps the unit through strings.pc / strings.pcs. Eight dictionaries
still mapped those to the English identity, and the initial HTML kept an
English "1 pc" or a Chinese "0.000000 Ton" placeholder.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

PC = {
    "hi": ("पीस", "पीस"),
    "mr": ("नग", "नग"),
    "zh": ("件", "件"),
    "ja": ("個", "個"),
    "ar": ("قطعة", "قطعة"),
    "de": ("Stück", "Stück"),
    "es": ("pieza", "piezas"),
    "fr": ("pièce", "pièces"),
    "pt": ("peça", "peças"),
}

# Static initial values that must not stay English.
STATIC_FIXES = {
    "zh": [("0.000000 Ton", "0.000000 吨")],
}

QUANTITY = re.compile(r'(id="resultQuantity"[^>]*>)([^<]*)(<)')


def write_json(path: Path, data: dict) -> None:
    with path.open("r", encoding="utf-8", newline="") as handle:
        crlf = "\r\n" in handle.read()
    text = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    if crlf:
        text = text.replace("\r\n", "\n").replace("\n", "\r\n")
    with path.open("w", encoding="utf-8", newline="") as handle:
        handle.write(text)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()

    dict_changes = 0
    page_changes = 0

    for lang, (singular, plural) in PC.items():
        path = ROOT / "frontend/i18n" / lang / f"{lang}.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        strings = data.setdefault("strings", {})
        if strings.get("pc") != singular or strings.get("pcs") != plural:
            strings["pc"] = singular
            strings["pcs"] = plural
            dict_changes += 1
            if args.write:
                write_json(path, data)

        for page in sorted((ROOT / lang).glob("**/index.html")):
            with page.open("r", encoding="utf-8", newline="") as handle:
                source = handle.read()
            original = source

            def replace_quantity(match: re.Match[str]) -> str:
                current = match.group(2).strip()
                if not re.fullmatch(r"1 (pc|pcs)", current):
                    return match.group(0)
                unit = singular if current.endswith("pc") else plural
                return f"{match.group(1)}1 {unit}{match.group(3)}"

            source = QUANTITY.sub(replace_quantity, source)
            for old, new in STATIC_FIXES.get(lang, []):
                source = source.replace(f">{old}<", f">{new}<")
            if source != original:
                page_changes += 1
                if args.write:
                    with page.open("w", encoding="utf-8", newline="") as handle:
                        handle.write(source)

    action = "updated" if args.write else "would update"
    print(f"{action}: {dict_changes} dictionary/dictionaries, {page_changes} page(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
