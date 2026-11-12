#!/usr/bin/env python3
"""Analyze a YouTube video or an audio file and write the song's chord timeline.

    ~/chord-env/bin/python tools/analyze.py <video id or url> [--checkpoint PATH]
    ~/chord-env/bin/python tools/analyze.py --file song.mp3 [--title "Artist - Title"]
    ~/chord-env/bin/python tools/analyze.py <id> --reprocess     # post-processing only

A video: downloads its audio to a temporary folder, runs Beat This! (beats, downbeats) and
lv-chordia (chords), post-processes the result and deletes the audio. Only the timeline is kept,
in public/songs/<videoId>.json. Local personal use only: YouTube's terms forbid downloading.

A file: the same analysis; the song and a copy of the file go to local-songs/ (not in git, not
deployed), which only the dev server serves.

The models' raw output is cached in tools/.cache/raw/<id>.json, so --reprocess can re-run the
post-processing (after changing postprocess.py) in a second, without the audio or the models.
Progress is printed as "» <stage>" lines, which the app's "Add songs" panel reads.
"""
import argparse
import base64
import hashlib
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

import chordmini
import postprocess

ROOT = Path(__file__).resolve().parent.parent
SONGS_DIR = ROOT / "public" / "songs"
LOCAL_DIR = ROOT / "local-songs"
RAW_DIR = ROOT / "tools" / ".cache" / "raw"
# Each song as other chord models hear it (ChordMini's BTC, BTC CL, ChordNet), on the same beats,
# for the dev app's chord-model switch: local-songs/models/<id>/<model>.json. Not deployed.
MODELS_DIR = LOCAL_DIR / "models"


def stage(name):
    """A progress line for the app's "Add songs" panel (and anyone watching the terminal)."""
    print(f"» {name}", flush=True)


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


INDEX_FIELDS = ("videoId", "source", "audio", "title", "duration", "key", "tonic", "mode", "bpm", "analyzedAt",
                "pick", "manual")
OPTIONAL_FIELDS = ("source", "audio", "manual")   # left out of the list when not set

# Set by hand in a song's JSON, and kept when the song is analyzed again:
#   "pick": true     show it in the app's Recommended row
#   "manual": {...}  what the models can't tell, e.g. {"beatsPerBar": 3} for a 6/8 song the beat
#                    model counted in 6, or {"scaleId": "TIZITA-1", "degree": 1, "tonic": "D"}
#                    for Tizita major from the 2nd (see src/features/songs/timeline.js)
HAND_SET = ("pick", "manual", "corrections")


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
            for k in OPTIONAL_FIELDS:
                if not entry[k]:
                    del entry[k]
            songs.append(entry)
    songs.sort(key=lambda s: (s["title"] or "").lower())
    Path(songs_dir, "index.json").write_text(json.dumps(songs, ensure_ascii=False, indent=1) + "\n")
    return songs


def file_id(path):
    """An 11-character id from the file's contents, shaped like a video id so the app's
    /songs/<id> route takes it. The same file always gets the same id."""
    digest = hashlib.sha256(Path(path).read_bytes()).digest()
    return base64.urlsafe_b64encode(digest).decode()[:11]


def file_metadata(path):
    """(title, duration) of an audio file, from its tags or else its name."""
    proc = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration:format_tags=title,artist",
         "-of", "json", str(path)],
        capture_output=True, text=True,
    )
    if proc.returncode != 0:
        sys.exit(f"Could not read {Path(path).name}: is it an audio file?")
    fmt = json.loads(proc.stdout).get("format", {})
    tags = {k.lower(): v for k, v in (fmt.get("tags") or {}).items()}
    title = " - ".join(t for t in (tags.get("artist"), tags.get("title")) if t) or Path(path).stem
    try:
        duration = float(fmt.get("duration"))
    except (TypeError, ValueError):
        sys.exit(f"{Path(path).name} has no duration: is it an audio file?")
    return title, duration


def convert_audio(path, workdir):
    """Mono 22.05 kHz WAV of a local file, which is all the models need."""
    wav = Path(workdir) / "audio.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(path), "-ac", "1", "-ar", "22050", str(wav)],
                   check=True)
    return str(wav)


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
    ap.add_argument("video", nargs="?", help="YouTube video id or URL (or, with --reprocess, a song id)")
    ap.add_argument("--file", help="analyze a local audio file (mp3, m4a, wav, ...) instead of a video")
    ap.add_argument("--title", help="the song's title (default: from a video's or a file's tags)")
    ap.add_argument("--reindex", action="store_true",
                    help="only rebuild the song lists (index.json) and exit")
    ap.add_argument("--reprocess", action="store_true",
                    help="re-run only the post-processing, from the cached model output")
    ap.add_argument("--checkpoint", help="local Beat This! checkpoint (skips its slow download)")
    ap.add_argument("--out", help="output folder (default: public/songs, or local-songs for a file)")
    ap.add_argument("--threads", type=int, default=4)
    ap.add_argument("--keep-audio", action="store_true", help="do not delete the downloaded audio")
    ap.add_argument("--force", action="store_true", help="re-analyze even if the song already exists")
    ap.add_argument("--allow-unembeddable", action="store_true",
                    help="analyze even if the video cannot be embedded (the app cannot play it)")
    ap.add_argument("--no-other-models", action="store_true",
                    help="run only lv-chordia, not ChordMini's models (they run when ChordMini is set up)")
    ap.add_argument("--add-models", action="store_true",
                    help="for an analyzed song: fetch its audio again and run only ChordMini's models")
    args = ap.parse_args()

    if args.reindex:
        for folder in ([Path(args.out)] if args.out else [SONGS_DIR, LOCAL_DIR]):
            if folder.is_dir():
                songs = write_index(folder)
                print(f"wrote {folder / 'index.json'}: {len(songs)} songs")
        return

    if args.reprocess:
        reprocess(args)
        return

    if args.add_models:
        add_models(args)
        return

    if args.file:
        src = Path(args.file).expanduser()
        if not src.is_file():
            sys.exit(f"No such file: {src}")
        stage("checking")
        song_id = file_id(src)
        title, duration = file_metadata(src)
        out_dir = Path(args.out) if args.out else LOCAL_DIR
        base = {"videoId": song_id, "source": "file", "audio": song_id + src.suffix.lower(),
                "title": args.title or title, "duration": duration}
    elif args.video:
        stage("checking")
        song_id = video_id_from(args.video)
        title, duration, embeddable = fetch_metadata(song_id)
        if embeddable is False and not args.allow_unembeddable:
            sys.exit(f"{title}: embedding is disabled, so the app cannot play it "
                     "(use --allow-unembeddable to analyze anyway)")
        out_dir = Path(args.out) if args.out else SONGS_DIR
        base = {"videoId": song_id, "title": args.title or title, "duration": duration, "embeddable": embeddable}
    else:
        ap.error("a video id or URL, or --file, is required (or --reindex)")

    note = "" if args.file or base["embeddable"] else (
        "  [embedding is disabled]" if base["embeddable"] is False else "  [embedding unknown]")
    print(f"{base['title']} ({base['duration']:.0f}s){note}", flush=True)
    out_path = out_dir / f"{song_id}.json"
    if out_path.exists() and not args.force:
        stage(f"exists {song_id}")
        sys.exit(f"{base['title']} is already analyzed ({out_path.name}); use --force to re-analyze")

    os.nice(10)  # keep the machine usable while the models run
    workdir = tempfile.mkdtemp(prefix="chords-")  # a fresh, empty folder for the audio
    try:
        t0 = time.time()
        if args.file:
            stage("converting")
            wav = convert_audio(src, workdir)
        else:
            stage("downloading")
            wav = download_audio(song_id, workdir)
        print(f"audio ready in {time.time() - t0:.0f}s", flush=True)
        import torch
        torch.set_num_threads(args.threads)
        stage("beats")
        t0 = time.time()
        beats, downbeats = run_beats(wav, args.checkpoint)
        print(f"beats in {time.time() - t0:.0f}s", flush=True)
        stage("chords")
        t0 = time.time()
        raw = run_chords(wav)
        print(f"chords in {time.time() - t0:.0f}s", flush=True)
        save_notes(song_id, wav)
        if not args.no_other_models:
            run_other_models(song_id, wav)
    finally:
        if args.keep_audio:
            print(f"audio kept in {workdir}")
        else:
            shutil.rmtree(workdir, ignore_errors=True)

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    (RAW_DIR / f"{song_id}.json").write_text(json.dumps(
        {"beats": beats, "downbeats": downbeats, "chords": raw}, separators=(",", ":")))
    if args.file:
        out_dir.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, out_dir / base["audio"])
    save(out_path, base, raw, beats, downbeats)
    write_model_versions(song_id, base, beats, downbeats)


CHROMA_HOP = 2048   # about 10.8 frames a second at 22.05 kHz


def save_notes(song_id, wav):
    """Which notes sound, about ten times a second, cached for the chord referee (referee.py):
    "chroma" from the harmonic part of the whole mix, "bass" from the two lowest octaves
    (C1-B2), each frame 12 numbers (C .. B) from 0 to 99. A few hundred KB per song, so songs
    can be re-judged later without their audio."""
    import librosa
    import numpy as np
    stage("notes")
    y, sr = librosa.load(wav, sr=22050, mono=True)
    harmonic = librosa.effects.harmonic(y)
    chroma = librosa.feature.chroma_cqt(y=harmonic, sr=sr, hop_length=CHROMA_HOP)
    bass = librosa.feature.chroma_cqt(y=harmonic, sr=sr, hop_length=CHROMA_HOP,
                                      fmin=librosa.note_to_hz("C1"), n_octaves=2)
    to_ints = lambda m: np.rint(np.clip(m, 0, 1) * 99).astype(int).T.tolist()
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    (RAW_DIR / f"{song_id}.notes.json").write_text(json.dumps(
        {"fps": sr / CHROMA_HOP, "chroma": to_ints(chroma), "bass": to_ints(bass)}, separators=(",", ":")))


def run_other_models(song_id, wav):
    """Run each of ChordMini's models on the audio and cache its chords (skipped, with a note,
    when ChordMini isn't set up)."""
    why = chordmini.available()
    if why:
        print(f"other chord models skipped: {why}", flush=True)
        return
    stage("other models")
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    for name in chordmini.MODELS:
        t0 = time.time()
        try:
            segments = chordmini.run(name, wav)
        except RuntimeError as e:
            print(f"warning: {e}", flush=True)
            continue
        (RAW_DIR / f"{song_id}.{name}.json").write_text(json.dumps({"chords": segments}, separators=(",", ":")))
        print(f"{chordmini.MODELS[name][2]} chords in {time.time() - t0:.0f}s", flush=True)


def write_model_versions(song_id, base, beats, downbeats):
    """The song as each cached ChordMini model hears it: the same post-processing on the same
    beats, so the chords are the only difference. Plus an index the app reads."""
    versions = []
    for name, (_, _, label) in chordmini.MODELS.items():
        cache = RAW_DIR / f"{song_id}.{name}.json"
        if not cache.exists():
            continue
        chords = json.loads(cache.read_text())["chords"]
        result = dict(base, model=name, modelLabel=label)
        result.update(postprocess.build_timeline(chords, beats, downbeats))
        folder = MODELS_DIR / song_id
        folder.mkdir(parents=True, exist_ok=True)
        (folder / f"{name}.json").write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
        versions.append({"model": name, "label": label, "key": result["key"], "chords": len(result["chords"])})
    if versions:
        (MODELS_DIR / song_id / "index.json").write_text(json.dumps(versions, ensure_ascii=False))
        print("other models: " + ", ".join(f"{v['label']} key {v['key']}, {v['chords']} chords" for v in versions),
              flush=True)


def model_suggestions(song_id, beats, downbeats):
    """What the other chord models heard, compact, for the correction editor's suggestions:
    {"btc-cl": [[t, "D/F#"], ...], ...}. The same post-processing as the main chords."""
    out = {}
    for name in chordmini.MODELS:
        cache = RAW_DIR / f"{song_id}.{name}.json"
        if cache.exists():
            timeline = postprocess.build_timeline(json.loads(cache.read_text())["chords"], beats, downbeats)
            out[name] = [[c["t"], c["c"] + ("/" + c["bass"] if "bass" in c else "")] for c in timeline["chords"]]
    return out


def add_suggestions(out_path, song_id, beats, downbeats):
    """Put the other models' chords into a song's file (after they've run on it)."""
    song = json.loads(out_path.read_text())
    suggestions = model_suggestions(song_id, beats, downbeats)
    if suggestions:
        song["suggestions"] = suggestions
        out_path.write_text(json.dumps(song, ensure_ascii=False, separators=(",", ":")))


def find_song(song_id, folders):
    """(path, data) of an analyzed song, or exit."""
    path = next((f / f"{song_id}.json" for f in folders if (f / f"{song_id}.json").exists()), None)
    if path is None:
        sys.exit(f"No song {song_id}")
    return path, json.loads(path.read_text())


def add_models(args):
    """For a song already analyzed: get its audio again and run only ChordMini's models."""
    if not args.video:
        sys.exit("--add-models needs the song's id")
    why = chordmini.available()
    if why:
        sys.exit(why)
    song_id = args.video if re.fullmatch(VIDEO_ID, args.video) else video_id_from(args.video)
    cache = RAW_DIR / f"{song_id}.json"
    if not cache.exists():
        sys.exit(f"No cached model output for {song_id}: analyze it with --force first")
    song_path, song = find_song(song_id, [Path(args.out)] if args.out else [SONGS_DIR, LOCAL_DIR])
    print(f"{song['title']} ({song['duration']:.0f}s)", flush=True)
    workdir = tempfile.mkdtemp(prefix="chords-")
    try:
        if song.get("source") == "file":
            stage("converting")
            wav = convert_audio(LOCAL_DIR / song["audio"], workdir)
        else:
            stage("downloading")
            wav = download_audio(song_id, workdir)
        save_notes(song_id, wav)
        run_other_models(song_id, wav)
    finally:
        shutil.rmtree(workdir, ignore_errors=True)
    raw = json.loads(cache.read_text())
    write_model_versions(song_id, song_base(song), raw["beats"], raw["downbeats"])
    add_suggestions(song_path, song_id, raw["beats"], raw["downbeats"])


def song_base(song):
    """What a song's file says about the song itself, apart from the analysis."""
    return {k: song[k] for k in ("videoId", "source", "audio", "title", "duration", "embeddable") if k in song}


def save(out_path, base, raw, beats, downbeats):
    """Post-process and write the song, keeping what was set by hand; rebuild the song list."""
    stage("processing")
    result = dict(base, analyzedAt=date.today().isoformat())
    if out_path.exists():   # re-analyzing keeps what was set by hand
        try:
            before = json.loads(out_path.read_text())
            result.update({k: before[k] for k in HAND_SET if before.get(k)})
        except (OSError, json.JSONDecodeError):
            pass
    result.update(postprocess.build_timeline(raw, beats, downbeats))
    suggestions = model_suggestions(base["videoId"], beats, downbeats)
    if suggestions:
        result["suggestions"] = suggestions

    stage("saving")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
    write_index(out_path.parent)
    slash = sum(1 for c in result["chords"] if "bass" in c)
    print(f"wrote {out_path}: key {result['key']}, {result['bpm']} BPM, "
          f"{result['beatsPerBar']} beats/bar, {len(result['chords'])} chords ({slash} with a bass note)", flush=True)
    stage(f"saved {result['videoId']}")


def reprocess(args):
    """Post-processing only: from the cached model output, into the song's existing file."""
    if not args.video:
        sys.exit("--reprocess needs the song's id")
    song_id = args.video if re.fullmatch(VIDEO_ID, args.video) else video_id_from(args.video)
    cache = RAW_DIR / f"{song_id}.json"
    if not cache.exists():
        sys.exit(f"No cached model output for {song_id}: analyze it with --force first")
    out_path, before = find_song(song_id, [Path(args.out)] if args.out else [SONGS_DIR, LOCAL_DIR])
    base = song_base(before)
    if args.title:
        base["title"] = args.title
    raw = json.loads(cache.read_text())
    save(out_path, base, raw["chords"], raw["beats"], raw["downbeats"])
    write_model_versions(song_id, base, raw["beats"], raw["downbeats"])


if __name__ == "__main__":
    main()
