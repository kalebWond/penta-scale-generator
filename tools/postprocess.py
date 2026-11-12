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


def clean_beats(beats, downbeats, too_close=0.6, missed=1.6, history=8):
    """Fix the beat model's slips, so every beat is one beat long.

    The beats are followed as a steady grid: from each kept beat, the next is the model's beat
    closest to one local beat later (the median of the last `history` gaps).
    - Beats less than `too_close` of a beat after the last kept one are extra detections and are
      dropped. That covers a double detection (Aster Abebe's "Simihin Terahu" had 11, 0.08 s
      after a real beat) and a stretch where the model goes double time on a drum fill or busy
      strumming ("ጌታ ነው በሕይወቴ", 2:28-2:44, beats 0.18 s apart against a 0.37 s beat). Keeping
      the beat nearest the grid, not just the first of a close pair, stops the grid flipping onto
      the off-beat there.
    - A gap of about two beats (no beat within `missed` beats) is a missed beat: one is put back
      in the middle. Longer gaps (a break in the music) are left alone.
    Downbeats move to the nearest kept beat; one far from every kept beat is dropped.
    Returns (beats, downbeats).
    """
    ibi = median_ibi(beats)
    if not ibi:
        return list(beats), list(downbeats)
    kept = [beats[0]]
    i = 1
    while i < len(beats):
        recent = [b - a for a, b in zip(kept[-history - 1:], kept[-history:])]
        period = min(max(median(recent) if recent else ibi, 0.8 * ibi), 1.25 * ibi)
        last = kept[-1]
        expect = last + period
        best = None
        j = i
        while j < len(beats) and beats[j] < last + missed * period:
            if beats[j] > last + too_close * period and (
                    best is None or abs(beats[j] - expect) < abs(beats[best] - expect)):
                best = j
            j += 1
        if best is not None:
            kept.append(beats[best])
            i = best + 1
            continue
        if j == len(beats):
            break
        if beats[j] - last < 2.5 * period:
            kept.append((last + beats[j]) / 2)
        kept.append(beats[j])
        i = j + 1
    fixed_downbeats = sorted({b for d in downbeats
                              for b in [_nearest(kept, d)] if abs(b - d) < 0.3 * ibi})
    return kept, fixed_downbeats


def fix_dotted_stretches(beats, ratio=1.5, tolerance=0.1, min_run=6, fit=0.35):
    """Put back on the song's beat a stretch where the beat model counted a slower pulse.

    In a triple-feel song the beat model can lock on to 2 beats for every 3 for a while: in
    "Graves Into Gardens" (6/8) it found a beat every 0.64 s from 0:09 to 0:29 against a 0.43 s
    beat, 32 beats where there are 48, and the track crawled there. The steady cleanup keeps
    such a run, as it's steady. A run of at least `min_run` gaps, each `ratio` times the usual
    (within `tolerance`), is spread evenly at the song's beat, as long as its length is close to
    a whole number of beats (within `fit` of one): its first and last beats stay where they are.
    (A run of gaps twice the usual is a missed beat each time, which clean_beats fills.)
    """
    ibi = median_ibi(beats)
    if not ibi or len(beats) < min_run + 1:
        return list(beats)
    slow = [abs((b - a) / ibi - ratio) < tolerance * ratio for a, b in zip(beats, beats[1:])]
    out = [beats[0]]
    i = 0
    while i < len(slow):
        j = i
        while j < len(slow) and slow[j]:
            j += 1
        if j - i >= min_run:
            span = beats[j] - beats[i]
            n = round(span / ibi)
            if abs(span / ibi - n) < fit:
                out.extend(beats[i] + span * k / n for k in range(1, n + 1))
                i = j
                continue
        out.append(beats[i + 1])
        i += 1
    return out


def fix_offbeat_stretches(beats, raw_chords, slip=(1.3, 1.75), min_changes=4, off=0.3):
    """Put back on the beat a stretch where the beat model followed the off-beats.

    The beat model can slip half a beat (a gap of about 1.5 beats) and slip back later: in
    "ጌታ ነው በሕይወቴ" it was on the "and" from 1:21 to 1:33 and from 3:43 to 3:58, which showed as
    a 1.5-beat cell and a 2-beat bar at each slip. Which side of a slip is right is told by the
    chord model, which knows nothing of beats: where the beats are right, its changes land near
    a beat; on the off-beats they land about half a beat after one. A stretch between slips whose
    changes (at least `min_changes`) sit a median of more than `off` beat from the nearest beat
    moves by half a beat: each beat becomes the midpoint of two, plus one at each end, so the
    1.5-beat gaps on both sides become 1 beat. A stretch with too few changes is left alone.
    """
    ibi = median_ibi(beats)
    if not ibi or not raw_chords:
        return list(beats)
    gaps = [b - a for a, b in zip(beats, beats[1:])]
    cuts = [i + 1 for i, g in enumerate(gaps) if slip[0] * ibi < g < slip[1] * ibi]
    if not cuts:
        return list(beats)
    changes = [s["start_time"] for k, s in enumerate(raw_chords)
               if k and s["end_time"] - s["start_time"] >= 0.6 * ibi
               and raw_chords[k - 1]["end_time"] - raw_chords[k - 1]["start_time"] >= 0.6 * ibi]
    out = []
    edges = [0] + cuts + [len(beats)]
    for a, z in zip(edges, edges[1:]):
        stretch = beats[a:z]
        phases = []
        for t in changes:
            i = bisect_left(stretch, t) - 1
            if 0 <= i < len(stretch) - 1:
                ph = (t - stretch[i]) / (stretch[i + 1] - stretch[i])
                phases.append(ph - 1 if ph > 0.75 else ph)
        if len(stretch) < 2 or len(phases) < min_changes or abs(median(phases)) <= off:
            out.extend(stretch)
            continue
        first = stretch[0] - (stretch[1] - stretch[0]) / 2
        last = stretch[-1] + (stretch[-1] - stretch[-2]) / 2
        mids = [(p + q) / 2 for p, q in zip(stretch, stretch[1:])]
        keep_first = first >= 0 and (not out or first - out[-1] > 0.6 * ibi)
        out.extend(([first] if keep_first else []) + mids + [last])
    return out


def detect_tempo(beats):
    ibi = median_ibi(beats)
    return 60.0 / ibi if ibi else None


def detect_beats_per_bar(beats, downbeats):
    counts = Counter()
    for a, b in zip(downbeats, downbeats[1:]):
        counts[bisect_left(beats, b - 1e-3) - bisect_left(beats, a - 1e-3)] += 1
    return counts.most_common(1)[0][0] if counts else 4


def _change_weights(beats, segments):
    """{beat index: weight} for the beats a chord changes on: 1 for a new chord, 0.5 for the
    same chord over a new bass (D to D/F#, often a walk inside the bar). Changes to no chord
    and changes off the beat grid don't count."""
    weights = {}
    prev = None
    for start, chord, _label in segments:
        if chord is not None and beats:
            i = bisect_left(beats, start - 0.02)
            if i < len(beats) and abs(beats[i] - start) < 0.02:
                same_triad = prev is not None and prev[:2] == chord[:2]
                weights[i] = 0.5 if same_triad else 1.0
        prev = chord
    return weights


def meter_from_changes(change_beats, model_count, min_changes=8):
    """Beats per bar, 3 or 4, from how far apart the chords change (in beats).

    Chords mostly change on a downbeat, so the gaps between changes are mostly whole bars:
    a 3-beat song changes 3, 6, 9 beats apart, a 4-beat one 4, 8. Compound meter (6/8) is
    counted in 3, so every song in it gets the same kind of bar whichever pulse the beat model
    locked on to; 2/4 is counted in 4. With few changes, or a tie, the beat model's count
    (`model_count`, from its downbeats) decides.
    """
    gaps = [b - a for a, b in zip(change_beats, change_beats[1:])]
    if len(gaps) >= min_changes:
        threes = sum(1 for g in gaps if g % 3 == 0)
        fours = sum(1 for g in gaps if g % 4 == 0)
        if threes != fours:
            return 3 if threes > fours else 4
    return 3 if model_count % 3 == 0 else 4


def place_bars(beats, segments, downbeats, beats_per_bar,
               change_reward=1.0, downbeat_reward=0.3, short_bar_cost=2.5):
    """The beats that start a bar: [time]. A best path (Viterbi) through each beat's place in
    the bar, which rewards a bar starting where a chord changes (chords mostly change on the
    downbeat) and, less, where the beat model put a downbeat (often wrong: in "ጌታ ነው በሕይወቴ"
    they are 1 to 6 beats apart). Bars are `beats_per_bar` long; a shorter bar costs
    `short_bar_cost`, so the bar lines only move where several chord changes agree, as when
    the beat model slipped half a beat and the grid lost or gained one. Bars are never made
    longer: the app counts a bar at the meter, so a long bar would show as two.
    """
    n, B = len(beats), beats_per_bar
    if not n:
        return []
    changes = _change_weights(beats, segments)
    model = {bisect_left(beats, d - 0.02) for d in downbeats}
    gain = [change_reward * changes.get(i, 0.0) + (downbeat_reward if i in model else 0.0)
            for i in range(n)]
    neg = float("-inf")
    score = [gain[0] if s == 0 else 0.0 for s in range(B)]   # any start: a pickup bar
    back = []
    for i in range(1, n):
        new = [neg] * B
        frm = [0] * B
        for s in range(B):   # carry on: the bar goes on, or a full bar ends
            nxt = (s + 1) % B
            if score[s] > new[nxt]:
                new[nxt], frm[nxt] = score[s], s
        for s in range(B - 1):   # cut short: a new bar starts after s + 1 beats
            if score[s] - short_bar_cost > new[0]:
                new[0], frm[0] = score[s] - short_bar_cost, s
        new[0] += gain[i]
        back.append(frm)
        score = new
    s = max(range(B), key=lambda k: score[k])
    states = [s]
    for frm in reversed(back):
        s = frm[s]
        states.append(s)
    states.reverse()
    return [beats[i] for i in range(n) if states[i] == 0]


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
    beats = fix_dotted_stretches(beats)
    beats = fix_offbeat_stretches(beats, raw_chords)
    downbeats = sorted({b for d in downbeats for b in [_nearest(beats, d)]
                        if abs(b - d) < 0.3 * median_ibi(beats)}) if beats else []
    segments, end_time = build_segments(raw_chords, beats)
    changes = sorted(_change_weights(beats, segments))
    beats_per_bar = meter_from_changes(changes, detect_beats_per_bar(beats, downbeats))
    downbeats = place_bars(beats, segments, downbeats, beats_per_bar)
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
        "beatsPerBar": beats_per_bar,
        "inKeyShare": round(in_key, 3) if in_key is not None else None,
        "chords": chords,
        "beats": [round(t, 2) for t in beats],
        "downbeats": [round(t, 2) for t in downbeats],
    }
