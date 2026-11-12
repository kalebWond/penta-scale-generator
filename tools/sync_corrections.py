#!/usr/bin/env python3
"""Copy the musicians' published chord corrections into the song files.

    python3 tools/sync_corrections.py                       # from the live site
    python3 tools/sync_corrections.py --site http://localhost:3000   # from the dev server

Corrections publish straight to the live site (Netlify Blobs, see netlify/shared/review.js), and
the site applies them as it loads a song. Copying them into public/songs/<id>.json as well keeps
them in git: the answer key for measuring the chord models, and a fallback if the endpoint is
down. analyze.py keeps a song's "corrections" when it re-analyzes it. Commit the result.
"""
import argparse
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SONG_DIRS = [ROOT / "public" / "songs", ROOT / "local-songs"]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--site", default="https://penta-scale.netlify.app")
    args = ap.parse_args()
    url = f"{args.site.rstrip('/')}/.netlify/functions/corrections?all=1"
    try:
        with urllib.request.urlopen(url, timeout=30) as res:
            published = json.loads(res.read())
    except Exception as e:  # noqa: BLE001 - any failure: say what and stop
        sys.exit(f"Could not read {url}: {e}")

    changed = 0
    for song_id, record in sorted(published.items()):
        path = next((d / f"{song_id}.json" for d in SONG_DIRS if (d / f"{song_id}.json").exists()), None)
        if path is None:
            print(f"{song_id}: corrections by {record.get('by')}, but no such song here (skipped)")
            continue
        song = json.loads(path.read_text())
        if song.get("corrections") == record:
            continue
        song["corrections"] = record
        path.write_text(json.dumps(song, ensure_ascii=False, separators=(",", ":")))
        changed += 1
        print(f"{song['title'][:50]}: {len(record.get('edits', []))} edits by {record.get('by')} ({record.get('at', '')[:10]})")
    print(f"{changed} song{'s' if changed != 1 else ''} updated, {len(published)} with corrections")


if __name__ == "__main__":
    main()
