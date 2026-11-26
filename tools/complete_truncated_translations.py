#!/usr/bin/env python3
"""Fill dictionary entries that were saved after only their first sentence.

    python tools/complete_truncated_translations.py [--lang ar] [--dry-run]

Earlier localization passes left some values ending at the first full stop and
kept a trailing space. The visible FAQ answers were therefore incomplete. This
one-off helper translates the complete English source again, protecting the
official codes, variables and units that must stay unchanged.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LANGS = ["hi", "de", "es", "fr", "zh", "ar"]

# Tokens that must survive translation byte-for-byte.
PROTECT = [
    re.compile(r"g/cm³|kg/m³|kg/m²|kg/m|kg/cm³|mm²|mm³|cm²|cm³|m²|m³|kg/m²|kg/m³"),
    re.compile(
        r"\b(?:ASTM|AISI|SAE|DIN|JIS|ISO|ANSI|ASME|BS|EN|GB|UNS|SS|ISMC|IS|"
        r"UNC|UNF|NPT|BSP|BSW|BSF|DN|PN|SHS|RHS|NB|PCD|ID|OD|HD|HRC|HB|HV|"
        r"Ra|RMS|MSDS|RoHS|REACH|MM|Inches)\b"
    ),
    re.compile(r"\b(?:foot|feet|inch|inches|metre|metres|meter|meters)\b", re.I),
    re.compile(r"\b[ABDHKLPRSTVWdhrskpρπ]\b"),
]


def placeholder(index: int) -> str:
    """Distinct bracketed token that translation engines preserve verbatim."""
    return f"⟦{index}⟧"


def protect_source(text: str) -> tuple[str, list[str]]:
    tokens: list[str] = []

    def replace(match: re.Match[str]) -> str:
        tokens.append(match.group(0))
        return placeholder(len(tokens) - 1)

    protected = text
    for pattern in PROTECT:
        protected = pattern.sub(replace, protected)
    return protected, tokens


def restore_target(text: str, tokens: list[str]) -> str:
    def replace(match: re.Match[str]) -> str:
        index = int(match.group(1))
        return tokens[index] if 0 <= index < len(tokens) else match.group(0)

    return re.sub(r"⟦\s*(\d+)\s*⟧", replace, text).strip()


def translate(text: str, lang: str, attempts: int = 3) -> str:
    protected, tokens = protect_source(text)
    url = "https://translate.googleapis.com/translate_a/single?" + urllib.parse.urlencode(
        {"client": "gtx", "sl": "en", "tl": lang, "dt": "t", "q": protected}
    )
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(request, timeout=30) as response:
                data = json.loads(response.read().decode("utf-8"))
            translated = "".join(
                segment[0] for segment in data[0] if segment and segment[0]
            )
            return restore_target(translated, tokens)
        except Exception as error:  # pragma: no cover - network retry path
            last_error = error
            time.sleep(0.5 * (attempt + 1))
    raise RuntimeError(f"translation failed for {lang}: {last_error}")


def is_truncated(key: str, value: object) -> bool:
    if not isinstance(value, str) or not value.endswith(" "):
        return False
    source = key.strip()
    translated = value.strip()
    if len(source) < 40 or len(translated) >= len(source) * 0.92:
        return False
    # A trailing space plus a much shorter value means the rest of the source
    # was never translated. This covers semicolon-separated formula strings as
    # well as multi-sentence FAQ answers.
    return True


def dictionary_path(lang: str) -> Path:
    return ROOT / "frontend" / "i18n" / lang / f"{lang}.json"


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass

    parser = argparse.ArgumentParser()
    parser.add_argument("--lang", action="append", choices=LANGS)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    languages = args.lang or LANGS

    for lang in languages:
        path = dictionary_path(lang)
        data = json.loads(path.read_text(encoding="utf-8"))
        strings = data.get("strings", {})
        keys = [key for key, value in strings.items() if is_truncated(key, value)]
        print(f"{lang}: {len(keys)} truncated entries", flush=True)
        if not keys:
            continue
        if args.dry_run:
            for key in keys[:3]:
                print("  ", key[:100], "->", translate(key, lang)[:160], flush=True)
            continue

        results: dict[str, str] = {}
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            future_to_key = {pool.submit(translate, key, lang): key for key in keys}
            for future in concurrent.futures.as_completed(future_to_key):
                key = future_to_key[future]
                results[key] = future.result()
        for key, value in results.items():
            strings[key] = value
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{lang}: wrote {len(results)} completed entries", flush=True)


if __name__ == "__main__":
    main()
