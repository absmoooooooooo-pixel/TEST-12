#!/usr/bin/env python3
"""Repair UTF-8 text that was decoded as cp1252 and re-saved (double encoding).

Localized pages were produced by a pipeline that read UTF-8 bytes as cp1252
and wrote the result back as UTF-8, so every non-ASCII character rendered as
mojibake ("प्लेट" became "à¤ªà¥à¤²à¥‡à¤Ÿ"). Reversing that lossless step is
safe: text that is already valid UTF-8 maps to itself, and characters outside
the cp1252 repertoire (such as "←" or a language name in Arabic) are kept
untouched. Bytes that cannot form valid UTF-8 are preserved literally so a
single stray character cannot block the repair of a whole file.

Usage:
    python tools/fix_double_encoding.py            # report only
    python tools/fix_double_encoding.py --write    # rewrite files
"""

from __future__ import annotations

import argparse
import pathlib
import re
import sys

SUFFIXES = {".html", ".htm", ".js", ".json", ".css", ".txt", ".xml", ".webmanifest"}

# A cp1252-decoded UTF-8 lead byte followed by a decoded continuation byte.
# Legitimate prose in these languages does not produce this pairing, while a
# double-encoded file repeats it hundreds of times.
MOJIBAKE_PAIR = re.compile(r"[\u00c2-\u00f4][\u0080-\u00bf]")


def marker_score(text: str) -> int:
    return len(MOJIBAKE_PAIR.findall(text))


def _encode_char(char: str) -> bytes | None:
    code = ord(char)
    if code < 256:
        # Bytes 0x81, 0x8d, 0x8f, 0x90 and 0x9d are undefined in cp1252 but
        # still appear as C1 controls after the faulty decode, so map them
        # straight back instead of letting the codec reject them.
        return bytes([code])
    try:
        return char.encode("cp1252")
    except UnicodeEncodeError:
        return None


def reverse(text: str) -> str:
    """Return the text with the double encoding undone where it applies."""
    out: list[str] = []
    run: list[str] = []

    def flush() -> None:
        if not run:
            return
        raw = b"".join(_encode_char(char) for char in run)  # type: ignore[arg-type]
        run.clear()
        index = 0
        while index < len(raw):
            try:
                out.append(raw[index:].decode("utf-8"))
                return
            except UnicodeDecodeError as exc:
                end = index + exc.start
                out.append(raw[index:end].decode("utf-8", "replace"))
                # Keep the offending byte as-is instead of guessing.
                out.append(bytes([raw[end]]).decode("latin-1"))
                index = end + 1

    for char in text:
        if _encode_char(char) is None:
            flush()
            out.append(char)
        else:
            run.append(char)
    flush()
    return "".join(out)


def candidate_files(root: pathlib.Path):
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in SUFFIXES:
            continue
        if any(part in {".git", "node_modules", "tools"} for part in path.parts):
            continue
        yield path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="rewrite repaired files")
    args = parser.parse_args()

    root = pathlib.Path(__file__).resolve().parent.parent
    changed: list[pathlib.Path] = []

    for path in candidate_files(root):
        try:
            with path.open("r", encoding="utf-8", newline="") as handle:
                text = handle.read()
        except (UnicodeDecodeError, OSError):
            continue
        before = marker_score(text)
        if before == 0:
            continue
        repaired = reverse(text)
        if marker_score(repaired) >= before or "\ufffd" in repaired:
            print(f"  ! skipped {path.relative_to(root)} ({before} -> {marker_score(repaired)})")
            continue
        changed.append(path.relative_to(root))
        if args.write:
            with path.open("w", encoding="utf-8", newline="") as handle:
                handle.write(repaired)

    action = "repaired" if args.write else "would repair"
    print(f"{action}: {len(changed)} file(s)")
    for relative in changed:
        print(f"  {relative}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
