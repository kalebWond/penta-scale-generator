"""Turn raw model output into a clean chord timeline.

Pure Python with no model or audio dependencies, so it is fast to test.
Inputs are what the models return:
  - chords: [{"start_time", "end_time", "chord"}] with labels like "E:min7" or "D:maj/3"
  - beats / downbeats: sorted lists of times in seconds

A chord is reduced to (root pitch, "maj" | "min" | "dim", bass pitch or None). The bass
is kept so the app can show D/F# or, in simplified mode, just D.
"""
from bisect import bisect_left
from collections import Counter
from statistics import median

LETTERS = "CDEFGAB"
NATURAL = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
ACCIDENTAL = {0: "", 1: "#", 2: "##", 11: "b", 10: "bb"}
SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
FLAT_MAJOR_KEYS = {5, 10, 3, 8, 1, 6}  # F, Bb, Eb, Ab, Db, Gb

# Harte bass intervals, as (scale degree, semitones above the root).
# "D:maj/3" means the bass is the 3rd of the chord: degree 3, 4 semitones -> F#.
BASS_INTERVALS = {
    "1": (1, 0), "b2": (2, 1), "2": (2, 2), "#2": (2, 3), "b3": (3, 3), "3": (3, 4),
    "4": (4, 5), "#4": (4, 6), "b5": (5, 6), "5": (5, 7), "#5": (5, 8), "b6": (6, 8),
    "6": (6, 9), "b7": (7, 10), "7": (7, 11),
}

MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11]
MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10]

# Chords that belong to a key, as (semitones above the tonic, quality).
# Minor includes the major V (harmonic minor) and ii°, so ii°-V-i counts as in key.
MAJOR_KEY = [(0, "maj"), (2, "min"), (4, "min"), (5, "maj"), (7, "maj"), (9, "min"), (11, "dim")]
MINOR_KEY = [(0, "min"), (2, "dim"), (3, "maj"), (5, "min"), (7, "min"), (7, "maj"), (8, "maj"),
             (10, "maj")]

QUALITY_SUFFIX = {"maj": "", "min": "m", "dim": "dim"}
NO_CHORD = "N"


def name_pitch(name):
    """'Bb' -> 10, 'E#' -> 5. None if it is not a note name."""
    if not name or name[0] not in NATURAL or any(c not in "#b" for c in name[1:]):
        return None
    return (NATURAL[name[0]] + name.count("#") - name.count("b")) % 12


def spell_interval(root_name, degree, semitones):
    """The note `degree` letters above root_name and `semitones` above it in pitch.

    spell_interval("D", 3, 4) -> "F#"; spell_interval("C", 3, 3) -> "Eb".
    """
    letter = LETTERS[(LETTERS.index(root_name[0]) + degree - 1) % 7]
    target = (name_pitch(root_name) + semitones) % 12
    accidental = ACCIDENTAL.get((target - NATURAL[letter]) % 12)
    return letter + accidental if accidental is not None else SHARP_NAMES[target]


def _split_label(label):
    """'D:maj/3' -> ('D', 'maj', '3'); 'C/E' -> ('C', 'maj', 'E')."""
    if ":" in label:
        root, _, rest = label.partition(":")
        quality, _, bass = rest.partition("/")
    else:
        root, _, bass = label.partition("/")
        quality = "maj"
    return root, quality, bass


def parse_chord(label):
    """'D:maj/3' -> (2, 'maj', 6); 'E:min7' -> (4, 'min', None); 'N' / 'X' -> None.

    Sevenths and extensions are dropped; diminished and half-diminished become 'dim'.
    The bass is None when it is the root.
    """
    if not label or label in ("N", "X"):
        return None
    root, quality, bass = _split_label(label)
    pitch = name_pitch(root)
    if pitch is None:
        return None
    if quality.startswith(("dim", "hdim")):
        q = "dim"
    elif quality.startswith("min"):
        q = "min"
    else:
        q = "maj"
    bass_pitch = None
    if name_pitch(bass) is not None:
        bass_pitch = name_pitch(bass)
    elif bass in BASS_INTERVALS:
        bass_pitch = (pitch + BASS_INTERVALS[bass][1]) % 12
    if bass_pitch == pitch:
        bass_pitch = None
    return pitch, q, bass_pitch


def _nearest(arr, t):
    i = bisect_left(arr, t)
    candidates = [arr[j] for j in (i - 1, i) if 0 <= j < len(arr)]
    return min(candidates, key=lambda x: abs(x - t))


def median_ibi(beats):
    """Median time between beats, or None with fewer than two beats."""
    ibi = [b - a for a, b in zip(beats, beats[1:])]
    return median(ibi) if ibi else None


def clean_beats(beats, downbeats, too_close=0.5, missed=1.6):
    """Fix the beat model's occasional slips, so every beat is one beat long.

    - A beat less than `too_close` of the usual gap after the one before is a double detection:
      it's dropped. (Aster Abebe's "Simihin Terahu" had 11 of them, 0.08 s after a real beat,
      against a 0.44 s beat; each one broke the bar count.)
    - A gap of about two beats (more than `missed` times the usual) is a missed beat: one is put
      back in the middle. Longer gaps (a break in the music) are left alone.
    Downbeats that were dropped beats move to the beat they doubled.
    Returns (beats, downbeats).
    """
    ibi = median_ibi(beats)
    if not ibi:
        return list(beats), list(downbeats)
    kept = []
    moved = {}
    for t in beats:
        if kept and t - kept[-1] < too_close * ibi:
            moved[t] = kept[-1]
            continue
        kept.append(t)
    filled = []
    for i, t in enumerate(kept):
        if i and missed * ibi < t - kept[i - 1] < 2.5 * ibi:
            filled.append((kept[i - 1] + t) / 2)
        filled.append(t)
    fixed_downbeats = sorted({moved.get(d, d) for d in downbeats})
    return filled, fixed_downbeats


def detect_tempo(beats):
    ibi = median_ibi(beats)
    return 60.0 / ibi if ibi else None


def detect_beats_per_bar(beats, downbeats):
    counts = Counter()
    for a, b in zip(downbeats, downbeats[1:]):
        counts[bisect_left(beats, b - 1e-3) - bisect_left(beats, a - 1e-3)] += 1
    return counts.most_common(1)[0][0] if counts else 4


# Without beats, model flicker is judged against this beat length.
FALLBACK_IBI = 0.5


def build_segments(raw_chords, beats, min_beats=0.6):
    """Chords on the beat grid, with model flicker dropped and repeats merged.

    Returns ([(start, chord | None, label)], end_time), where chord is
    (pitch, quality, bass) and label is the model's raw label (kept for spelling).

    - A raw segment shorter than min_beats is model flicker: it is dropped, and the
      chord before it carries on. A real one-beat passing chord is kept.
    - A start is snapped to the nearest beat only if one is within half a beat, so
      chords in a rubato intro or outro, where no beats were found, keep their times.
    - A change of bass (D to D/F#) counts as a change.
    """
    if not raw_chords:
        return [], 0.0
    end_time = raw_chords[-1]["end_time"]
    ibi = median_ibi(beats) or FALLBACK_IBI

    kept = []
    carry_start = None  # start of flicker dropped before the first kept chord
    for seg in raw_chords:
        start, end, label = seg["start_time"], seg["end_time"], seg["chord"]
        if end - start < min_beats * ibi:
            if not kept and carry_start is None:
                carry_start = start
            continue
        if carry_start is not None:
            start, carry_start = carry_start, None
        kept.append((start, parse_chord(label), label))

    segments = []
    for start, chord, label in kept:
        s = start
        if beats:
            b = _nearest(beats, start)
            if abs(b - start) <= ibi / 2:
                s = b
        if segments and s <= segments[-1][0] + 1e-6:
            segments.pop()  # two changes landed on one beat: the later one wins
        if segments and segments[-1][1] == chord:
            continue
        segments.append((s, chord, label))
    return segments, end_time


def _key_set(tonic, mode):
    table = MAJOR_KEY if mode == "maj" else MINOR_KEY
    return {((tonic + d) % 12, q) for d, q in table}


def detect_key(segments, end_time):
    """Pick the key whose chords cover most of the song; the tonic chord breaks ties
    between a major key and its relative minor (G major / E minor share chords).
    Bass notes are ignored. Returns (tonic, mode, in_key_share) or None."""
    durations = Counter()
    for i, (start, chord, _label) in enumerate(segments):
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


def key_spelling(tonic, mode):
    """The key's tonic name and {pitch: name} for its seven scale notes."""
    flats = tonic in FLAT_MAJOR_KEYS if mode == "maj" else ((tonic + 3) % 12) in FLAT_MAJOR_KEYS
    tonic_name = (FLAT_NAMES if flats else SHARP_NAMES)[tonic]
    steps = MAJOR_SCALE if mode == "maj" else MINOR_SCALE
    scale = {(tonic + st) % 12: spell_interval(tonic_name, i + 1, st) for i, st in enumerate(steps)}
    return tonic_name, scale


def spell_chord(chord, label, scale):
    """Display names for one chord: (root + quality, bass or None).

    A root in the key's scale takes the key's spelling; a chromatic root keeps the
    model's own spelling (so a borrowed Bbm in E minor stays Bbm, not A#m). The bass
    is spelled from the root by its interval (D:maj/3 -> F#, C:min/b3 -> Eb).
    """
    pitch, quality, bass = chord
    model_root, _, bass_token = _split_label(label)
    root = scale.get(pitch) or (model_root if name_pitch(model_root) == pitch else SHARP_NAMES[pitch])
    bass_name = None
    if bass is not None:
        if name_pitch(bass_token) is not None:
            bass_name = scale.get(bass) or bass_token
        else:
            bass_name = spell_interval(root, *BASS_INTERVALS[bass_token])
    return root + QUALITY_SUFFIX[quality], bass_name


def build_timeline(raw_chords, beats, downbeats):
    """Everything the app needs, from raw model output.

    Each chord is {"t": seconds, "c": "D"} plus "bass": "F#" when the bass is not the root.
    "c" is already the simplified name, so a simplify toggle just ignores "bass".
    """
    beats, downbeats = clean_beats(beats, downbeats)
    segments, end_time = build_segments(raw_chords, beats)
    key = detect_key(segments, end_time)
    scale = {}
    key_name = tonic_name = mode_name = in_key = None
    if key:
        tonic, mode, in_key = key
        tonic_name, scale = key_spelling(tonic, mode)
        key_name = tonic_name + QUALITY_SUFFIX[mode]
        mode_name = "major" if mode == "maj" else "minor"

    chords = []
    for start, chord, label in segments:
        if chord is None:
            chords.append({"t": round(start, 2), "c": NO_CHORD})
            continue
        name, bass_name = spell_chord(chord, label, scale)
        entry = {"t": round(start, 2), "c": name}
        if bass_name is not None:
            entry["bass"] = bass_name
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
