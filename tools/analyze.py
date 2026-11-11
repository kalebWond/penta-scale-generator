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
from pathlib import Path

import postprocess

ROOT = Path(__file__).resolve().parent.parent
SONGS_DIR = ROOT / "public" / "songs"


def video_id_from(arg):
    m = re.search(r"(?:v=|youtu\.be/|/shorts/)([\w-]{11})", arg)
    if m:
        return m.group(1)
    if re.fullmatch(r"[\w-]{11}", arg):
        return arg
    sys.exit(f"Could not find a video id in: {arg}")


def ytdlp():
    return shutil.which("yt-dlp") or str(Path(sys.executable).parent / "yt-dlp")


def fetch_metadata(video_id):
    out = subprocess.run(
        [ytdlp(), "--no-playlist", "--skip-download", "--print",
         "%(title)s\t%(duration)s\t%(playable_in_embed)s",
         f"https://www.youtube.com/watch?v={video_id}"],
        capture_output=True, text=True, check=True,
    ).stdout.strip().splitlines()[-1]
    title, duration, embeddable = out.split("\t")
    return title, float(duration), embeddable == "True"


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
    ap.add_argument("video", help="YouTube video id or URL")
    ap.add_argument("--checkpoint", help="local Beat This! checkpoint (skips its slow download)")
    ap.add_argument("--out", default=str(SONGS_DIR), help="output folder (default: public/songs)")
    ap.add_argument("--threads", type=int, default=4)
    ap.add_argument("--keep-audio", action="store_true", help="do not delete the downloaded audio")
    ap.add_argument("--force", action="store_true", help="re-analyze even if the JSON already exists")
    args = ap.parse_args()

    video_id = video_id_from(args.video)
    out_path = Path(args.out) / f"{video_id}.json"
    if out_path.exists() and not args.force:
        sys.exit(f"{out_path} already exists (use --force to re-analyze)")

    os.nice(10)  # keep the machine usable while the models run
    import torch
    torch.set_num_threads(args.threads)

    title, duration, embeddable = fetch_metadata(video_id)
    print(f"{title} ({duration:.0f}s){'' if embeddable else '  [WARNING: embedding is disabled]'}")

    workdir = tempfile.mkdtemp(prefix="chords-")  # a fresh, empty folder for the download
    try:
        t0 = time.time()
        wav = download_audio(video_id, workdir)
        print(f"downloaded in {time.time() - t0:.0f}s")
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

    result = {"videoId": video_id, "title": title, "duration": duration, "embeddable": embeddable}
    result.update(postprocess.build_timeline(raw, beats, downbeats))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
    slash = sum(1 for c in result["chords"] if "bass" in c)
    print(f"wrote {out_path}: key {result['key']}, {result['bpm']} BPM, "
          f"{result['beatsPerBar']} beats/bar, {len(result['chords'])} chords ({slash} with a bass note)")


if __name__ == "__main__":
    main()
