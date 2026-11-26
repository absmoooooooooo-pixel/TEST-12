#!/usr/bin/env python3
"""Remove copy from another calculator that a translation pass prepended.

    python tools/fix_faq_contamination.py [--write]

Two localized pages carry a paragraph that belongs to a different calculator in
front of correct copy: Hindi flange-plate repeats hexagon-bar text inside an FAQ
question, and German sphere-ball opens an FAQ answer with dish-end text. Both the
visible markup and the "localized text -> English source" map have to agree, so
the leading paragraph is stripped from the key as well.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAP = re.compile(r'(<script type="application/json" id="mw-i18n-sources">)(.*?)(</script>)', re.S)

# (page, foreign prefix that must be removed, text the element should read)
REPAIRS = [
    (
        "hi/calculators/flange-plate/index.html",
        "हॉट-रोल्ड हेक्सागोनल बार क्रॉस-फ्लैट आकार पर माइनस टॉलरेंस के लिए निर्मित होते हैं",
        "बोल्ट छिद्र बोर और बाहरी किनारे के कितने करीब हो सकते हैं?",
        # the question itself ended the corrupted string, so the replacement
        # text is the question that is already the tail of the summary
        "बोल्ट छेद बोर और बाहरी किनारे के कितने करीब हो सकते हैं?",
    ),
    (
        "de/calculators/sphere-ball/index.html",
        "Bei gleichem Durchmesser und gleicher Dicke ist die entwickelte Fläche die kleinste der Schale Endtypen",
        "",
        "Mahlkörper, Kugelmühlenladungen, Lager und dekorative oder strukturelle Kugeln.",
    ),
]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()

    for rel, foreign, replacement, tail_anchor in REPAIRS:
        path = ROOT / rel
        source = path.read_text(encoding="utf-8")
        match = MAP.search(source)
        data = json.loads(match.group(2)) if match else {"text": {}, "attrs": {}}

        changed = 0
        # 1. the translation map: drop the foreign prefix from affected keys
        for section in ("text", "attrs"):
            block = data.get(section) or {}
            rebuilt = {}
            for key, value in block.items():
                if foreign in key:
                    if replacement:
                        rebuilt[replacement] = value
                    else:
                        tail = key.split(foreign, 1)[1]
                        start = tail.find(tail_anchor) if tail_anchor in tail else -1
                        rebuilt[tail[start:] if start >= 0 else tail.lstrip(" .;,")] = value
                    changed += 1
                else:
                    rebuilt[key] = value
            if section in data:
                data[section] = rebuilt

        # 2. the markup: keep only the text from the anchor onwards
        body = source
        if match:
            body = source[: match.start(2)] + "__MAP__" + source[match.end(2) :]
        for old in (replacement, tail_anchor):
            if not old:
                continue
            pattern = re.compile(re.escape(foreign) + r".*?" + re.escape(old), re.S)
            body, hits = pattern.subn(old, body)
            changed += hits

        if args.write and changed:
            if match:
                body = body.replace(
                    "__MAP__",
                    json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/"),
                )
            path.write_text(body, encoding="utf-8", newline="")
        print(f"{rel}: {changed} replacement(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
