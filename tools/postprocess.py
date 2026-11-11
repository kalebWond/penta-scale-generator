"""Turn raw model output into a clean chord timeline.

Pure Python with no model or audio dependencies, so it is fast to test.
Inputs are what the models return:
  - chords: [{"start_time", "end_time", "chord"}] with labels like "E:min7" or "D:maj/3"
  - beats / downbeats: lists of times in seconds

A chord is reduced to (root pitch, "maj" | "min", bass pitch or None). The bass is kept
so the app can show D/F# or, in simplified mode, just D.
"""
from bisect import bisect_left
from collections import Counter
from statistics import median

PITCH = {
    "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5,
    "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11,
}
SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
FLAT_MAJOR_KEYS = {5, 10, 3, 8, 1, 6}  # F, Bb, Eb, Ab, Db, Gb

# Harte bass intervals: "D:maj/3" means the bass is the 3rd of the chord.
BASS_INTERVALS = {
    "1": 0, "b2": 1, "2": 2, "#2": 3, "b3": 3, "3": 4, "4": 5, "#4": 6,
    "b5": 6, "5": 7, "#5": 8, "b6": 8, "6": 9, "b7": 10, "7": 11,
}

# Chords that belong to a key, as (semitones above the tonic, quality).
MAJOR_KEY = [(0, "maj"), (2, "min"), (4, "min"), (5, "maj"), (7, "maj"), (9, "min")]
MINOR_KEY = [(0, "min"), (3, "maj"), (5, "min"), (7, "min"), (7, "maj"), (8, "maj"), (10, "maj")]

NO_CHORD = "N"


def parse_chord(label):
    """'D:maj/3' -> (2, 'maj', 6); 'E:min7' -> (4, 'min', None); 'N' / 'X' -> None.

    Everything is reduced to major or minor. The bass is None when it is the root.
    """
    if not label or label in ("N", "X"):
        return None
    if ":" in label:
        root, _, rest = label.partition(":")
        quality, _, bass = rest.partition("/")
    else:
        root, _, bass = label.partition("/")
        quality = "maj"
    if root not in PITCH:
        return None
    pitch = PITCH[root]
    minor = quality.startswith(("min", "dim", "hdim"))
    bass_pitch = None
    if bass in PITCH:
        bass_pitch = PITCH[bass]
    elif bass in BASS_INTERVALS:
        bass_pitch = (pitch + BASS_INTERVALS[bass]) % 12
    if bass_pitch == pitch:
        bass_pitch = None
    return pitch, ("min" if minor else "maj"), bass_pitch


def note_name(pitch, flats=False):
    return (FLAT_NAMES if flats else SHARP_NAMES)[pitch]


def chord_name(pitch, quality, flats=False):
    return note_name(pitch, flats) + ("m" if quality == "min" else "")


def _nearest(arr, t):
    i = bisect_left(arr, t)
    candidates = [arr[j] for j in (i - 1, i) if 0 <= j < len(arr)]
    return min(candidates, key=lambda x: abs(x - t))


def detect_tempo(beats):
    ibi = [b - a for a, b in zip(beats, beats[1:])]
    return 60.0 / median(ibi) if ibi else None


def detect_beats_per_bar(beats, downbeats):
    counts = Counter()
    for a, b in zip(downbeats, downbeats[1:]):
        counts[sum(1 for t in beats if a - 1e-3 <= t < b - 1e-3)] += 1
    return counts.most_common(1)[0][0] if counts else 4


def build_segments(raw_chords, beats, min_beats=0.6):
    """Chords snapped to the beat grid, with repeats and too-short segments merged.

    Returns ([(start, chord | None)], end_time) where chord is (pitch, quality, bass).
    A change of bass (D to D/F#) counts as a change.
    """
    parsed = [(s["start_time"], s["end_time"], parse_chord(s["chord"])) for s in raw_chords]
    if not parsed:
        return [], 0.0
    end_time = parsed[-1][1]
    ibi = median([b - a for a, b in zip(beats, beats[1:])]) if len(beats) > 1 else 0.5

    snapped = []
    for start, _end, chord in parsed:
        s = _nearest(beats, start) if beats else start
        if snapped and abs(snapped[-1][0] - s) < 1e-6:
            snapped.pop()  # two changes landed on one beat: the later one wins
        snapped.append((s, chord))

    def dedupe(items):
        out = []
        for s, chord in items:
            if out and out[-1][1] == chord:
                continue
            out.append((s, chord))
        return out

    merged = dedupe(snapped)
    # Absorb segments shorter than min_beats into the previous one.
    changed = True
    while changed and len(merged) > 1:
        changed = False
        for i in range(1, len(merged)):
            nxt = merged[i + 1][0] if i + 1 < len(merged) else end_time
            if nxt - merged[i][0] < min_beats * ibi:
                del merged[i]
                changed = True
                break
        merged = dedupe(merged)
    return merged, end_time


def _key_set(tonic, mode):
    table = MAJOR_KEY if mode == "maj" else MINOR_KEY
    return {((tonic + d) % 12, q) for d, q in table}


def detect_key(segments, end_time):
    """Pick the key whose chords cover most of the song; the tonic chord breaks ties
    between a major key and its relative minor (G major / E minor share chords).
    Bass notes are ignored. Returns (tonic, mode, in_key_share) or None."""
    durations = Counter()
    for i, (start, chord) in enumerate(segments):
        nxt = segments[i + 1][0] if i + 1 < len(segments) else end_time
        if chord is not None:
            durations[chord[:2]] += max(0.0, nxt - start)
    total = sum(durations.values())
    if not total:
        return None
    best = None
    for tonic in range(12):
        for mode in ("maj", "min"):
            keyset = _key_set(tonic, mode)
            coverage = sum(d for c, d in durations.items() if c in keyset) / total
            tonic_share = durations.get((tonic, mode), 0.0) / total
            score = coverage + 0.5 * tonic_share
            if best is None or score > best[0]:
                best = (score, tonic, mode, coverage)
    _, tonic, mode, coverage = best
    return tonic, mode, coverage


def build_timeline(raw_chords, beats, downbeats):
    """Everything the app needs, from raw model output.

    Each chord is {"t": seconds, "c": "D"} plus "bass": "F#" when the bass is not the root.
    "c" is already the simplified name, so a simplify toggle just ignores "bass".
    """
    segments, end_time = build_segments(raw_chords, beats)
    key = detect_key(segments, end_time)
    flats = False
    key_name = tonic_name = mode_name = None
    in_key = None
    if key:
        tonic, mode, in_key = key
        flats = tonic in FLAT_MAJOR_KEYS if mode == "maj" else ((tonic + 3) % 12) in FLAT_MAJOR_KEYS
        key_name = chord_name(tonic, mode, flats)
        tonic_name = note_name(tonic, flats)
        mode_name = "major" if mode == "maj" else "minor"

    chords = []
    for start, chord in segments:
        if chord is None:
            chords.append({"t": round(start, 2), "c": NO_CHORD})
            continue
        pitch, quality, bass = chord
        entry = {"t": round(start, 2), "c": chord_name(pitch, quality, flats)}
        if bass is not None:
            entry["bass"] = note_name(bass, flats)
        chords.append(entry)

    bpm = detect_tempo(beats)
    return {
        "key": key_name,
        "tonic": tonic_name,
        "mode": mode_name,
        "bpm": round(bpm, 1) if bpm else None,
        "beatsPerBar": detect_beats_per_bar(beats, downbeats),
        "inKeyShare": round(in_key, 3) if in_key is not None else None,
        "chords": chords,
        "beats": [round(t, 2) for t in beats],
        "downbeats": [round(t, 2) for t in downbeats],
    }
