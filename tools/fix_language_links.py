"""Make every language-menu link a real, correct, working URL.

Each page already declares its exact counterpart in every language through
<link rel="alternate" hreflang="..."> tags. Those tags are the single source of
truth for page equivalence, so the visible `.lang-switch__menu` links are
generated from them.

Before this script the English pages carried href="#" placeholders and relied
on a runtime pathname regex; when the URL shape did not match the regex the
switch fell back to the language homepage instead of the same calculator.

Usage:  python tools/fix_language_links.py [--check]
"""

import os
import posixpath
import re
import sys
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_DIRS = {".git", "node_modules", ".tmp", "tools", "backend", "__pycache__"}

ALT_RE = re.compile(r'<link\s+rel="alternate"[^>]*>', re.I)
HREFLANG_RE = re.compile(r'hreflang="([^"]+)"', re.I)
HREF_ATTR_RE = re.compile(r'href="([^"]*)"', re.I)
MENU_RE = re.compile(
    r'(<ul class="lang-switch__menu"[^>]*>)(.*?)(</ul>)', re.I | re.S
)
MENU_LINK_RE = re.compile(r'<a\b[^>]*?hreflang="([^"]+)"[^>]*?>', re.I)


def html_pages():
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in sorted(filenames):
            if name.endswith(".html"):
                full = os.path.join(dirpath, name)
                yield os.path.relpath(full, ROOT).replace(os.sep, "/")


def build(page_rel):
    """Return {language code: site-absolute path} for one page."""
    with open(os.path.join(ROOT, page_rel), encoding="utf-8", errors="replace") as handle:
        html = handle.read()

    mapping = {}
    for tag in ALT_RE.findall(html):
        lang = HREFLANG_RE.search(tag)
        href = HREF_ATTR_RE.search(tag)
        if not lang or not href:
            continue
        code = lang.group(1).strip()
        if code.lower() == "x-default":
            continue
        path = urllib.parse.urlparse(href.group(1).strip()).path
        if path:
            mapping[code] = path
    return html, mapping


def relative_href(origin_page, target_path):
    """Path from the page's own directory to a target HTML file.

    A target ending in "/" is a page folder; the link names its index.html so
    it opens directly, without a server that resolves folders. The result stays
    relative, so it keeps working at the domain root, inside a sub-directory and
    from a local preview server.
    """
    page_dir = posixpath.dirname(origin_page) or "."
    clean = target_path.lstrip("/")
    if clean.endswith("/") or clean == "":
        target = clean + "index.html" if clean else "index.html"
        return posixpath.relpath(target, page_dir)
    return posixpath.relpath(clean, page_dir)


def rewrite_menu(html, page_rel, mapping):
    changes = []

    def patch_menu(match):
        opening, body, closing = match.groups()

        def patch_link(link_match):
            code = link_match.group(1)
            if code not in mapping:
                return link_match.group(0)
            tag = link_match.group(0)
            href = relative_href(page_rel, mapping[code])
            if HREF_ATTR_RE.search(tag):
                new_tag = HREF_ATTR_RE.sub(
                    lambda m: 'href="%s"' % href, tag, count=1
                )
            else:
                new_tag = tag.replace("<a ", '<a href="%s" ' % href, 1)
            if new_tag != tag:
                changes.append((code, href))
            return new_tag

        return opening + MENU_LINK_RE.sub(patch_link, body) + closing

    updated = MENU_RE.sub(patch_menu, html)
    return updated, changes


def main():
    check_only = "--check" in sys.argv
    pages = 0
    touched = 0
    missing = []
    problems = []

    for page_rel in html_pages():
        html, mapping = build(page_rel)
        if not MENU_RE.search(html):
            continue
        pages += 1

        langs = [code for code in mapping if code != "en"]
        if not langs:
            problems.append("%s: no hreflang alternates" % page_rel)
            continue

        updated, changes = rewrite_menu(html, page_rel, mapping)
        if changes:
            touched += 1
            if not check_only:
                with open(os.path.join(ROOT, page_rel), "w", encoding="utf-8", newline="") as handle:
                    handle.write(updated)

        # Verify every menu entry now resolves to an existing page.
        for match in MENU_RE.finditer(updated):
            body = match.group(2)
            for link in MENU_LINK_RE.finditer(body):
                tag = link.group(0)
                code = link.group(1)
                href_match = HREF_ATTR_RE.search(tag)
                if not href_match:
                    problems.append("%s: menu link %s has no href" % (page_rel, code))
                    continue
                href = href_match.group(1)
                if href in ("", "#"):
                    problems.append("%s: menu link %s still points to %r" % (page_rel, code, href))
                    continue
                base = "/" + (posixpath.dirname(page_rel) + "/" if posixpath.dirname(page_rel) else "")
                target = posixpath.normpath(
                    posixpath.join(base, urllib.parse.urlparse(href).path)
                )
                if href.endswith("/"):
                    target = posixpath.join(target, "index.html")
                if not os.path.exists(os.path.join(ROOT, target.lstrip("/"))):
                    missing.append("%s: %s -> %s" % (page_rel, code, href))

    print("pages with language menu: %d" % pages)
    print("pages updated: %d" % touched)
    print("problems: %d" % len(problems))
    for item in problems[:40]:
        print("  " + item)
    print("missing targets: %d" % len(missing))
    for item in missing[:40]:
        print("  " + item)
    return 1 if problems or missing else 0


if __name__ == "__main__":
    sys.exit(main())
