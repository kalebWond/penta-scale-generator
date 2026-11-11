import unittest

from postprocess import (
    build_segments, build_timeline, detect_beats_per_bar, detect_key, detect_tempo, parse_chord,
    spell_interval,
)


def seg(start, end, chord):
    return {"start_time": start, "end_time": end, "chord": chord}


def chords_of(segments):
    return [c for _, c, _ in segments]


def starts_of(segments):
    return [s for s, _, _ in segments]


# 120 BPM, 3 beats per bar: a beat every 0.5 s, a downbeat every 1.5 s.
BEATS = [i * 0.5 for i in range(1, 61)]
DOWNBEATS = BEATS[::3]


class ParseChord(unittest.TestCase):
    def test_sevenths_collapse_to_triads(self):
        self.assertEqual(parse_chord("E:min7"), (4, "min", None))
        self.assertEqual(parse_chord("C:maj7"), (0, "maj", None))
        self.assertEqual(parse_chord("G:7"), (7, "maj", None))

    def test_diminished_stays_diminished(self):
        self.assertEqual(parse_chord("B:dim"), (11, "dim", None))
        self.assertEqual(parse_chord("B:hdim7"), (11, "dim", None))
        self.assertEqual(parse_chord("B:dim7"), (11, "dim", None))

    def test_no_chord(self):
        self.assertIsNone(parse_chord("N"))
        self.assertIsNone(parse_chord("X"))

    def test_flat_roots(self):
        self.assertEqual(parse_chord("Bb:min"), (10, "min", None))

    def test_bass_as_interval(self):
        # D major with its 3rd (F#) in the bass: this is the D/F# in the test song.
        self.assertEqual(parse_chord("D:maj/3"), (2, "maj", 6))
        self.assertEqual(parse_chord("C:maj/5"), (0, "maj", 7))
        self.assertEqual(parse_chord("A:min7/b7"), (9, "min", 7))

    def test_bass_as_note_and_root_bass(self):
        self.assertEqual(parse_chord("C/E"), (0, "maj", 4))
        self.assertEqual(parse_chord("C:maj/1"), (0, "maj", None))


class Spelling(unittest.TestCase):
    def test_interval_spelling_follows_the_letter(self):
        self.assertEqual(spell_interval("D", 3, 4), "F#")
        self.assertEqual(spell_interval("C", 3, 3), "Eb")
        self.assertEqual(spell_interval("Bb", 5, 7), "F")


class Beats(unittest.TestCase):
    def test_tempo(self):
        self.assertAlmostEqual(detect_tempo(BEATS), 120.0)

    def test_meter(self):
        self.assertEqual(detect_beats_per_bar(BEATS, DOWNBEATS), 3)

    def test_meter_with_a_skipped_downbeat(self):
        downbeats = DOWNBEATS[:3] + DOWNBEATS[4:]  # one bar of 6 beats, the rest 3
        self.assertEqual(detect_beats_per_bar(BEATS, downbeats), 3)


class Segments(unittest.TestCase):
    def test_snaps_to_beat_and_merges_repeats(self):
        raw = [seg(0.0, 1.6, "N"), seg(1.6, 3.1, "E:min7"), seg(3.1, 4.6, "E:min"), seg(4.6, 6.0, "D:maj")]
        segments, end = build_segments(raw, BEATS)
        # 0.0 is a full beat from the first beat (0.5), so it keeps its own time.
        self.assertEqual(starts_of(segments), [0.0, 1.5, 4.5])
        self.assertEqual(chords_of(segments)[1], (4, "min", None))
        self.assertEqual(end, 6.0)

    def test_model_flicker_is_dropped(self):
        # A 0.1 s blip is shorter than 0.6 beat: the chord around it carries on.
        raw = [seg(0.5, 3.0, "A:min"), seg(3.0, 3.1, "B:min"), seg(3.1, 6.0, "A:min")]
        segments, _ = build_segments(raw, BEATS)
        self.assertEqual(chords_of(segments), [(9, "min", None)])

    def test_one_beat_passing_chord_is_kept(self):
        raw = [seg(0.5, 3.0, "A:min"), seg(3.0, 3.5, "B:min"), seg(3.5, 6.0, "A:min")]
        segments, _ = build_segments(raw, BEATS)
        self.assertEqual(chords_of(segments), [(9, "min", None), (11, "min", None), (9, "min", None)])

    def test_flicker_at_the_start_hands_its_start_to_the_next_chord(self):
        raw = [seg(0.5, 0.6, "B:min"), seg(0.6, 3.0, "E:min")]
        segments, _ = build_segments(raw, BEATS)
        self.assertEqual(segments[0][:2], (0.5, (4, "min", None)))

    def test_chords_outside_the_beat_range_keep_their_times(self):
        # A rubato intro: no beats until 10 s, and none after 20 s.
        beats = [10 + i * 0.5 for i in range(21)]
        raw = [seg(0.0, 3.0, "C:maj"), seg(3.0, 6.0, "G:maj"), seg(6.0, 12.1, "A:min"),
               seg(12.1, 25.0, "E:min"), seg(25.0, 28.0, "C:maj")]
        segments, _ = build_segments(raw, beats)
        self.assertEqual(starts_of(segments), [0.0, 3.0, 6.0, 12.0, 25.0])
        self.assertEqual(len(segments), 5)

    def test_bass_change_is_a_change(self):
        raw = [seg(0.5, 3.0, "D:maj"), seg(3.0, 6.0, "D:maj/3"), seg(6.0, 9.0, "D:maj")]
        segments, _ = build_segments(raw, BEATS)
        self.assertEqual(chords_of(segments), [(2, "maj", None), (2, "maj", 6), (2, "maj", None)])


def progression(labels, length=3.0):
    raw, t = [], 0.0
    for c in labels:
        raw.append(seg(t, t + length, c))
        t += length
    return raw


class Key(unittest.TestCase):
    def test_minor_key_wins_over_relative_major(self):
        segments, end = build_segments(
            progression(["E:min", "D:maj", "C:maj", "G:maj", "E:min", "A:min", "E:min", "D:maj"]), BEATS)
        tonic, mode, coverage = detect_key(segments, end)
        self.assertEqual((tonic, mode), (4, "min"))
        self.assertAlmostEqual(coverage, 1.0)

    def test_bass_does_not_change_the_key(self):
        segments, end = build_segments(
            progression(["E:min", "D:maj/3", "C:maj", "G:maj", "E:min", "D:maj/3", "E:min"]), BEATS)
        tonic, mode, coverage = detect_key(segments, end)
        self.assertEqual((tonic, mode), (4, "min"))
        self.assertAlmostEqual(coverage, 1.0)

    def test_diminished_chords_count_in_key(self):
        segments, end = build_segments(
            progression(["C:maj", "F:maj", "B:dim", "C:maj", "G:maj", "C:maj"]), BEATS)
        self.assertEqual(detect_key(segments, end), (0, "maj", 1.0))
        # ii°-V-i in A minor
        segments, end = build_segments(
            progression(["A:min", "B:hdim7", "E:7", "A:min", "D:min", "A:min"]), BEATS)
        self.assertEqual(detect_key(segments, end), (9, "min", 1.0))


class Timeline(unittest.TestCase):
    def test_output_shape(self):
        raw = [seg(0.5, 3.0, "E:min7"), seg(3.0, 6.0, "D:maj/3"), seg(6.0, 9.0, "E:min"),
               seg(9.0, 12.0, "C:maj"), seg(12.0, 15.0, "E:min"), seg(15.0, 18.0, "F:maj")]
        out = build_timeline(raw, BEATS, DOWNBEATS)
        self.assertEqual((out["key"], out["tonic"], out["mode"]), ("Em", "E", "minor"))
        self.assertEqual(out["beatsPerBar"], 3)
        self.assertEqual(out["bpm"], 120.0)
        self.assertEqual(out["chords"][1], {"t": 3.0, "c": "D", "bass": "F#"})
        self.assertEqual(out["chords"][0], {"t": 0.5, "c": "Em"})
        self.assertNotIn("off", out["chords"][-1])  # out-of-key chords are kept, not flagged

    def test_flat_key_uses_flat_names(self):
        raw = progression(["Bb:maj", "Eb:maj", "F:maj", "Bb:maj", "G:min"])
        out = build_timeline(raw, BEATS, DOWNBEATS)
        self.assertEqual(out["key"], "Bb")
        self.assertEqual([c["c"] for c in out["chords"]], ["Bb", "Eb", "F", "Bb", "Gm"])

    def test_borrowed_flat_chord_in_a_sharp_key_keeps_its_flat(self):
        # The test song: E minor, with a passing Bbm before F. It must not become A#m.
        raw = progression(["E:min", "D:maj", "E:min", "B:min", "Bb:min", "F:maj", "E:min"])
        out = build_timeline(raw, BEATS, DOWNBEATS)
        self.assertEqual(out["key"], "Em")
        self.assertIn("Bbm", [c["c"] for c in out["chords"]])

    def test_bass_is_spelled_from_its_interval(self):
        raw = progression(["E:min", "C:min/b3", "E:min", "D:maj/3", "E:min"])
        out = build_timeline(raw, BEATS, DOWNBEATS)
        basses = {c["c"]: c.get("bass") for c in out["chords"] if "bass" in c}
        self.assertEqual(basses, {"Cm": "Eb", "D": "F#"})

    def test_diminished_name(self):
        out = build_timeline(progression(["C:maj", "F:maj", "B:dim", "C:maj"]), BEATS, DOWNBEATS)
        self.assertIn("Bdim", [c["c"] for c in out["chords"]])


if __name__ == "__main__":
    unittest.main()
