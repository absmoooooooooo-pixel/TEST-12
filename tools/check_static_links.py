#!/usr/bin/env python3
"""Verify that every local asset and page link in generated language pages exists.

    python tools/check_static_links.py --all
"""
from __future__ import annotations

import argparse
import posixpath
import re
import sys
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXTERNAL = ("#", "//", "http:", "https:", "mailto:", "tel:", "data:", "javascript:")
LINK_RE = re.compile(r'(?:href|src)\s*=\s*(["\'])(.*?)\1', re.S | re.I)


def check_file(path: Path) -> list[str]:
    source = path.read_text(encoding="utf-8")
    errors = []
    for match in LINK_RE.finditer(source):
        value = match.group(2).strip()
        if not value or value.startswith(EXTERNAL):
            continue
        target = (path.parent / urllib.parse.unquote(value.split("#", 1)[0].split("?", 1)[0])).resolve()
        if not target.exists() and not (target / "index.html").exists():
            errors.append(str(path.relative_to(ROOT)) + ": " + value)
    return errors


def generated_pages() -> list[Path]:
    pages = []
    for folder in sorted(ROOT.iterdir()):
        if not folder.is_dir() or not re.fullmatch(r"[a-z]{2}", folder.name):
            continue
        pages.extend(folder.rglob("index.html"))
    return pages


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass
    parser = argparse.ArgumentParser()
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--glob", help="path glob relative to workspace")
    args = parser.parse_args()
    if args.glob:
        pages = sorted(ROOT.glob(args.glob))
    elif args.all:
        pages = generated_pages()
    else:
        parser.error("use --all or --glob")
    errors = []
    for page in pages:
        errors.extend(check_file(page))
    print(f"checked {len(pages)} pages, {len(errors)} broken links")
    for error in errors[:100]:
        print("  " + error)
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
