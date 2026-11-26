"""Point every internal page link at a real HTML file.

A link such as ``/es/calculators/plate/`` only opens the calculator when the
site is served by something that resolves a directory to its ``index.html``.
Opened straight from disk (or by any static viewer without index resolution)
that same link shows a folder listing, and the visitor has to click
``index.html`` by hand.

Every link written by this script names the HTML file itself, so the page
opens immediately in every environment. The folder structure, the language
prefixes and the clean SEO URLs in <link rel="canonical"> /
<link rel="alternate"> are untouched.

Usage:  python tools/fix_page_links.py [--check]
"""

import os
import posixpath
import re
import sys
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_DIRS = {".git", "node_modules", ".tmp", "tools", "backend", "__pycache__", ".backup"}

ANCHOR_RE = re.compile(r'<a\b[^>]*?>', re.I)
HREF_RE = re.compile(r'href="([^"]*)"', re.I)
EXTERNAL_PREFIXES = ("#", "http://", "https://", "//", "mailto:", "tel:", "javascript:", "data:")


def html_pages():
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in sorted(filenames):
            if name.endswith(".html"):
                yield os.path.relpath(os.path.join(dirpath, name), ROOT).replace(os.sep, "/")


def find_index(path):
    """If the site-absolute path names a folder with an index.html, return it."""
    clean = path.lstrip("/")
    if clean == "" or clean.endswith("/"):
        candidate = clean + "index.html"
    else:
        candidate = clean
        if not os.path.exists(os.path.join(ROOT, candidate)):
            if os.path.isdir(os.path.join(ROOT, candidate)):
                candidate = candidate.rstrip("/") + "/index.html"
            else:
                return None
    if os.path.isfile(os.path.join(ROOT, candidate)):
        return "/" + candidate
    return None


def relative_href(page_rel, target_path):
    page_dir = posixpath.dirname(page_rel) or "."
    return posixpath.relpath(target_path.lstrip("/"), page_dir)


def rewrite_link(href, page_rel, page_url):
    """Return the rewritten href, or None when it already names a page."""
    stripped = href.strip()
    if not stripped or stripped.startswith(EXTERNAL_PREFIXES):
        return None

    parsed = urllib.parse.urlsplit(stripped)
    if not parsed.path:
        return None  # pure query or fragment

    resolved = urllib.parse.urljoin("http://site" + page_url, parsed.path)
    target_path = urllib.parse.urlsplit(resolved).path

    index_path = find_index(target_path)
    if index_path is None:
        return None

    already = target_path.endswith("/index.html") or target_path == "/index.html"
    if already:
        return None

    new_path = relative_href(page_rel, index_path)
    rebuilt = urllib.parse.urlunsplit(("", "", new_path, parsed.query, parsed.fragment))
    return rebuilt


def main():
    check_only = "--check" in sys.argv
    pages = 0
    rewritten_links = 0
    touched_pages = 0
    broken = []
    leftover = []
    seen_rewrites = {}

    for page_rel in html_pages():
        with open(os.path.join(ROOT, page_rel), encoding="utf-8", errors="replace") as handle:
            html = handle.read()
        page_url = "/" + (posixpath.dirname(page_rel) + "/" if posixpath.dirname(page_rel) else "")
        pages += 1
        page_changes = 0

        def patch(match):
            nonlocal page_changes
            tag = match.group(0)
            href_match = HREF_RE.search(tag)
            if not href_match:
                return tag
            original = href_match.group(1)
            new_href = rewrite_link(original, page_rel, page_url)
            if new_href is None or new_href == original:
                return tag
            page_changes += 1
            seen_rewrites[original + "  ->  " + new_href] = seen_rewrites.get(
                original + "  ->  " + new_href, 0
            ) + 1
            return tag.replace('href="%s"' % original, 'href="%s"' % new_href, 1)

        updated = ANCHOR_RE.sub(patch, html)
        if page_changes:
            touched_pages += 1
            rewritten_links += page_changes
            if not check_only:
                with open(os.path.join(ROOT, page_rel), "w", encoding="utf-8", newline="") as handle:
                    handle.write(updated)
            html = updated

        # Every remaining anchor must resolve to a real file, never a folder.
        for tag in ANCHOR_RE.findall(html):
            href_match = HREF_RE.search(tag)
            if not href_match:
                continue
            href = href_match.group(1).strip()
            if not href or href.startswith(EXTERNAL_PREFIXES):
                continue
            parsed = urllib.parse.urlsplit(href)
            if not parsed.path:
                continue
            target = urllib.parse.urlsplit(
                urllib.parse.urljoin("http://site" + page_url, parsed.path)
            ).path
            local = target.lstrip("/")
            if target.endswith("/"):
                leftover.append("%s -> %s (folder)" % (page_rel, href))
                continue
            if not os.path.isfile(os.path.join(ROOT, local)):
                broken.append("%s -> %s (%s)" % (page_rel, href, local))

    print("pages scanned: %d" % pages)
    print("pages updated: %d" % touched_pages)
    print("links rewritten: %d" % rewritten_links)
    print("distinct rewrites: %d" % len(seen_rewrites))
    for item in sorted(seen_rewrites)[:15]:
        print("   " + item)
    print("remaining folder links: %d" % len(leftover))
    for item in leftover[:20]:
        print("   " + item)
    print("broken links: %d" % len(broken))
    for item in broken[:20]:
        print("   " + item)
    return 1 if leftover or broken else 0


if __name__ == "__main__":
    sys.exit(main())
