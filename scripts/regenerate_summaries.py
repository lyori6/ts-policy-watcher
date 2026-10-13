#!/usr/bin/env python3
"""One-off: regenerate initial_summary + matrix for every policy from its production
snapshot, and strip preamble/meta lines from existing last_update_summary text.

Usage: python scripts/regenerate_summaries.py [--dry-run] [--slug SLUG]
Run from the repo root with CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN and/or
GEMINI_API_KEY (and optionally GEMINI_API_KEY_2) set.
"""
import argparse
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fetch import clean_html  # noqa: E402
import diff_and_notify as dn  # noqa: E402
from ai_utils import strip_preamble  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SLEEP_SECONDS = 2


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="print results, do not write summaries.json")
    ap.add_argument("--force", action="store_true", help="redo policies that already have a matrix")
    ap.add_argument("--slug", help="only regenerate this policy slug")
    args = ap.parse_args()

    policies = json.loads((ROOT / "platform_urls.json").read_text())
    summaries_path = ROOT / "summaries.json"
    summaries = json.loads(summaries_path.read_text())

    slugs = [p["slug"] for p in policies]
    if args.slug:
        if args.slug not in slugs:
            sys.exit(f"Unknown slug: {args.slug}")
        slugs = [args.slug]

    done = 0
    for slug in slugs:
        if not args.force and not args.slug and summaries.get(slug, {}).get("matrix"):
            print(f"[skip] {slug}: already regenerated (use --force)")
            continue
        snap = ROOT / "snapshots" / "production" / slug / "snapshot.html"
        if not snap.exists():
            print(f"[skip] {slug}: no snapshot")
            continue
        text = clean_html(snap.read_text(encoding="utf-8"), slug)[:20000]
        if len(text.split()) < 10:
            print(f"[skip] {slug}: snapshot text too short")
            continue

        summary = dn.get_ai_summary(text, True)
        time.sleep(SLEEP_SECONDS)
        matrix = dn.get_policy_matrix(text)
        time.sleep(SLEEP_SECONDS)
        if not summary:
            print(f"[fail] {slug}: no summary generated, leaving entry untouched")
            continue

        entry = summaries.setdefault(slug, {
            "policy_name": slug.replace("-", " ").title(),
            "last_update_summary": "Initial version.",
            "last_updated": None,
        })
        entry["initial_summary"] = summary
        if matrix:
            entry["matrix"] = matrix
        upd = entry.get("last_update_summary")
        if upd and upd.strip() != "Initial version.":
            entry["last_update_summary"] = strip_preamble(upd) or upd

        print(f"[ok] {slug}\n  summary: {summary[:200]!r}\n  matrix: {matrix}")
        done += 1
        if not args.dry_run:
            summaries_path.write_text(json.dumps(summaries, indent=2))

    print(f"Done: {done} policies {'(dry run, nothing written)' if args.dry_run else 'written'}.")


if __name__ == "__main__":
    main()
