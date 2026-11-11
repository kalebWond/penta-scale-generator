#!/usr/bin/env python3
"""Analyze a YouTube video and write public/songs/<videoId>.json.

    ~/chord-env/bin/python tools/analyze.py <video id or url> [--checkpoint PATH]

Downloads the audio to a temporary folder, runs Beat This! (beats, downbeats) and
lv-chordia (chords), post-processes the result and deletes the audio. Only the
timeline JSON is kept. Local personal use only: YouTube's terms forbid downloading.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from datetime import date
from pathlib import Path

import postprocess

ROOT = Path(__file__).resolve().parent.parent
SONGS_DIR = ROOT / "public" / "songs"


VIDEO_ID = r"[\w-]{11}"


def video_id_from(arg):
    """A video id from an id or any common YouTube URL (watch, youtu.be, shorts, embed, live)."""
    if re.fullmatch(VIDEO_ID, arg):
        return arg
    m = re.search(rf"(?:[?&]v=|youtu\.be/|/(?:shorts|embed|live|v)/)({VIDEO_ID})(?![\w-])", arg)
    if m:
        return m.group(1)
    sys.exit(f"Could not find a video id in: {arg}")


def ytdlp():
    return shutil.which("yt-dlp") or str(Path(sys.executable).parent / "yt-dlp")


def parse_metadata(info):
    """yt-dlp's JSON for one video -> (title, duration, embeddable).

    embeddable is True, False, or None when YouTube did not say.
    Raises ValueError for a video that cannot be analyzed.
    """
    if info.get("is_live"):
        raise ValueError("it is a live stream")
    duration = info.get("duration")
    if not isinstance(duration, (int, float)) or duration <= 0:
        raise ValueError("it has no duration (live stream or upcoming premiere?)")
    embeddable = info.get("playable_in_embed")
    return info.get("title") or info.get("id") or "", float(duration), (
        embeddable if isinstance(embeddable, bool) else None)


def fetch_metadata(video_id):
    proc = subprocess.run(
        [ytdlp(), "--no-playlist", "-J", f"https://www.youtube.com/watch?v={video_id}"],
        capture_output=True, text=True,
    )
    if proc.returncode != 0:
        lines = proc.stderr.strip().splitlines()
        sys.exit(f"yt-dlp could not read {video_id}: {lines[-1] if lines else 'no output'}")
    try:
        return parse_metadata(json.loads(proc.stdout))
    except json.JSONDecodeError:
        sys.exit(f"yt-dlp returned unreadable metadata for {video_id}")
    except ValueError as e:
        sys.exit(f"Cannot analyze {video_id}: {e}")


INDEX_FIELDS = ("videoId", "title", "duration", "key", "tonic", "mode", "bpm", "analyzedAt", "pick", "manual")

# Set by hand in a song's JSON, and kept when the song is analyzed again:
#   "pick": true     show it in the app's Recommended row
#   "manual": {...}  what the models can't tell, e.g. {"beatsPerBar": 3} for a 6/8 song the beat
#                    model counted in 6, or {"scaleId": "TIZITA-1", "degree": 1, "tonic": "D"}
#                    for Tizita major from the 2nd (see src/features/songs/timeline.js)
HAND_SET = ("pick", "manual")


def write_index(songs_dir):
    """Rebuild songs_dir/index.json (the app's song list) from every song JSON there.

    "analyzedAt" (a date) orders "newest"; a song analyzed before it existed gets its file's date.
    "pick": true in a song's JSON puts it in the app's Recommended row.
    """
    songs = []
    for path in sorted(Path(songs_dir).glob("*.json")):
        if path.name == "index.json":
            continue
        try:
            data = json.loads(path.read_text())
        except (OSError, json.JSONDecodeError):
            continue
        if isinstance(data, dict) and data.get("videoId"):
            entry = {k: data.get(k) for k in INDEX_FIELDS}
            entry["analyzedAt"] = entry["analyzedAt"] or date.fromtimestamp(path.stat().st_mtime).isoformat()
            entry["pick"] = bool(entry["pick"])
            if not entry["manual"]:
                del entry["manual"]
            songs.append(entry)
    songs.sort(key=lambda s: (s["title"] or "").lower())
    Path(songs_dir, "index.json").write_text(json.dumps(songs, ensure_ascii=False, indent=1) + "\n")
    return songs


def download_audio(video_id, workdir):
    """Mono 22.05 kHz WAV, which is all the models need."""
    subprocess.run(
        [ytdlp(), "--no-playlist", "--newline", "-f", "bestaudio", "-x", "--audio-format", "wav",
         "--postprocessor-args", "ffmpeg:-ac 1 -ar 22050",
         "-o", str(Path(workdir) / "%(id)s.%(ext)s"),
         f"https://www.youtube.com/watch?v={video_id}"],
        check=True,
    )
    return str(Path(workdir) / f"{video_id}.wav")


def run_beats(wav, checkpoint):
    from beat_this.inference import File2Beats
    beats, downbeats = File2Beats(checkpoint_path=checkpoint or "final0", device="cpu", dbn=False)(wav)
    return [float(t) for t in beats], [float(t) for t in downbeats]


def run_chords(wav):
    from lv_chordia.chord_recognition import chord_recognition
    # "submission" is the large vocabulary: it labels bass notes (D/F#), which the
    # 25-chord "ismir2017" vocabulary turns into the wrong chord (F#m).
    return chord_recognition(audio_path=wav, chord_dict_name="submission")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video", nargs="?", help="YouTube video id or URL")
    ap.add_argument("--reindex", action="store_true",
                    help="only rebuild the song list (index.json) and exit")
    ap.add_argument("--checkpoint", help="local Beat This! checkpoint (skips its slow download)")
    ap.add_argument("--out", default=str(SONGS_DIR), help="output folder (default: public/songs)")
    ap.add_argument("--threads", type=int, default=4)
    ap.add_argument("--keep-audio", action="store_true", help="do not delete the downloaded audio")
    ap.add_argument("--force", action="store_true", help="re-analyze even if the JSON already exists")
    ap.add_argument("--allow-unembeddable", action="store_true",
                    help="analyze even if the video cannot be embedded (the app cannot play it)")
    args = ap.parse_args()

    if args.reindex:
        songs = write_index(args.out)
        print(f"wrote {Path(args.out) / 'index.json'}: {len(songs)} songs")
        return
    if not args.video:
        ap.error("a video id or URL is required (or --reindex)")

    video_id = video_id_from(args.video)
    out_path = Path(args.out) / f"{video_id}.json"
    if out_path.exists() and not args.force:
        sys.exit(f"{out_path} already exists (use --force to re-analyze)")

    # Cheap checks first, so a bad video fails before any download or model loading.
    title, duration, embeddable = fetch_metadata(video_id)
    if embeddable is False and not args.allow_unembeddable:
        sys.exit(f"{title}: embedding is disabled, so the app cannot play it "
                 "(use --allow-unembeddable to analyze anyway)")
    note = "" if embeddable else "  [embedding is disabled]" if embeddable is False else "  [embedding unknown]"
    print(f"{title} ({duration:.0f}s){note}")

    os.nice(10)  # keep the machine usable while the models run
    workdir = tempfile.mkdtemp(prefix="chords-")  # a fresh, empty folder for the download
    try:
        t0 = time.time()
        wav = download_audio(video_id, workdir)
        print(f"downloaded in {time.time() - t0:.0f}s")
        import torch
        torch.set_num_threads(args.threads)
        t0 = time.time()
        beats, downbeats = run_beats(wav, args.checkpoint)
        print(f"beats in {time.time() - t0:.0f}s")
        t0 = time.time()
        raw = run_chords(wav)
        print(f"chords in {time.time() - t0:.0f}s")
    finally:
        if args.keep_audio:
            print(f"audio kept in {workdir}")
        else:
            shutil.rmtree(workdir, ignore_errors=True)

    result = {"videoId": video_id, "title": title, "duration": duration, "embeddable": embeddable,
              "analyzedAt": date.today().isoformat()}
    if out_path.exists():   # re-analyzing keeps what was set by hand
        try:
            before = json.loads(out_path.read_text())
            result.update({k: before[k] for k in HAND_SET if before.get(k)})
        except (OSError, json.JSONDecodeError):
            pass
    result.update(postprocess.build_timeline(raw, beats, downbeats))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
    write_index(out_path.parent)
    slash = sum(1 for c in result["chords"] if "bass" in c)
    print(f"wrote {out_path}: key {result['key']}, {result['bpm']} BPM, "
          f"{result['beatsPerBar']} beats/bar, {len(result['chords'])} chords ({slash} with a bass note)")


if __name__ == "__main__":
    main()
