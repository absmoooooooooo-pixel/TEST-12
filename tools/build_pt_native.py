#!/usr/bin/env python3
"""Build native European Portuguese calculator pages from the English masters.

The English pages are the only structural source. This script:
  * keeps every SVG drawing, ID, CSS class and shared script reference;
  * rewrites relative paths, SEO metadata, language switcher and i18n config;
  * applies authored Portuguese content instead of a mechanical translation;
  * replaces FAQ blocks with original Portuguese FAQs.

Calculation formulas are never copied: every generated page loads the same
shared frontend/calculators/<slug>/<slug>.js script as the English master.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT_DIR = ROOT / "tools" / "pt_content"
MARKER = "<!-- MW-PT-AUTHORED: hand-authored Portuguese page; do not regenerate. -->"

LANGUAGES = [
    ("mr", "mr_IN", "Marathi", "मराठी", "MAR", "in", "ltr"),
    ("hi", "hi_IN", "Hindi", "हिंदी", "HIN", "in", "ltr"),
    ("en", "en_US", "English", "English", "ENG", "us", "ltr"),
    ("de", "de_DE", "German", "Deutsch", "DE", "de", "ltr"),
    ("es", "es_ES", "Spanish", "Español", "ES", "es", "ltr"),
    ("fr", "fr_FR", "French", "Français", "FR", "fr", "ltr"),
    ("ja", "ja_JP", "Japanese", "日本語", "JA", "jp", "ltr"),
    ("zh", "zh_CN", "Chinese", "简体中文", "ZH", "cn", "ltr"),
    ("pt", "pt_PT", "Portuguese", "Português", "PT", "pt", "ltr"),
    ("ar", "ar_SA", "Arabic", "العربية", "AR", "sa", "rtl"),
]

SWITCHER_SVG = (
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" '
    'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'
    '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/>'
    '<path d="M12 3.5c2.4 2.4 3.6 5.3 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.3-3.6-8.5S9.6 5.9 12 3.5Z"/>'
    "</svg>"
)


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def load_content() -> dict:
    common = load_json(CONTENT_DIR / "common.json")
    content: dict = {}
    for name in ("group-a.json", "group-b.json", "group-c.json", "group-d.json"):
        path = CONTENT_DIR / name
        if path.exists():
            content.update(load_json(path))
    for slug, item in content.items():
        merged = dict(common)
        merged.update(item.get("strings", {}))
        item["strings"] = merged
    return content


def switcher_markup(kind: str, slug: str = "") -> str:
    lines = [
        '<details class="lang-switch" data-lang="pt">',
        '            <summary aria-label="Alterar idioma" title="Alterar idioma">',
        f"                {SWITCHER_SVG}",
        '                <span class="lang-switch__label">',
        '                    <span class="lang-switch__label-full" lang="pt">Português</span>',
        '                    <span class="lang-switch__label-short">PT</span>',
        "                </span>",
        "            </summary>",
        '            <ul class="lang-switch__menu" role="list">',
    ]
    for code, og, _name, native, short, flag, direction in LANGUAGES:
        if code == "pt":
            href = "index.html"
            current = ' aria-current="true"'
        elif kind == "calculator":
            if code == "en":
                href = f"../../../frontend/calculators/{slug}/index.html"
            else:
                href = f"../../../{code}/calculators/{slug}/index.html"
            current = ""
        elif kind == "home":
            href = "../index.html" if code == "en" else f"../{code}/index.html"
            current = ""
        else:  # about
            href = "../../frontend/about/index.html" if code == "en" else f"../../{code}/about/index.html"
            current = ""
        lines.append(
            f'            <li><a href="{href}" hreflang="{code}" lang="{code}" dir="{direction}" '
            f'data-og-locale="{og}" data-short="{short}" role="button" title="{native}"{current}>'
            f'<span class="lang-switch__flag lang-switch__flag--{flag}" aria-hidden="true"></span>'
            f'<span class="lang-switch__name" lang="{code}" dir="{direction}">{native}</span></a></li>'
        )
    lines.extend(["            </ul>", "        </details>"])
    return "\n".join(lines)


def rewrite_switcher(html: str, kind: str, slug: str = "") -> str:
    pattern = re.compile(r'<details class="lang-switch"[\s\S]*?</details>', re.IGNORECASE)
    return pattern.sub(switcher_markup(kind, slug), html, count=1)


def rewrite_paths(html: str, slug: str) -> str:
    html = re.sub(
        rf'(<link rel="stylesheet" href="){re.escape(slug)}\.css(\?v=\d+)?"',
        rf'\1../../../frontend/calculators/{slug}/{slug}.css\2"',
        html,
        count=1,
    )
    html = re.sub(
        rf'(<script src="){re.escape(slug)}\.js\?v=(\d+)("></script>)',
        rf'\1../../../frontend/calculators/{slug}/{slug}.js?v=\2\3',
        html,
        count=1,
    )
    replacements = [
        ('href="../../shared/', 'href="../../../frontend/shared/'),
        ('src="../../shared/', 'src="../../../frontend/shared/'),
        ('href="../../assets/', 'href="../../../frontend/assets/'),
        ('src="../../assets/', 'src="../../../frontend/assets/'),
        ('href="../../i18n/', 'href="../../../frontend/i18n/'),
        ('src="../../i18n/', 'src="../../../frontend/i18n/'),
        ('href="../../icons/', 'href="../../../frontend/icons/'),
        ('src="../../icons/', 'src="../../../frontend/icons/'),
        ('href="../../favicon.png', 'href="../../../frontend/favicon.png'),
        ('href="../calculator-base.css', 'href="../../../frontend/calculators/calculator-base.css'),
        ('href="../../../index.html', 'href="../../index.html'),
    ]
    for old, new in replacements:
        html = html.replace(old, new)
    return html


def replace_faqs(html: str, faqs: list[dict]) -> str:
    if not faqs:
        return html
    section = re.search(
        r'(<section\b[^>]*aria-labelledby="[^"]*faq[^"]*"[^>]*>)([\s\S]*?)(</section>)',
        html,
        re.IGNORECASE,
    )
    if not section:
        return html
    inner = section.group(2)
    details = re.findall(r"<details\b[^>]*>[\s\S]*?</details>", inner, re.IGNORECASE)
    if not details:
        return html

    first = details[0]
    opening = re.match(r"<details\b([^>]*)>", first, re.IGNORECASE)
    attrs = opening.group(1) if opening else ""
    answer_class = re.search(r'<div class="([^"]*)"', first, re.IGNORECASE)
    answer_class = answer_class.group(1) if answer_class else "plate-faq-answer"

    generated = []
    for item in faqs:
        generated.append(
            f"<details{attrs}>\n"
            f"                <summary>{item['q']}</summary>\n"
            f'                <div class="{answer_class}">\n'
            f"                    <p>{item['a']}</p>\n"
            f"                </div>\n"
            f"            </details>"
        )

    new_inner = inner
    for block in details:
        new_inner = new_inner.replace(block, "", 1)
    container = re.search(r'(<div class="[^"]*faq-list[^"]*"[^>]*>)', new_inner, re.IGNORECASE)
    if container:
        close = new_inner.find("</div>", container.end())
        if close != -1:
            insert = "\n".join(generated) + "\n        "
            new_inner = new_inner[:close] + insert + new_inner[close:]
    else:
        new_inner = new_inner + "\n".join(generated)

    return html[: section.start(2)] + new_inner + html[section.end(2) :]


def apply_strings(html: str, mapping: dict[str, str]) -> str:
    # Never let a content mapping rewrite a URL in href/src attributes.
    protected: dict[str, str] = {}

    def stash(match: re.Match[str]) -> str:
        token = f"__MWURL{len(protected)}__"
        protected[token] = match.group(0)
        return token

    html = re.sub(r'(?:href|src)="[^"]*"', stash, html)
    for key in sorted(mapping, key=len, reverse=True):
        value = mapping[key]
        if key and key != value:
            html = html.replace(key, value)
    for token, original in protected.items():
        html = html.replace(token, original)
    return html


def build_page(slug: str, item: dict) -> Path:
    source = ROOT / "frontend" / "calculators" / slug / "index.html"
    html = source.read_text(encoding="utf-8")

    en_url = f"https://metalweightcalculator.online/frontend/calculators/{slug}/index.html"
    pt_url = f"https://metalweightcalculator.online/pt/calculators/{slug}/index.html"
    html = html.replace(en_url, pt_url)

    html = localise_head(html, item)

    html = rewrite_paths(html, slug)
    html = html.replace('"dictBase":"../../i18n/"', '"dictBase":"../../../frontend/i18n/"')
    html = apply_strings(html, item["strings"])
    html = replace_faqs(html, item.get("faqs", []))
    html = rewrite_switcher(html, "calculator", slug)

    if MARKER not in html:
        html = html.replace("<!DOCTYPE html>", "<!DOCTYPE html>\n" + MARKER, 1)

    output = ROOT / "pt" / "calculators" / slug / "index.html"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(html, encoding="utf-8", newline="\n")
    return output


def localise_head(html: str, item: dict) -> str:
    original = re.search(r'<meta name="description" content="([^"]*)"', html)
    if original:
        html = html.replace(original.group(1), item["description"])
    html = html.replace('"og:locale" content="en_US"', '"og:locale" content="pt_PT"')
    html = html.replace('"inLanguage": "en"', '"inLanguage": "pt"')
    html = html.replace('"current":"en"', '"current":"pt"')
    html = html.replace('"ogLocale":"pt_BR"', '"ogLocale":"pt_PT"')
    html = re.sub(r"<html lang=\"en\"", '<html lang="pt"', html, count=1)
    html = re.sub(r"<title>[\s\S]*?</title>", f"<title>{item['title']}</title>", html, count=1)
    html = re.sub(
        r'(<meta name="description" content=")[^"]*(">)',
        lambda m: m.group(1) + item["description"] + m.group(2),
        html,
        count=1,
    )
    html = re.sub(
        r'(<meta property="og:description" content=")[^"]*(">)',
        lambda m: m.group(1) + item["description"] + m.group(2),
        html,
        count=1,
    )
    html = re.sub(
        r'(<meta name="twitter:description" content=")[^"]*(">)',
        lambda m: m.group(1) + item["description"] + m.group(2),
        html,
        count=1,
    )
    html = re.sub(
        r'"h1":"[^"]*"',
        '"h1":' + json.dumps(item["h1"], ensure_ascii=False),
        html,
        count=1,
    )
    return html


def build_home(item: dict) -> Path:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    html = localise_head(html, item)

    html = html.replace('href="frontend/about/index.html"', 'href="about/index.html"')
    html = html.replace('href="manifest.webmanifest"', 'href="../manifest.webmanifest"')
    html = html.replace('href="frontend/', 'href="../frontend/')
    html = html.replace('src="frontend/', 'src="../frontend/')
    html = html.replace(
        'src="../frontend/assets/data/dashboard-data.js?v=6"',
        'src="assets/data/dashboard-data.js?v=6"',
    )
    html = html.replace('"dictBase":"frontend/i18n/"', '"dictBase":"../frontend/i18n/"')

    html = apply_strings(html, item["strings"])
    html = rewrite_switcher(html, "home")
    if MARKER not in html:
        html = html.replace("<!DOCTYPE html>", "<!DOCTYPE html>\n" + MARKER, 1)
    output = ROOT / "pt" / "index.html"
    output.write_text(html, encoding="utf-8", newline="\n")
    return output


def build_about(item: dict) -> Path:
    html = (ROOT / "frontend" / "about" / "index.html").read_text(encoding="utf-8")
    en_url = "https://metalweightcalculator.online/frontend/about/index.html"
    html = html.replace(en_url, "https://metalweightcalculator.online/pt/about/index.html")
    html = localise_head(html, item)

    for old, new in [
        ('href="../assets/', 'href="../../frontend/assets/'),
        ('src="../assets/', 'src="../../frontend/assets/'),
        ('href="../shared/', 'href="../../frontend/shared/'),
        ('src="../shared/', 'src="../../frontend/shared/'),
        ('href="../i18n/', 'href="../../frontend/i18n/'),
        ('src="../i18n/', 'src="../../frontend/i18n/'),
        ('href="../icons/', 'href="../../frontend/icons/'),
        ('src="../icons/', 'src="../../frontend/icons/'),
        ('href="../favicon.png', 'href="../../frontend/favicon.png'),
        ('src="../favicon.png', 'src="../../frontend/favicon.png'),
        ('href="../../index.html', 'href="../index.html'),
    ]:
        html = html.replace(old, new)
    html = html.replace('"dictBase":"../i18n/"', '"dictBase":"../../frontend/i18n/"')

    html = apply_strings(html, item["strings"])
    html = rewrite_switcher(html, "about")
    if MARKER not in html:
        html = html.replace("<!DOCTYPE html>", "<!DOCTYPE html>\n" + MARKER, 1)
    output = ROOT / "pt" / "about" / "index.html"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(html, encoding="utf-8", newline="\n")
    return output


CATEGORY_NAMES = {
    "structural": "Perfis estruturais",
    "hollow": "Perfis ocos",
    "bars": "Barras maciças",
    "profiles": "Tubos e barras perfiladas",
    "fasteners": "Fixadores",
    "plate": "Chapas e folhas",
    "sphere": "Esferas",
    "cone": "Cones e redutores",
    "heads": "Fundos de vasos",
}

CATEGORY_DESCRIPTIONS = {
    "structural": "Canais, vigas, cantoneiras e perfis T",
    "hollow": "Perfis caixa e retangulares ocos",
    "bars": "Barras redondas, quadradas, sextavadas e poligonais",
    "profiles": "Tubos e barras com furos maquinados",
    "fasteners": "Parafusos, pinos e porcas segundo ISO, DIN e ASME",
    "plate": "Chapas, folhas e placas",
    "sphere": "Componentes esféricos maciços",
    "cone": "Cones maciços e redutores cônicos fabricados",
    "heads": "Fundos abaulados, elipsoidais, hemisféricos e cônicos",
}

TOOL_NAMES = {
    "plate": "Chapa",
    "circular-plate": "Chapa circular",
    "flange-plate": "Flange",
    "sphere-ball": "Esfera / bola",
    "l-channel": "Perfil L",
    "i-channel": "Perfil I",
    "c-channel": "Perfil C",
    "t-channel": "Perfil T",
    "e-section": "Perfil E",
    "box-channel": "Perfil caixa",
    "pipe": "Tubo",
    "shell": "Casca cilíndrica",
    "truncated-cone": "Cone truncado",
    "solid-cone": "Cone maciço",
    "round-bar": "Barra redonda",
    "square-bar": "Barra quadrada",
    "hexagon-bar": "Barra sextavada",
    "hexagonal-bar-with-round-hole": "Barra sextavada com furo redondo",
    "round-bar-with-hexagonal-hole": "Barra redonda com furo sextavado",
    "trapezium-bar": "Barra em trapézio",
    "trapezoidal-bar": "Barra trapezoidal",
    "triangular-bar": "Barra triangular",
    "dish-ends": "Fundos de vaso",
    "nut-bolt": "Porcas e parafusos",
}


def build_dashboard_data(content: dict) -> Path:
    source = (ROOT / "frontend" / "assets" / "data" / "dashboard-data.js").read_text(encoding="utf-8")
    payload = json.loads(source.split("=", 1)[1].strip().rstrip(";"))

    for category in payload.get("categories", []):
        code = category.get("id", "")
        if code in CATEGORY_NAMES:
            category["name"] = CATEGORY_NAMES[code]
        if code in CATEGORY_DESCRIPTIONS:
            category["description"] = CATEGORY_DESCRIPTIONS[code]

    for tool in payload.get("tools", []):
        slug = tool.get("id", "")
        if slug in TOOL_NAMES:
            tool["name"] = TOOL_NAMES[slug]
        if slug in content:
            tool["title"] = content[slug]["title"]
            tool["description"] = content[slug]["description"]
        tool["path"] = f"calculators/{slug}/index.html"

    output = ROOT / "pt" / "assets" / "data" / "dashboard-data.js"
    output.parent.mkdir(parents=True, exist_ok=True)
    text = (
        "/* Native Portuguese dashboard data for the static Portuguese site. */\n"
        "window.ENGINEERING_DASHBOARD = "
        + json.dumps(payload, ensure_ascii=False, indent=2)
        + ";\n"
    )
    output.write_text(text, encoding="utf-8", newline="\n")
    return output


def main() -> None:
    content = load_content()
    if not content:
        raise SystemExit("No content manifests found in tools/pt_content")
    for slug, item in sorted(content.items()):
        output = build_page(slug, item)
        print(f"wrote {output.relative_to(ROOT).as_posix()}")

    dashboard = build_dashboard_data(content)
    print(f"wrote {dashboard.relative_to(ROOT).as_posix()}")

    common = load_json(CONTENT_DIR / "common.json")
    site_path = CONTENT_DIR / "site-pages.json"
    if site_path.exists():
        site = load_json(site_path)
        for key, builder in (("home", build_home), ("about", build_about)):
            if key in site:
                item = site[key]
                merged = dict(common)
                merged.update(item.get("strings", {}))
                item["strings"] = merged
                output = builder(item)
                print(f"wrote {output.relative_to(ROOT).as_posix()}")


if __name__ == "__main__":
    main()
