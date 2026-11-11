import unittest

from postprocess import (
    build_segments, build_timeline, detect_beats_per_bar, detect_key, detect_tempo, parse_chord,
)


def seg(start, end, chord):
    return {"start_time": start, "end_time": end, "chord": chord}


# 120 BPM, 3 beats per bar: a beat every 0.5 s, a downbeat every 1.5 s.
BEATS = [i * 0.5 for i in range(1, 61)]
DOWNBEATS = BEATS[::3]


class ParseChord(unittest.TestCase):
    def test_sevenths_collapse_to_triads(self):
        self.assertEqual(parse_chord("E:min7"), (4, "min", None))
        self.assertEqual(parse_chord("C:maj7"), (0, "maj", None))
        self.assertEqual(parse_chord("G:7"), (7, "maj", None))

    def test_dim_counts_as_minor(self):
        self.assertEqual(parse_chord("B:dim"), (11, "min", None))

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


class Beats(unittest.TestCase):
    def test_tempo(self):
        self.assertAlmostEqual(detect_tempo(BEATS), 120.0)

    def test_meter(self):
        self.assertEqual(detect_beats_per_bar(BEATS, DOWNBEATS), 3)


class Segments(unittest.TestCase):
    def test_snaps_to_beat_and_merges_repeats(self):
        raw = [seg(0.0, 1.6, "N"), seg(1.6, 3.1, "E:min7"), seg(3.1, 4.6, "E:min"), seg(4.6, 6.0, "D:maj")]
        segments, end = build_segments(raw, BEATS)
        self.assertEqual([s for s, _ in segments], [0.5, 1.5, 4.5])
        self.assertEqual(segments[1][1], (4, "min", None))
        self.assertEqual(end, 6.0)

    def test_short_flicker_is_absorbed(self):
        raw = [seg(0.5, 3.0, "E:min"), seg(3.0, 3.1, "C:maj"), seg(3.1, 6.0, "E:min")]
        segments, _ = build_segments(raw, BEATS)
        self.assertEqual(len(segments), 1)
        self.assertEqual(segments[0][1], (4, "min", None))

    def test_bass_change_is_a_change(self):
        raw = [seg(0.5, 3.0, "D:maj"), seg(3.0, 6.0, "D:maj/3"), seg(6.0, 9.0, "D:maj")]
        segments, _ = build_segments(raw, BEATS)
        self.assertEqual([c for _, c in segments], [(2, "maj", None), (2, "maj", 6), (2, "maj", None)])


class Key(unittest.TestCase):
    def test_minor_key_wins_over_relative_major(self):
        raw = []
        t = 0.0
        for c in ["E:min", "D:maj", "C:maj", "G:maj", "E:min", "A:min", "E:min", "D:maj"]:
            raw.append(seg(t, t + 3.0, c))
            t += 3.0
        segments, end = build_segments(raw, BEATS)
        tonic, mode, coverage = detect_key(segments, end)
        self.assertEqual((tonic, mode), (4, "min"))
        self.assertAlmostEqual(coverage, 1.0)

    def test_bass_does_not_change_the_key(self):
        raw = []
        t = 0.0
        for c in ["E:min", "D:maj/3", "C:maj", "G:maj", "E:min", "D:maj/3", "E:min"]:
            raw.append(seg(t, t + 3.0, c))
            t += 3.0
        segments, end = build_segments(raw, BEATS)
        tonic, mode, coverage = detect_key(segments, end)
        self.assertEqual((tonic, mode), (4, "min"))
        self.assertAlmostEqual(coverage, 1.0)


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
        raw = [seg(0.5, 3.0, "Bb:maj"), seg(3.0, 6.0, "Eb:maj"), seg(6.0, 9.0, "F:maj"),
               seg(9.0, 12.0, "Bb:maj"), seg(12.0, 15.0, "G:min")]
        out = build_timeline(raw, BEATS, DOWNBEATS)
        self.assertEqual(out["key"], "Bb")
        self.assertEqual([c["c"] for c in out["chords"]], ["Bb", "Eb", "F", "Bb", "Gm"])


if __name__ == "__main__":
    unittest.main()
