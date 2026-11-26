#!/usr/bin/env python3
"""Pre-render separate language-specific pages from the existing English site.

    # proof of concept (one calculator, one language)
    python tools/build_static_languages.py --only-lang hi \
        --only-page frontend/calculators/plate/index.html

    # complete site
    python tools/static_lang_snapshot.py --out .tmp/static-lang-snapshot.json
    python tools/build_static_languages.py --all

The original English pages, the original dictionaries and the original
translation runtime are never changed. The generated pages contain the exact
text produced by the existing Translation button; they link to the SAME shared
CSS/JS/calculation-engine assets. Two small generated helper files add a locked
language to the translator and keep dashboard links inside the language folder.
"""
from __future__ import annotations

import argparse
import html
import json
import posixpath
import re
import sys
import urllib.parse
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE_BASE = "https://metalweightcalculator.online"
SNAPSHOT_DEFAULT = ".tmp/static-lang-snapshot.json"
I18N_VERSION = "69"

SKIP_TAGS = {"script", "style", "textarea", "code", "pre", "kbd", "samp"}
LANG_MAP = {
    "about": "about/index.html",
}


# ---------------------------------------------------------------------------
# shared metadata
# ---------------------------------------------------------------------------

def load_languages() -> tuple[list[dict], dict[str, dict]]:
    data = json.loads((ROOT / "frontend" / "i18n" / "languages.json").read_text(encoding="utf-8"))
    return data["languages"], {item["code"]: item for item in data["languages"]}


def load_dictionary(lang: str) -> dict:
    path = ROOT / "frontend" / "i18n" / lang / f"{lang}.json"
    return json.loads(path.read_text(encoding="utf-8"))


def source_pages() -> list[str]:
    return ["index.html", "frontend/about/index.html"] + [
        f"frontend/calculators/{path.name}/index.html"
        for path in sorted((ROOT / "frontend" / "calculators").iterdir())
        if path.is_dir() and (path / "index.html").is_file()
    ]


def target_relative_path(source_page: str, lang: str) -> str:
    # English keeps the original site URLs; only translations get a language
    # folder. The homepage is "/" and every other English page stays where it
    # has always been.
    if lang == "en":
        return source_page
    if source_page == "index.html":
        return f"{lang}/index.html"
    if source_page == "frontend/about/index.html":
        return f"{lang}/about/index.html"
    match = re.match(r"frontend/calculators/([^/]+)/index\.html$", source_page)
    if match:
        return f"{lang}/calculators/{match.group(1)}/index.html"
    raise ValueError(f"unsupported source page: {source_page}")


def target_url_path(source_page: str, lang: str) -> str:
    if lang == "en":
        if source_page == "index.html":
            return "/"
        return "/" + source_page
    return "/" + posixpath.dirname(target_relative_path(source_page, lang)) + "/"


def canonical_url(source_page: str, lang: str) -> str:
    return SITE_BASE + target_url_path(source_page, lang)


def mapped_page_path(path: str, lang: str) -> str | None:
    """Map an absolute site path to its language-specific equivalent."""
    clean = posixpath.normpath(path)
    if lang == "en":
        if clean in ("/", "/index.html"):
            return "/"
        return clean if clean.startswith("/") else "/" + clean
    if clean in ("/", "/index.html"):
        return "/" + lang + "/"
    if clean == "/frontend/about/index.html":
        return f"/{lang}/about/"
    match = re.match(r"^/frontend/calculators/([^/]+)/index\.html$", clean)
    if match:
        return f"/{lang}/calculators/{match.group(1)}/"
    return None


def rel_to(path: str, source_dir: str) -> str:
    """Make an absolute site path relative to a generated page directory."""
    target = posixpath.normpath(path).lstrip("/") or "."
    value = posixpath.relpath(target, source_dir or ".")
    return value


def page_file(path: str) -> str:
    """Name the HTML file for a page instead of its folder.

    A link to ``/es/calculators/plate/`` only opens the calculator when the
    server resolves a folder to its index.html. Opened from disk, or on a host
    without that rule, the visitor sees a folder listing instead. Every link
    the build writes therefore names the page file itself.
    """
    if not path:
        return path
    if path.endswith("/"):
        return path + "index.html"
    if posixpath.splitext(posixpath.basename(path))[1]:
        return path
    return path + "/index.html"


# ---------------------------------------------------------------------------
# text translation (raw HTML, not serialized DOM)
# ---------------------------------------------------------------------------

class TextSpans(HTMLParser):
    """Locate visible text spans in the raw HTML source."""

    def __init__(self, source: str):
        super().__init__(convert_charrefs=True)
        self.source = source
        self.offsets: list[int] = [0]
        for line in source.splitlines(keepends=True):
            self.offsets.append(self.offsets[-1] + len(line))
        self.spans: list[tuple[int, int, str]] = []
        self.skip_depth = 0
        self.stack: list[str] = []

    def position(self) -> int:
        line, column = self.getpos()
        return (self.offsets[line - 1] if line - 1 < len(self.offsets) else 0) + column

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        classes = str(attributes.get("class") or "")
        skip = (
            tag in SKIP_TAGS
            or "lang-switch" in classes
            or attributes.get("data-i18n-skip") is not None
        )
        if skip:
            self.skip_depth += 1
        self.stack.append(tag)

    def handle_startendtag(self, tag, attrs):
        attributes = dict(attrs)
        classes = str(attributes.get("class") or "")
        if not (
            tag in SKIP_TAGS
            or "lang-switch" in classes
            or attributes.get("data-i18n-skip") is not None
        ):
            start = self.position()
            end = self.source.find(">", start) + 1
            if end > start:
                self._span(start, end)

    def handle_endtag(self, tag):
        if tag in self.stack:
            index = len(self.stack) - 1 - self.stack[::-1].index(tag)
            if self.skip_depth and index >= len(self.stack) - self.skip_depth:
                self.skip_depth -= 1
            del self.stack[index:]
        elif self.skip_depth:
            self.skip_depth -= 1

    def _span(self, start: int, end: int) -> None:
        if self.skip_depth or end <= start:
            return
        raw = self.source[start:end]
        if not raw.strip():
            return
        self.spans.append((start, end, html.unescape(raw)))

    def handle_data(self, data):
        start = self.position()
        end = self.source.find("<", start)
        if end == -1:
            end = len(self.source)
        self._span(start, end)


def localize_translation(value: str, lang: str) -> str:
    """Mirror the runtime's locale punctuation for baked-in translations.

    The in-place translator converts Latin decimal and thousands separators to
    their Arabic forms on every translated string. Generated pages must apply
    the same conversion or a locked Arabic page will not match the language
    produced by the Translation button.
    """
    if lang != "ar" or not isinstance(value, str):
        return value
    return value.replace(".", "\u066b").replace(",", "\u066c")


def translate_text_nodes(source: str, mapping: dict[str, str]) -> tuple[str, int]:
    if not mapping:
        return source, 0
    parser = TextSpans(source)
    parser.feed(source)
    parser.close()
    edits = []
    for start, end, text in parser.spans:
        key = text.strip()
        target = mapping.get(key)
        if not target or target == key:
            continue
        lead = re.match(r"^\s*", text).group(0)
        trail = re.search(r"\s*$", text).group(0)
        replacement = lead + html.escape(target, quote=False) + trail
        edits.append((start, end, replacement))
    for start, end, replacement in reversed(edits):
        source = source[:start] + replacement + source[end:]
    return source, len(edits)


ATTRIBUTE_RE = re.compile(
    r'\b(placeholder|aria-label|title|alt)\s*=\s*(["\'])(.*?)\2', re.S
)


def translate_attributes(source: str, mapping: dict[str, str]) -> tuple[str, int]:
    if not mapping:
        return source, 0
    count = 0

    def rewrite_tag(match: re.Match[str]) -> str:
        nonlocal count
        tag = match.group(0)
        if "data-i18n-skip" in tag:
            return tag

        def rewrite_attribute(attribute: re.Match[str]) -> str:
            nonlocal count
            key = html.unescape(attribute.group(3)).strip()
            target = mapping.get(key)
            if not target or target == key:
                return attribute.group(0)
            count += 1
            return (
                attribute.group(1) + "=" + attribute.group(2)
                + html.escape(target, quote=True) + attribute.group(2)
            )

        return ATTRIBUTE_RE.sub(rewrite_attribute, tag)

    source = re.sub(r"<[A-Za-z][^>]*>", rewrite_tag, source)
    return source, count


# ---------------------------------------------------------------------------
# head metadata and SEO
# ---------------------------------------------------------------------------

def replace_tag_content(source: str, tag: str, value: str) -> str:
    if not value:
        return source
    pattern = re.compile(rf"(<{tag}[^>]*>).*?(</{tag}>)", re.S | re.I)
    replacement = html.escape(value, quote=False)
    return pattern.sub(lambda m: m.group(1) + replacement + m.group(2), source, count=1)


def replace_meta_content(source: str, selector_name: str, selector_value: str, value: str) -> str:
    if not value:
        return source
    pattern = re.compile(
        rf'(<meta\b[^>]*\b{re.escape(selector_name)}=\s*"{re.escape(selector_value)}"[^>]*\bcontent=")([^"]*)(")',
        re.I | re.S,
    )
    return pattern.sub(
        lambda m: m.group(1) + html.escape(value, quote=True) + m.group(3),
        source, count=1,
    )


HREFLANG_LINK_RE = re.compile(
    r'\s*<link\b(?=[^>]*\brel="alternate")(?=[^>]*\bhreflang=")[^>]*>', re.I
)


def strip_hreflang_links(source: str) -> str:
    """Remove previously generated alternates so repeated builds stay clean."""
    return HREFLANG_LINK_RE.sub("", source)


def hreflang_links(source_page: str, languages: list[dict]) -> list[str]:
    links = [f'<link rel="alternate" hreflang="{item["code"]}" href="{canonical_url(source_page, item["code"])}">'
             for item in languages]
    links.append(f'<link rel="alternate" hreflang="x-default" href="{canonical_url(source_page, "en")}">')
    return links


def apply_english_hreflang(source: str, source_page: str, languages: list[dict]) -> str:
    """Advertise every language page from the original English URL too."""
    source = strip_hreflang_links(source)
    links = hreflang_links(source_page, languages)
    return source.replace("</head>", "    " + "\n    ".join(links) + "\n</head>", 1)


def apply_metadata(source: str, meta: dict, source_page: str, lang: str, languages: list[dict]) -> str:
    source = replace_tag_content(source, "title", meta.get("title", ""))
    source = replace_meta_content(source, "name", "description", meta.get("description", ""))
    source = replace_meta_content(source, "property", "og:title", meta.get("ogTitle", ""))
    source = replace_meta_content(source, "property", "og:description", meta.get("ogDescription", ""))
    source = replace_meta_content(source, "property", "og:site_name", meta.get("ogSiteName", ""))
    source = replace_meta_content(source, "name", "twitter:title", meta.get("twitterTitle", ""))
    source = replace_meta_content(source, "name", "twitter:description", meta.get("twitterDescription", ""))
    source = replace_meta_content(source, "name", "apple-mobile-web-app-title", meta.get("appleTitle", ""))
    source = replace_meta_content(source, "property", "og:locale", meta.get("ogLocale", ""))
    source = replace_meta_content(source, "property", "og:url", canonical_url(source_page, lang))

    canonical = canonical_url(source_page, lang)
    canonical_pattern = re.compile(r'(<link\b[^>]*\brel="canonical"[^>]*\bhref=")([^"]*)(")', re.I)
    if canonical_pattern.search(source):
        source = canonical_pattern.sub(lambda m: m.group(1) + canonical + m.group(3), source, count=1)
    else:
        source = source.replace("</head>", f'<link rel="canonical" href="{canonical}">\n</head>', 1)

    source = strip_hreflang_links(source)
    alternates = hreflang_links(source_page, languages)
    source = source.replace("</head>", "    " + "\n    ".join(alternates) + "\n</head>", 1)

    # Structured data follows the page language without changing any formula.
    source = source.replace('"inLanguage": "en"', f'"inLanguage": "{lang}"')
    return source


def apply_html_attributes(source: str, lang: str, direction: str) -> str:
    def rewrite(match: re.Match[str]) -> str:
        tag = match.group(0)
        if re.search(r'\blang="[^"]*"', tag):
            tag = re.sub(r'\blang="[^"]*"', f'lang="{lang}"', tag, count=1)
        else:
            tag = tag[:-1] + f' lang="{lang}">'
        if re.search(r'\bdir="[^"]*"', tag):
            tag = re.sub(r'\bdir="[^"]*"', f'dir="{direction}"', tag, count=1)
        else:
            tag = tag[:-1] + f' dir="{direction}">'
        return tag

    return re.sub(r"<html\b[^>]*>", rewrite, source, count=1)


# ---------------------------------------------------------------------------
# links, language switcher and runtime assets
# ---------------------------------------------------------------------------

def rewrite_urls(source: str, source_page: str, lang: str) -> str:
    source_dir = posixpath.dirname(target_relative_path(source_page, lang))
    base = "http://site/" + source_page

    def rewrite(match: re.Match[str]) -> str:
        prefix, quote, value = match.groups()
        if not value or value.startswith(("#", "//", "http:", "https:", "mailto:", "tel:", "data:", "javascript:")):
            return match.group(0)
        absolute = urllib.parse.urljoin(base, value)
        parsed = urllib.parse.urlsplit(absolute)
        path = urllib.parse.unquote(parsed.path)
        mapped = mapped_page_path(path, lang)
        if mapped:
            # A page link always names the HTML file, never its folder.
            new_value = rel_to(page_file(mapped), source_dir)
        else:
            new_value = rel_to(path, source_dir)
            if parsed.query or parsed.fragment:
                # Query/fragment targets are real files (often scripts).
                pass
            elif not new_value.endswith("/") and not posixpath.basename(path):
                new_value += "/"
        if parsed.query:
            new_value += "?" + parsed.query
        if parsed.fragment:
            new_value += "#" + parsed.fragment
        return prefix + quote + new_value + quote

    return re.sub(r'(<[^>]*?\b(?:href|src)\s*=\s*)(["\'])(.*?)\2', rewrite, source, flags=re.S)


def rewrite_switcher(source: str, source_page: str, lang: str, meta: dict, languages: list[dict]) -> str:
    pattern = re.compile(r'(<details class="lang-switch".*?</details>)', re.S)
    match = pattern.search(source)
    if not match:
        return source
    block = match.group(1)
    lang_by_code = {item["code"]: item for item in languages}

    block = re.sub(r'data-lang="[^"]*"', f'data-lang="{lang}"', block, count=1)
    for name in ("aria-label", "title"):
        value = meta.get("switcher" + ("Aria" if name == "aria-label" else "Title"), "")
        if value:
            block = re.sub(
                rf'(<summary\b[^>]*\b{name}=")[^"]*(")',
                lambda m: m.group(1) + html.escape(value, quote=True) + m.group(2),
                block, count=1,
            )
    # The switcher summary must name the current language in that language,
    # not leave the English dictionary name ("Japanese") on a Japanese page.
    full = lang_by_code.get(lang, {}).get("nativeName") or meta.get("switcherFull", "")
    if full:
        block = re.sub(
            r'(<span class="lang-switch__label-full"[^>]*>).*?(</span>)',
            lambda m: re.sub(r'\blang="[^"]*"', f'lang="{lang}"', m.group(1))
            + html.escape(full) + m.group(2),
            block, count=1, flags=re.S,
        )
    if meta.get("switcherShort"):
        block = re.sub(
            r'(<span class="lang-switch__label-short">).*?(</span>)',
            lambda m: m.group(1) + html.escape(meta["switcherShort"]) + m.group(2),
            block, count=1, flags=re.S,
        )

    def link(match: re.Match[str]) -> str:
        tag = match.group(0)
        code_match = re.search(r'\bhreflang="([a-z]+)"', tag)
        if not code_match:
            return tag
        code = code_match.group(1)
        target_path = page_file(target_url_path(source_page, code))
        source_dir = posixpath.dirname(target_relative_path(source_page, lang))
        href = rel_to(target_path, source_dir)
        tag = re.sub(r'\bhref="[^"]*"', f'href="{href}"', tag, count=1)
        tag = re.sub(r'\s*aria-current="true"', "", tag)
        if code == lang:
            tag = tag[:-1] + ' aria-current="true">'
        if code in lang_by_code and lang_by_code[code].get("nativeName"):
            pass  # native names stay untouched, exactly as in the original menu
        return tag

    block = re.sub(r"<a\b[^>]*\bhreflang=\"[a-z]+\"[^>]*>", link, block)
    return source[:match.start(1)] + block + source[match.end(1):]


def rewrite_english_switcher(source: str, source_page: str, languages: list[dict]) -> str:
    """Point the English page's language menu at the real page files.

    English pages are the source site, so their menu is written here rather
    than derived by rewrite_switcher. A missing href ("#") is also replaced,
    so the menu never depends on JavaScript to become usable.
    """
    pattern = re.compile(r'(<details class="lang-switch".*?</details>)', re.S)
    match = pattern.search(source)
    if not match:
        return source
    block = match.group(1)
    source_dir = posixpath.dirname(source_page)

    def link(match: re.Match[str]) -> str:
        tag = match.group(0)
        code_match = re.search(r'\bhreflang="([a-z]+)"', tag)
        if not code_match:
            return tag
        target_path = page_file(target_url_path(source_page, code_match.group(1)))
        href = rel_to(target_path, source_dir)
        return re.sub(r'\bhref="[^"]*"', f'href="{href}"', tag, count=1)

    block = re.sub(r"<a\b[^>]*\bhreflang=\"[a-z]+\"[^>]*>", link, block)
    return source[:match.start(1)] + block + source[match.end(1):]


def write_source_map(source: str, text_map: dict, attr_map: dict, snapshot_page: dict) -> str:
    """Give the locked runtime the English source behind every baked string.

    The generated HTML is already translated. Without this reverse map the
    runtime treats translated text as its own source and re-translates it,
    leaking templates such as "{term} ..." back into the page. Dictionary-only
    strings are included too, otherwise Arabic "Enter ..." phrases are matched
    by the reverse template helper and collapse to "أدخل {term}" after load.
    """
    match = re.search(
        r'(<script type="application/json" id="mw-i18n-sources">)(.*?)(</script>)',
        source, re.S,
    )
    if not match:
        return source
    try:
        original = json.loads(match.group(2))
    except json.JSONDecodeError:
        original = {}

    def inverted(mapping: dict) -> dict[str, str]:
        result: dict[str, str] = {}
        for english, translated in (mapping or {}).items():
            key = str(translated).strip()
            if key and key not in result:
                result[key] = english
        return result

    data = {
        "text": inverted(text_map),
        "attrs": inverted(attr_map),
    }
    for key in ("kind", "h1"):
        if key in original:
            data[key] = original[key]
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    return source[:match.start(2)] + payload + source[match.end(2):]


def rewrite_runtime(source: str, source_page: str, lang: str, languages: list[dict]) -> str:
    source_dir = posixpath.dirname(target_relative_path(source_page, lang))
    i18n_dir = rel_to("/frontend/i18n", source_dir)

    config_match = re.search(r"window\.__MW_I18N_CONFIG=(\{.*?\});", source, re.S)
    if not config_match:
        return source
    try:
        config = json.loads(config_match.group(1))
    except json.JSONDecodeError:
        config = {}
    config["current"] = lang
    config["lockLanguage"] = lang
    config["dictBase"] = i18n_dir + "/"
    config["languages"] = [
        {
            "code": item["code"],
            "dir": item.get("dir", "ltr"),
            "ogLocale": item.get("ogLocale", item["code"]),
            "name": item["name"],
            "nativeName": item["nativeName"],
            "short": item["short"],
        }
        for item in languages
    ]
    config_json = json.dumps(config, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    source = source[:config_match.start()] + (
        f"window.__MW_I18N_CONFIG={config_json};"
    ) + source[config_match.end():]

    source = re.sub(
        r'(<script src="[^"]*)/i18n\.js(\?v=\d+")',
        lambda m: m.group(1) + "/i18n-static.js" + m.group(2),
        source,
    )
    # The locked language must be known before any body script runs, otherwise
    # history counts and other runtime-generated text are formatted with the
    # English locale. Run the generated translator synchronously.
    source = re.sub(
        r'(<script src="[^"]*i18n-static\.js\?v=\d+"[^>]*?)\s+defer([^>]*></script>)',
        r"\1\2",
        source,
    )
    source = re.sub(
        r'\s*<script src="[^"]*language-switcher\.js\?v=\d+"[^>]*></script>', "", source
    )

    if lang != "en":
        dictionary = (
            f'<script src="{i18n_dir}/{lang}/dict-{lang}.js?v={I18N_VERSION}"></script>\n    '
        )
        marker = re.search(r'(<script src="[^"]*i18n-static\.js\?v=\d+"[^>]*></script>)', source)
        if marker:
            source = source[:marker.start()] + dictionary + source[marker.start():]

    if source_page == "index.html":
        source = re.sub(r"(assets/js/)dashboard\.js(\?v=\d+)", r"\1dashboard-static.js\2", source)
    return source


# ---------------------------------------------------------------------------
# generated helpers (original runtime files stay untouched)
# ---------------------------------------------------------------------------

def build_static_runtime_helpers() -> list[str]:
    original = (ROOT / "frontend" / "i18n" / "i18n.js").read_text(encoding="utf-8")
    static = original.replace(
        '    var config = window.__MW_I18N_CONFIG || {};\n',
        '    var config = window.__MW_I18N_CONFIG || {};\n'
        '    /* Generated page tree: the URL fixes the language. In-place switching\n'
        '       is disabled; navigation goes to the equivalent language page. */\n'
        '    var lockedLanguage = config.lockLanguage || "";\n',
        1,
    )
    static = static.replace(
        '    var currentCode = "en";\n'
        '    var dictionary = normalizeDictionary(dictionaries.en);\n'
        '    var currentIndex = indexDictionary(dictionary);\n',
        '    /* A generated page opens in the language of its own URL, which begin()\n'
        '       applies before the first paint. English is only the neutral\n'
        '       starting dictionary while the locked one is installed. */\n'
        '    var currentCode = "en";\n'
        '    var dictionary = normalizeDictionary(dictionaries.en);\n'
        '    var currentIndex = indexDictionary(dictionary);\n',
        1,
    )
    static = static.replace(
        '        if (code === currentCode) {\n',
        '        if (lockedLanguage && code !== lockedLanguage) {\n'
        '            return Promise.resolve(currentCode);\n'
        '        }\n'
        '        if (code === currentCode) {\n',
        1,
    )
    static = static.replace(
        '    function fillTemplateRecord(value, records) {\n'
        '        var normalized = normalizeTemplateText(value);\n',
        '    function fillTemplateRecord(value, records, preserveDigits) {\n'
        '        var normalized = preserveDigits\n'
        '            ? String(value == null ? "" : value)\n'
        '            : normalizeTemplateText(value);\n',
        1,
    )
    static = static.replace(
        '        var composedSource = fillTemplateRecord(value, globalReverseTemplates) ||\n'
        '            fillTemplateRecord(latinValue, globalReverseTemplates);\n',
        '        var composedSource = fillTemplateRecord(value, globalReverseTemplates, true) ||\n'
        '            fillTemplateRecord(latinValue, globalReverseTemplates, true);\n',
        1,
    )
    static = static.replace(
        '        var composed = fillTemplateRecord(current, globalReverseTemplates) ||\n'
        '            fillTemplateRecord(normalized, globalReverseTemplates);\n',
        '        var composed = fillTemplateRecord(current, globalReverseTemplates, true) ||\n'
        '            fillTemplateRecord(normalized, globalReverseTemplates, true);\n',
        1,
    )
    static = static.replace(
        '    if (document.readyState === "loading") {\n'
        '        document.addEventListener("DOMContentLoaded", start);\n'
        '    } else {\n'
        '        start();\n'
        '    }\n',
        '    function begin() {\n'
        '        start();\n'
        '        if (lockedLanguage) {\n'
        '            /* The URL already fixes this page language, so install it in\n'
        '               this same task, before the first paint. Waiting for load\n'
        '               and a timer showed English labels first and then flipped\n'
        '               them to the page language. Text the calculator renders\n'
        '               later is translated by the live observer as it is\n'
        '               inserted, which is also before that frame paints. */\n'
        '            switchTo(lockedLanguage).catch(function () {});\n'
        '        }\n'
        '    }\n'
        '\n'
        '    if (document.readyState === "loading") {\n'
        '        document.addEventListener("DOMContentLoaded", begin);\n'
        '    } else {\n'
        '        begin();\n'
        '    }\n',
        1,
    )
    if (
        "lockedLanguage" not in static
        or "A generated page opens in the language of its own URL" not in static
        or "switchTo(lockedLanguage)" not in static
        or "preserveDigits" not in static
        or static == original
    ):
        raise RuntimeError("could not build i18n-static.js from i18n.js")
    (ROOT / "frontend" / "i18n" / "i18n-static.js").write_text(static, encoding="utf-8")

    dashboard = (ROOT / "frontend" / "assets" / "js" / "dashboard.js").read_text(encoding="utf-8")
    old = (
        '        if ((document.documentElement.lang || "en").toLowerCase() !== "en" &&\n'
        '                path.indexOf("frontend/") === 0) {\n'
    )
    new = '        if (path.indexOf("frontend/") === 0) {\n'
    if old not in dashboard:
        raise RuntimeError("dashboard.js path block not found; cannot build dashboard-static.js")
    (ROOT / "frontend" / "assets" / "js" / "dashboard-static.js").write_text(
        dashboard.replace(old, new, 1), encoding="utf-8"
    )
    return ["frontend/i18n/i18n-static.js", "frontend/assets/js/dashboard-static.js"]


# ---------------------------------------------------------------------------
# page build
# ---------------------------------------------------------------------------

def build_page(
    source_page: str,
    lang: str,
    snapshot: dict,
    languages: list[dict],
) -> tuple[str, dict[str, int]]:
    source = (ROOT / source_page).read_text(encoding="utf-8")
    lang_data = snapshot.get("languages", {}).get(lang, {})
    # The snapshot only records strings that happened to be visible while it
    # ran. Dictionary entries such as the page heading, formula legends and
    # language names are also source text, so bake them in as well. Templates
    # with placeholders are excluded because the runtime composes those.
    dictionary_strings = {
        key: value
        for key, value in load_dictionary(lang).get("strings", {}).items()
        if isinstance(value, str) and "{" not in key and "}" not in key
    }
    text_map = dict(lang_data.get("text", {}))
    text_map.update(dictionary_strings)
    attr_map = dict(lang_data.get("attrs", {}))
    attr_map.update(dictionary_strings)
    text_map = {key: localize_translation(value, lang) for key, value in text_map.items()}
    attr_map = {key: localize_translation(value, lang) for key, value in attr_map.items()}
    meta = lang_data.get("meta", {})
    direction = "rtl" if lang == "ar" else "ltr"

    counts = {"text": 0, "attrs": 0}
    source, counts["text"] = translate_text_nodes(source, text_map)
    source, counts["attrs"] = translate_attributes(source, attr_map)
    source = write_source_map(source, text_map, attr_map, lang_data)
    source = apply_metadata(source, meta, source_page, lang, languages)
    source = apply_html_attributes(source, lang, direction)
    source = rewrite_urls(source, source_page, lang)
    source = rewrite_switcher(source, source_page, lang, meta, languages)
    source = rewrite_runtime(source, source_page, lang, languages)

    output = ROOT / target_relative_path(source_page, lang)
    output.parent.mkdir(parents=True, exist_ok=True)

    # Hand-authored Portuguese pages carry a marker. Never silently replace
    # them with an automatic translation snapshot.
    if lang == "pt" and output.exists():
        if "MW-PT-AUTHORED" in output.read_text(encoding="utf-8"):
            print(f"[skip authored] {output.relative_to(ROOT).as_posix()}")
            return str(output.relative_to(ROOT)).replace("\\", "/"), counts

    output.write_text(source, encoding="utf-8")
    return str(output.relative_to(ROOT)).replace("\\", "/"), counts


def build_sitemap(pages: list[str], languages: list[dict]) -> str:
    today = "2026-11-25"
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
             'xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for source_page in pages:
        urls = [(item["code"], canonical_url(source_page, item["code"])) for item in languages]
        for code, url in urls:
            lines.append("  <url>")
            lines.append(f"    <loc>{html.escape(url)}</loc>")
            lines.append(f"    <lastmod>{today}</lastmod>")
            for alternate_code, alternate_url in urls:
                lines.append(f'    <xhtml:link rel="alternate" hreflang="{alternate_code}" href="{html.escape(alternate_url)}"/>')
            english_url = canonical_url(source_page, "en")
            lines.append(f'    <xhtml:link rel="alternate" hreflang="x-default" href="{html.escape(english_url)}"/>')
            lines.append("  </url>")
    lines.append("</urlset>")
    return "\n".join(lines) + "\n"


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass

    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot", default=SNAPSHOT_DEFAULT)
    parser.add_argument("--all", action="store_true", help="Build every page in every language")
    parser.add_argument("--only-lang", action="append", help="Limit languages (repeatable)")
    parser.add_argument("--only-page", action="append", help="Limit source pages (repeatable)")
    parser.add_argument("--no-helpers", action="store_true", help="Do not regenerate runtime helpers")
    args = parser.parse_args()

    languages, by_code = load_languages()
    codes = args.only_lang or ([item["code"] for item in languages] if args.all else [])
    pages = args.only_page or (source_pages() if args.all else [])
    if not codes or not pages:
        parser.error("use --all, or provide --only-lang and --only-page")

    snapshot = json.loads((ROOT / args.snapshot).read_text(encoding="utf-8"))
    if not args.no_helpers:
        helpers = build_static_runtime_helpers()
        print("generated helpers: " + ", ".join(helpers))

    if args.all:
        for source_page in pages:
            english_page = ROOT / source_page
            english_source = english_page.read_text(encoding="utf-8")
            updated_source = apply_english_hreflang(english_source, source_page, languages)
            updated_source = rewrite_english_switcher(updated_source, source_page, languages)
            if updated_source != english_source:
                english_page.write_text(updated_source, encoding="utf-8")
        print("updated English hreflang alternates")

    total = 0
    for source_page in pages:
        for code in codes:
            if code not in by_code:
                raise SystemExit(f"unknown language: {code}")
            if code == "en":
                # English is the source site at its original URLs (homepage "/").
                continue
            snapshot_page = snapshot.get("pages", {}).get(source_page)
            if not snapshot_page:
                raise SystemExit(f"missing snapshot for {source_page}; run static_lang_snapshot.py first")
            output, counts = build_page(source_page, code, snapshot_page, languages)
            total += 1
            print(f"{output}  ({counts['text']} text, {counts['attrs']} attributes)")

    if args.all:
        sitemap = build_sitemap(source_pages(), languages)
        (ROOT / "sitemap-languages.xml").write_text(sitemap, encoding="utf-8")
        print("generated sitemap-languages.xml")
    print(f"built {total} pages")


if __name__ == "__main__":
    main()
