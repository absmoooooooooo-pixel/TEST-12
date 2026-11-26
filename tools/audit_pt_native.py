#!/usr/bin/env python3
"""Static QA for the hand-authored Portuguese pages."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MARKER = "MW-PT-AUTHORED"

# Words that legitimately remain in a Portuguese engineering page.
ALLOWED = {
    "iso", "din", "asme", "ansi", "astm", "bis", "bsi", "jis", "afnor", "une",
    "inconel", "monel", "kg", "mm", "g/cm", "m³", "pcd", "od", "id", "hd",
    "t", "l", "w", "d", "a", "b", "h", "r", "sf", "kr", "ρ", "javascript",
    "material", "total", "volume", "bronze", "flange", "cone", "standard",
    "nickel", "titanium", "magnesium", "monel",
}

ENGLISH = re.compile(
    r"\b(the|and|with|please|enter|select|calculate|calculation|weight|result|"
    r"material|dimensions|thickness|length|width|height|diameter|quantity|"
    r"single|total|volume|density|formula|example|frequently|asked|questions|"
    r"related|reset|tools|all|custom|carbon|steel|stainless|aluminium|brass|"
    r"bronze|copper|lead|zinc|tin|nickel|magnesium|titanium|cast|iron|hole|"
    r"holes|flange|web|leg|bar|plate|pipe|shell|cone|sphere|ball|nut|bolt|"
    r"thread|standard|piece|pieces|millimeters|millimetres|inches|tonnes)\b",
    re.IGNORECASE,
)


def visible_text(html: str) -> str:
    html = re.sub(r"<script\b[\s\S]*?</script>", " ", html, flags=re.IGNORECASE)
    html = re.sub(r"<style\b[\s\S]*?</style>", " ", html, flags=re.IGNORECASE)
    html = re.sub(r"<!--[\s\S]*?-->", " ", html)
    html = re.sub(r"<[^>]+>", " ", html)
    return html


def missing_assets(page: Path, html: str) -> list[str]:
    missing: list[str] = []
    for asset in re.finditer(r'(?:src|href)="([^"]+)"', html):
        url = asset.group(1).split("?", 1)[0].split("#", 1)[0]
        if not url or url.startswith(("http:", "https:", "mailto:", "data:")):
            continue
        if not url.lower().endswith((".js", ".css", ".png", ".webmanifest")):
            continue
        # Ad assets are injected by the deployment environment, not stored here.
        if "All-Languages-Ads" in url:
            continue
        target = (page.parent / url).resolve()
        if not target.exists():
            missing.append(url)
    return missing


def main() -> None:
    problems = 0
    pages = sorted((ROOT / "pt" / "calculators").glob("*/index.html"))
    for page in pages:
        slug = page.parent.name
        html = page.read_text(encoding="utf-8")
        flags: list[str] = []
        if MARKER not in html:
            flags.append("missing authored marker")
        expected = f'src="../../../frontend/calculators/{slug}/{slug}.js?v='
        if expected not in html:
            flags.append("does not load shared calculator JS")
        if re.search(rf'<script src="{re.escape(slug)}\.js', html):
            flags.append("loads a local per-language JS")

        missing = missing_assets(page, html)
        if missing:
            flags.append("missing assets: " + ", ".join(sorted(set(missing))))

        text = visible_text(html)
        leftovers: dict[str, str] = {}
        for match in ENGLISH.finditer(text):
            word = match.group(0).lower()
            if word in ALLOWED:
                continue
            leftovers.setdefault(word, text[max(0, match.start() - 40) : match.end() + 40])
        if leftovers:
            flags.append(
                "English words: "
                + ", ".join(f"{word} [{snippet.strip()}]" for word, snippet in leftovers.items())
            )
        if flags:
            problems += 1
            print(f"{page.relative_to(ROOT).as_posix()}: " + "; ".join(flags))
    for relative in ("index.html", "about/index.html"):
        page = ROOT / "pt" / relative
        if not page.exists():
            continue
        html = page.read_text(encoding="utf-8")
        flags: list[str] = []
        if MARKER not in html:
            flags.append("missing authored marker")
        missing = missing_assets(page, html)
        if missing:
            flags.append("missing assets: " + ", ".join(sorted(set(missing))))
        text = visible_text(html)
        leftovers: dict[str, str] = {}
        for match in ENGLISH.finditer(text):
            word = match.group(0).lower()
            if word in ALLOWED:
                continue
            leftovers.setdefault(word, text[max(0, match.start() - 40) : match.end() + 40])
        if leftovers:
            flags.append(
                "English words: "
                + ", ".join(f"{word} [{snippet.strip()}]" for word, snippet in leftovers.items())
            )
        if flags:
            problems += 1
            print(f"pt/{relative}: " + "; ".join(flags))
    print(f"checked {len(pages)} calculator pages, {problems} with findings")


if __name__ == "__main__":
    main()
