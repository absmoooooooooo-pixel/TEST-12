#!/usr/bin/env python3
"""Check every website page's local links, assets, and hreflang targets.

    python tools/check_all_site_links.py
"""
from __future__ import annotations

import re
import sys
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXCLUDED_TOP = {".backup", ".tmp", ".freebuff", "tools", "backend", "node_modules"}
EXTERNAL = ("#", "//", "http:", "https:", "mailto:", "tel:", "data:", "javascript:")
LINK_RE = re.compile(r'(?:href|src)\s*=\s*(["\'])(.*?)\1', re.S | re.I)
SITE_HOST = "metalweightcalculator.online"


def local_target(page: Path, value: str) -> tuple[Path | None, str | None]:
    value = value.strip()
    if not value or value.startswith(EXTERNAL):
        return None, None

    if value.startswith("http:") or value.startswith("https:"):
        parsed = urllib.parse.urlparse(value)
        if parsed.netloc.lower() not in {SITE_HOST, "www." + SITE_HOST}:
            return None, None
        decoded = urllib.parse.unquote(parsed.path)
        base = ROOT
    else:
        path = value.split("#", 1)[0].split("?", 1)[0]
        if not path:
            return None, None
        parsed = urllib.parse.urlparse(path)
        decoded = urllib.parse.unquote(parsed.path)
        base = ROOT if decoded.startswith("/") else page.parent

    if decoded in {"", "/"}:
        return ROOT / "index.html", None
    target = (base / decoded.lstrip("/")).resolve()
    if not target.exists() and (target / "index.html").exists():
        target = target / "index.html"
    return target, None


def display_path(path: Path) -> str:
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return str(path)


def website_pages() -> list[Path]:
    pages = []
    for path in ROOT.glob("**/index.html"):
        rel = path.relative_to(ROOT)
        if rel.parts and rel.parts[0] in EXCLUDED_TOP:
            continue
        pages.append(path)
    return sorted(pages)


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass

    pages = website_pages()
    errors: list[str] = []
    checked = 0

    for page in pages:
        source = page.read_text(encoding="utf-8")
        rel = page.relative_to(ROOT).as_posix()
        for match in LINK_RE.finditer(source):
            value = match.group(2).strip()
            target, _ = local_target(page, value)
            if target is None:
                continue
            checked += 1
            if not target.exists():
                errors.append(f"{rel}: {value} -> {display_path(target)}")

    print(f"checked {len(pages)} pages, {checked} local links, {len(errors)} broken links")
    for error in errors[:200]:
        print("  " + error)
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
