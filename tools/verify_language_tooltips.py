"""Static verification for the dynamic language-dropdown tooltips.

Checks the central language-name table, the shared runtime in both the live
and generated-static builds, and that every page loads the matching assets.
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CODES = ["mr", "hi", "en", "de", "es", "fr", "ja", "zh", "pt", "ar"]


def load_mapping(path: Path) -> dict[str, dict[str, str]]:
    text = path.read_text(encoding="utf-8")
    match = re.search(r"var LANGUAGE_NAMES = \{(.*?)\n    \};", text, re.S)
    if not match:
        raise AssertionError(f"LANGUAGE_NAMES not found in {path}")
    mapping: dict[str, dict[str, str]] = {}
    for row in re.finditer(r"^\s*([a-z]{2}):\s*\{(.*?)\},?\s*$", match.group(1), re.M):
        code, body = row.group(1), row.group(2)
        entries = re.findall(r'([a-z]{2}):\s*"((?:[^"\\]|\\.)*)"', body)
        mapping[code] = {
            key: json.loads(f'"{value}"') for key, value in entries
        }
    return mapping


def main() -> None:
    live = ROOT / "frontend" / "i18n" / "i18n.js"
    static = ROOT / "frontend" / "i18n" / "i18n-static.js"
    css = ROOT / "frontend" / "i18n" / "language-switcher.css"

    live_map = load_mapping(live)
    static_map = load_mapping(static)
    assert live_map == static_map, "live and static language-name tables differ"

    for code in CODES:
        assert code in live_map, f"missing language block: {code}"
        missing = [target for target in CODES if target not in live_map[code]]
        assert not missing, f"{code} is missing names for: {', '.join(missing)}"

    expected = {
        ("en", "hi"): "Hindi",
        ("hi", "en"): "अंग्रेज़ी",
        ("mr", "en"): "इंग्रजी",
        ("de", "hi"): "Hindi",
        ("de", "en"): "Englisch",
        ("fr", "pt"): "Portugais",
        ("ja", "en"): "英語",
        ("zh", "hi"): "印地语",
        ("pt", "en"): "Inglês",
        ("ar", "hi"): "الهندية",
    }
    for (current, hovered), label in expected.items():
        assert live_map[current][hovered] == label, (
            f"{current}/{hovered}: expected {label!r}, got {live_map[current][hovered]!r}"
        )

    for path in (live, static):
        text = path.read_text(encoding="utf-8")
        for marker in (
            "LANGUAGE_NAMES[currentTooltipLanguage()]",
            "LANGUAGE_NAMES.en[code]",
            "function initLanguageTooltips()",
            'tooltipElement.className = "mw-lang-tooltip"',
            'link.removeAttribute("title")',
            "window.addEventListener(\"mw:languagechange\", hideTooltip)",
        ):
            assert marker in text, f"{marker!r} missing from {path.name}"

    css_text = css.read_text(encoding="utf-8")
    for marker in (".mw-lang-tooltip {", ".mw-lang-tooltip.is-visible {", "z-index: 1400;"):
        assert marker in css_text, f"{marker!r} missing from language-switcher.css"

    pages = 0
    for current, dirs, files in os.walk(ROOT):
        dirs[:] = [
            name for name in dirs if name not in {"node_modules", "backend", ".git"}
        ]
        for filename in files:
            if not filename.endswith(".html"):
                continue
            path = Path(current) / filename
            text = path.read_text(encoding="utf-8")
            if 'class="lang-switch__menu"' not in text:
                continue
            pages += 1
            rel = path.relative_to(ROOT).as_posix()
            assert '"version":"61"' in text, f"stale i18n config version in {rel}"
            assert "i18n/language-switcher.css?v=61" in text, f"stale tooltip CSS in {rel}"
            assert (
                "i18n/i18n.js?v=61" in text or "i18n/i18n-static.js?v=61" in text
            ), f"stale i18n runtime in {rel}"
            menu = re.search(r'<ul class="lang-switch__menu".*?</ul>', text, re.S)
            assert menu, f"language menu not found in {rel}"
            menu_codes = set(re.findall(r'hreflang="([a-z]{2})"', menu.group(0)))
            assert menu_codes == set(CODES), (
                f"menu language mismatch in {rel}: {sorted(menu_codes)}"
            )

    assert pages == 260, f"expected 260 dropdown pages, found {pages}"
    print(f"language-name table: 10 languages x 10 names")
    print(f"verified {pages} dropdown pages; live/static runtime and CSS OK")


if __name__ == "__main__":
    main()
