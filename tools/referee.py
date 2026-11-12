#!/usr/bin/env python3
"""Judge the chord models by the audio: where they disagree, whose chord do the sounding notes fit?

    ~/chord-env/bin/python tools/referee.py [song id ...]      (default: every song)

No musician needed. For each beat of a song, the notes recorded at analysis time
(tools/.cache/raw/<id>.notes.json, see analyze.save_notes) are averaged, and each candidate
chord is scored by
  - fit:  how well its three notes match the sounding notes (cosine of the 12-note profile with
          the chord's notes), plus
  - bass: how strongly its root sounds in the bass (C1-B2) compared with the strongest bass note,
          which tells apart chords that share two notes (C and Am, Dm and F).

A note profile is a blunt tool, blunter than the models: a melody note or a held pad can tip it.
So the referee is checked first, on the beats where all four models agree: how often the agreed
chord beats every other chord the song uses, at each margin. Only verdicts with a margin that was
right at least 90% of the time there count (the "trusted margin").
"""
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "tools" / ".cache" / "raw"
MODELS = {"lv": "lv-chordia", "btc": "BTC", "btc-cl": "BTC CL", "chordnet": "ChordNet"}
BASS_WEIGHT = 0.5
TRUST = 0.90           # how often the referee must be right at a margin for it to count
MARGINS = [0.0, 0.02, 0.04, 0.06, 0.08, 0.1, 0.12, 0.15, 0.2, 0.25]

PC = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]


def parse(name):
    """'Bbm' -> (10, 'min'); 'N' -> None."""
    if not name or name == "N":
        return None
    root = (PC[name[0]] + name[1:].count("#") - name[1:].count("b")) % 12
    quality = "dim" if name.endswith("dim") else "min" if name.endswith("m") else "maj"
    return root, quality


def label(chord):
    root, quality = chord
    return NAMES[root] + {"maj": "", "min": "m", "dim": "dim"}[quality]


def template(chord):
    root, quality = chord
    third = 4 if quality == "maj" else 3
    fifth = 6 if quality == "dim" else 7
    t = np.zeros(12)
    t[[root, (root + third) % 12, (root + fifth) % 12]] = 1
    return t / np.linalg.norm(t)


def score(chord, chroma, bass):
    fit = float(template(chord) @ chroma)
    return fit + BASS_WEIGHT * float(bass[chord[0]])


def load_song(song_id):
    for folder in (ROOT / "public" / "songs", ROOT / "local-songs"):
        path = folder / f"{song_id}.json"
        if path.exists():
            return json.loads(path.read_text())
    return None


def chord_at_beats(song, beats):
    """The chord sounding in the middle of each beat (None for no chord)."""
    times = [c["t"] for c in song["chords"]]
    out = []
    for i, b in enumerate(beats):
        mid = (b + beats[i + 1]) / 2 if i + 1 < len(beats) else b + 0.2
        k = np.searchsorted(times, mid, side="right") - 1
        out.append(parse(song["chords"][k]["c"]) if k >= 0 else None)
    return out


def beat_notes(notes, beats):
    """(chroma, bass) per beat: averaged over the beat, chroma scaled to length 1, bass to its
    loudest note = 1."""
    fps = notes["fps"]
    chroma = np.array(notes["chroma"], dtype=float)
    bass = np.array(notes["bass"], dtype=float)
    out = []
    for i, b in enumerate(beats):
        end = beats[i + 1] if i + 1 < len(beats) else b + 0.4
        lo, hi = int(b * fps), max(int(b * fps) + 1, int(end * fps))
        c = chroma[lo:hi].mean(axis=0) if hi <= len(chroma) and lo < hi else np.zeros(12)
        bb = bass[lo:hi].mean(axis=0) if hi <= len(bass) and lo < hi else np.zeros(12)
        out.append((c / (np.linalg.norm(c) or 1), bb / (bb.max() or 1)))
    return out


def judge(song_id):
    song = load_song(song_id)
    notes_path = RAW_DIR / f"{song_id}.notes.json"
    if not song or not notes_path.exists():
        return None
    versions = {"lv": song}
    for m in ("btc", "btc-cl", "chordnet"):
        path = ROOT / "local-songs" / "models" / song_id / f"{m}.json"
        if path.exists():
            versions[m] = json.loads(path.read_text())
    beats = song["beats"]
    said = {m: chord_at_beats(v, beats) for m, v in versions.items()}
    heard = beat_notes(json.loads(notes_path.read_text()), beats)
    vocabulary = sorted({c for cs in said.values() for c in cs if c})

    # 1. How far to trust the referee: on beats where every model says the same chord, does that
    #    chord score above every other chord the song uses? By margin over the runner-up.
    calibration = []   # (margin, right)
    for i, (chroma, bass) in enumerate(heard):
        agreed = {said[m][i] for m in said}
        if len(agreed) != 1 or None in agreed:
            continue
        truth = agreed.pop()
        mine = score(truth, chroma, bass)
        best_other = max(score(c, chroma, bass) for c in vocabulary if c != truth)
        calibration.append((abs(mine - best_other), mine > best_other))
    right_at = {}
    for m in MARGINS:
        kept = [ok for margin, ok in calibration if margin >= m]
        right_at[m] = (sum(kept) / len(kept), len(kept)) if kept else (None, 0)
    trusted = next((m for m in MARGINS if right_at[m][0] is not None and right_at[m][0] >= TRUST), None)

    # 2. The disagreements: whose chord fits best, and by how much.
    wins = Counter()        # model -> trusted verdicts its chord won
    stakes = Counter()      # model -> trusted verdicts it took part in (said a chord)
    pairs = defaultdict(Counter)   # (lv chord, other chord) -> winner counts
    disagreements = trusted_verdicts = 0
    for i, (chroma, bass) in enumerate(heard):
        votes = {m: said[m][i] for m in said}
        candidates = {c for c in votes.values() if c}
        if len(candidates) < 2 or None in votes.values():
            continue
        disagreements += 1
        ranked = sorted(candidates, key=lambda c: score(c, chroma, bass), reverse=True)
        margin = score(ranked[0], chroma, bass) - score(ranked[1], chroma, bass)
        if trusted is None or margin < trusted:
            continue
        trusted_verdicts += 1
        for m, c in votes.items():
            stakes[m] += 1
            wins[m] += c == ranked[0]
        others = {c for m, c in votes.items() if m != "lv" and c != votes["lv"]}
        for other in others:
            pairs[(votes["lv"], other)][label(ranked[0])] += 1

    return {
        "title": song["title"], "calibrated_on": len(calibration), "right_at": right_at, "trusted": trusted,
        "disagreements": disagreements, "beats": len(beats), "verdicts": trusted_verdicts,
        "wins": wins, "stakes": stakes, "pairs": pairs,
    }


def main():
    ids = sys.argv[1:] or [s["videoId"] for s in json.loads((ROOT / "public" / "songs" / "index.json").read_text())]
    total_wins, total_stakes = Counter(), Counter()
    for song_id in ids:
        r = judge(song_id)
        if r is None:
            print(f"\n{song_id}: no notes recorded yet (analyze.py --add-models {song_id})")
            continue
        print(f"\n### {r['title'][:60]}")
        hit0 = r["right_at"][0.0][0]
        print(f"  referee check, on {r['calibrated_on']} beats all models agree on: the agreed chord scores best "
              f"{hit0:.0%} of the time" + (f"; ≥{TRUST:.0%} right at margin ≥ {r['trusted']} "
              f"({r['right_at'][r['trusted']][1]} beats)" if r["trusted"] is not None else "; never 90% sure"))
        print(f"  beats where the models disagree: {r['disagreements']} of {r['beats']}; "
              f"trusted verdicts: {r['verdicts']}")
        if r["verdicts"]:
            print("  won (of trusted verdicts): " + " | ".join(
                f"{MODELS[m]} {r['wins'][m] / r['stakes'][m]:.0%}" for m in MODELS if r["stakes"][m]))
            top = sorted(r["pairs"].items(), key=lambda kv: -sum(kv[1].values()))[:4]
            print("  lv-chordia vs another model, audio's pick: " + "; ".join(
                f"{label(a)} vs {label(b)}: " + ", ".join(f"{w} {n}" for w, n in winners.most_common())
                for (a, b), winners in top))
        total_wins.update(r["wins"])
        total_stakes.update(r["stakes"])
    if total_stakes:
        print("\nOVERALL, share of trusted verdicts each model's chord won: " + " | ".join(
            f"{MODELS[m]} {total_wins[m] / total_stakes[m]:.0%} ({total_stakes[m]})" for m in MODELS if total_stakes[m]))


if __name__ == "__main__":
    main()
