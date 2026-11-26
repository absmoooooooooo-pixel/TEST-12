"""Shared paths for the English source site and its language dictionaries.

Shared runtime files stay in frontend/i18n/. Every language owns a folder there
(e.g. frontend/i18n/hi/) containing its source JSON and generated browser
dictionary. Published language pages live in the top-level /<lang>/ folders.
"""
from __future__ import annotations

import json
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
FRONTEND = PROJECT_ROOT / "frontend"
I18N_DIR = FRONTEND / "i18n"
SITE_BASE = "https://metalweightcalculator.online"
DEFAULT_LANGUAGE = "en"

SKIP_FOLDERS = {
    "backend",
    "dist",
    "BIN",
    "assets",
    "icons",
    "shared",
    "scripts",
    "tools",
    "node_modules",
    ".git",
    ".freebuff",
    ".cloud-attachments",
    ".backup",
    ".tmp",
    ".audit",
    "i18n",
}


def load_languages() -> dict:
    return json.loads((I18N_DIR / "languages.json").read_text(encoding="utf-8"))


def language_codes() -> list[str]:
    return [item["code"] for item in load_languages()["languages"]]


def dictionary_dir(code: str) -> Path:
    """Folder containing one language's source and generated dictionary."""
    return I18N_DIR / code


def dictionary_path(code: str) -> Path:
    return dictionary_dir(code) / f"{code}.json"


def dictionary_js_path(code: str) -> Path:
    return dictionary_dir(code) / f"dict-{code}.js"


def load_dictionary(code: str) -> dict:
    return json.loads(dictionary_path(code).read_text(encoding="utf-8"))


def source_pages() -> list[str]:
    """Repo-relative paths of the English pages, in a stable order."""
    pages = ["index.html"]

    for page in sorted(FRONTEND.rglob("index.html"), key=lambda item: item.as_posix().lower()):
        relative = page.relative_to(PROJECT_ROOT).as_posix()

        if any(part in SKIP_FOLDERS or part.startswith(".") for part in relative.split("/")[:-1]):
            continue

        pages.append(relative)

    return pages


def strip_frontend(relative: str) -> str:
    return relative[len("frontend/"):] if relative.startswith("frontend/") else relative


def page_url(relative: str) -> str:
    """Absolute canonical URL of an English page."""
    if relative == "index.html":
        return SITE_BASE + "/"
    return SITE_BASE + "/" + relative
