"""Bump the shared i18n runtime cache-busting version across every page.

Only URLs for i18n runtime/dictionary assets and the matching
`__MW_I18N_CONFIG.version` value are touched. Calculator and dashboard asset
versions are intentionally left alone.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OLD = "63"
NEW = "64"
ASSET_TOKENS = (
    "i18n/language-switcher.css",
    "i18n/number-format.js",
    "i18n/translations.js",
    "i18n/technical-language.js",
    "i18n/i18n.js",
    "i18n/language-switcher.js",
    "i18n/i18n-static.js",
    "dict-",
)
SKIP_DIRS = {"node_modules", ".git", "backend"}

changed = []
for path in ROOT.rglob("*.html"):
    if any(part in SKIP_DIRS for part in path.parts):
        continue
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines(keepends=True)
    updated = []
    file_changed = False
    for line in lines:
        if f'"version":"{OLD}"' in line:
            line = line.replace(f'"version":"{OLD}"', f'"version":"{NEW}"')
            file_changed = True
        if f"?v={OLD}" in line and any(token in line for token in ASSET_TOKENS):
            line = line.replace(f"?v={OLD}", f"?v={NEW}")
            file_changed = True
        updated.append(line)
    if file_changed:
        path.write_text("".join(updated), encoding="utf-8", newline="\n")
        changed.append(str(path.relative_to(ROOT)).replace("\\", "/"))

print(f"updated {len(changed)} pages")
for item in changed[:10]:
    print(item)
if len(changed) > 10:
    print(f"... and {len(changed) - 10} more")
