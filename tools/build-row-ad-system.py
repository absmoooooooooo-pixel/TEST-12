# -*- coding: utf-8 -*-
"""Builds the Row advertisement system: 62 Row files + page wiring + SW."""

import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FOLDER = "Material Weight Calculator on Language Ads"

LANGUAGES = ["en", "es", "de", "fr", "pt", "zh", "ja", "hi", "mr", "ar"]

LANGUAGE_NAMES = {
    "en": "English", "es": "Spanish", "de": "German", "fr": "French",
    "pt": "Portuguese", "zh": "Chinese", "ja": "Japanese", "hi": "Hindi",
    "mr": "Marathi", "ar": "Arabic",
}

LABELS = {
    "en": "Advertisement", "es": "Publicidad", "de": "Werbung",
    "fr": "Publicité", "pt": "Publicidade", "zh": "广告", "ja": "広告",
    "hi": "विज्ञापन", "mr": "जाहिरात", "ar": "إعلان",
}

ROWS = {
    "a-row": [
        ("Plate", "plate"),
        ("C Channel", "c-channel"),
        ("Solid Round Bar", "round-bar"),
        ("Square Bar", "square-bar"),
    ],
    "b-row": [
        ("Circular Plate", "circular-plate"),
        ("E-Section", "e-section"),
        ("Round Bar with Hexagonal Hole", "round-bar-with-hexagonal-hole"),
        ("Triangular Bar", "triangular-bar"),
    ],
    "c-row": [
        ("Flange Plate Weight Calculator", "flange-plate"),
        ("T Channel", "t-channel"),
        ("Trapezium Bar", "trapezium-bar"),
        ("Hexagonal Bar with Round Hole", "hexagonal-bar-with-round-hole"),
    ],
    "d-row": [
        ("Sphere / Ball", "sphere-ball"),
        ("Pipe", "pipe"),
        ("Trapezoidal Bar", "trapezoidal-bar"),
        ("Solid Cone", "solid-cone"),
    ],
    "e-row": [
        ("L Channel", "l-channel"),
        ("Shell", "shell"),
        ("Box Channel", "box-channel"),
        ("Truncated Cone (Conical Reducer)", "truncated-cone"),
    ],
    "f-row": [
        ("I Channel", "i-channel"),
        ("Dish Ends Calculator", "dish-ends"),
        ("Hexagon Bar", "hexagon-bar"),
        ("Nut & Bolt Weight Calculator", "nut-bolt"),
    ],
}


def calculator_path(language, slug):
    if language == "en":
        return "/frontend/calculators/%s/" % slug
    return "/%s/calculators/%s/" % (language, slug)


def row_file(language, row):
    lang_name = LANGUAGE_NAMES[language]
    row_title = row.upper()
    lines = []
    for index, (name, slug) in enumerate(ROWS[row], start=1):
        path = calculator_path(language, slug)
        lines.append("     %d. %-40s %s" % (index, name, path))
    calculators = "\n".join(lines)

    return u"""/* ==========================================================================
   ROW ADVERTISEMENT — {lang_name_upper} — {row_title}
   --------------------------------------------------------------------------
   This ONE file controls the advertisement on the four {row_title} calculators
   in {lang_name}:

{calculators}

   WHAT TO EDIT (three fields)
     imageUrl         paste the advertisement image address
     destinationUrl   paste the page a click should open
     enabled          true = show it, false = hide it

   The advertisement appears on ALL FOUR pages above at the same time, in
   {lang_name} only. It is shown only when BOTH URLs are valid; leave either
   one empty and nothing is displayed at all — no empty box, no blank space.

       OPTIONAL
     description     advertisement text shown under the title
     businessName    business name shown above it
     altText         text for screen readers (default: {label})
     width/height    the creative's natural size (default 728 x 90)
     displayMode     "contain" (whole image) or "cover" (fill and crop)
     openInNewTab    true (default) or false

   The whole card is one link: the ribbon, image, description and the
   CLICK HERE button all open destinationUrl in a new tab.
   ========================================================================== */

window.MW_ROW_ADS = window.MW_ROW_ADS || {{}};
window.MW_ROW_ADS.{language} = window.MW_ROW_ADS.{language} || {{}};

window.MW_ROW_ADS.{language}["{row}"] = {{
    enabled: true,

    /* 1. ADVERTISEMENT IMAGE URL --------------------------------------- */
    imageUrl: "",

    /* 2. ADVERTISEMENT DESTINATION URL --------------------------------- */
    destinationUrl: "",

    /* 3. ADVERTISEMENT DESCRIPTION (optional) -------------------------- */
    /* Promotional text shown under the title. Multi-line is supported.
       Leave it empty and no description area is displayed. */
    description: "",

    /* ------------------------------------------------------------------ */
    altText: "{label}",
    width: 728,
    height: 90,
    displayMode: "contain",
    openInNewTab: true
}};
""".format(
        lang_name_upper=lang_name.upper(),
        row_title=row_title,
        lang_name=lang_name,
        calculators=calculators,
        label=LABELS[language],
        language=language,
        row=row,
    )


def write_row_files():
    created = 0
    for language in LANGUAGES:
        folder = os.path.join(ROOT, FOLDER, language)
        os.makedirs(folder, exist_ok=True)
        for row in ROWS:
            path = os.path.join(folder, row + ".js")
            # Never overwrite a Row file that already exists: it may hold a live
            # advertisement and its description.
            if os.path.exists(path):
                continue
            with open(path, "w", encoding="utf-8", newline="\n") as handle:
                handle.write(row_file(language, row))
            created += 1
    return created


# ---------------------------------------------------------------------------
# Pages
# ---------------------------------------------------------------------------
CSS_OLD = re.compile(
    r'[ \t]*<link rel="stylesheet" href="\.\./\.\./\.\./Material-Weight-Calculation-All-Languages-Ads/ads\.css\?v=1">[ \t]*\r?\n'
)
CSS_NEW = ('    <link rel="stylesheet" href="../../../{folder}/row-ads.css?v=7">\n')

SCRIPT_CONFIG_OLD = re.compile(
    r'[ \t]*<script src="\.\./\.\./\.\./Material-Weight-Calculation-All-Languages-Ads/ads\.config\.js\?v=1" defer></script>[ \t]*\r?\n'
)
SCRIPT_CONFIG_NEW = ('    <script src="../../../{folder}/row-ads.config.js?v=7" defer></script>\n')

SCRIPT_MAIN_OLD = re.compile(
    r'[ \t]*<script src="\.\./\.\./\.\./Material-Weight-Calculation-All-Languages-Ads/ads\.js\?v=1" defer></script>[ \t]*\r?\n'
)
SCRIPT_MAIN_NEW = ('    <script src="../../../{folder}/row-ads.js?v=7" defer></script>\n')


def find_pages():
    pages = []
    for entry in sorted(os.listdir(ROOT)):
        calculators = os.path.join(ROOT, entry, "calculators")
        if not os.path.isdir(calculators):
            continue
        for slug in sorted(os.listdir(calculators)):
            page = os.path.join(calculators, slug, "index.html")
            if os.path.isfile(page):
                pages.append(page)
    return pages


def wire_pages():
    pages = find_pages()
    css = 0
    config = 0
    main = 0
    comment = 0

    for page in pages:
        with open(page, "r", encoding="utf-8", newline="") as handle:
            text = handle.read()
        original = text

        text, n = CSS_OLD.subn(CSS_NEW.format(folder=FOLDER), text)
        css += n
        text, n = SCRIPT_CONFIG_OLD.subn(SCRIPT_CONFIG_NEW.format(folder=FOLDER), text)
        config += n
        text, n = SCRIPT_MAIN_OLD.subn(SCRIPT_MAIN_NEW.format(folder=FOLDER), text)
        main += n

        if "CENTRAL ADVERTISEMENT SYSTEM" in text:
            text = text.replace("CENTRAL ADVERTISEMENT SYSTEM", "ROW ADVERTISEMENT SYSTEM")
            comment += 1

        if text != original:
            with open(page, "w", encoding="utf-8", newline="") as handle:
                handle.write(text)

    return len(pages), css, config, main, comment


# ---------------------------------------------------------------------------
# Service worker
# ---------------------------------------------------------------------------
SW_OLD = re.compile(
    r'[ \t]*"\./Material-Weight-Calculation-All-Languages-Ads/ads\.(?:css|config\.js|js)\?v=1",?\r?\n'
)
SW_NEW = (
    '    "./Material Weight Calculator on Language Ads/row-ads.css?v=7",\n'
    '    "./Material Weight Calculator on Language Ads/row-ads.config.js?v=7",\n'
    '    "./Material Weight Calculator on Language Ads/row-ads.js?v=7"\n'
)


def update_service_worker():
    path = os.path.join(ROOT, "service-worker.js")
    with open(path, "r", encoding="utf-8", newline="") as handle:
        text = handle.read()

    text = text.replace(
        '    "./Material-Weight-Calculation-All-Languages-Ads/ads.js?v=1"\n]',
        '    "./Material-Weight-Calculation-All-Languages-Ads/ads.js?v=1"\n]',
    )

    # Replace the three legacy entries (last items of PRECACHE) in one go.
    text, count = SW_OLD.subn(SW_NEW, text)
    text = text.replace("mw-static-v113", "mw-static-v114")

    with open(path, "w", encoding="utf-8", newline="") as handle:
        handle.write(text)
    return count


if __name__ == "__main__":
    rows = write_row_files()
    total, css, conf, main, comments = wire_pages()
    sw = update_service_worker()
    print("row files:", rows)
    print("pages scanned:", total, "css:", css, "config:", conf, "renderer:", main, "comments:", comments)
    print("service worker entries replaced:", sw)
