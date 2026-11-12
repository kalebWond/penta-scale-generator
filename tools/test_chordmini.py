import unittest

import postprocess
from chordmini import parse_lab


class Lab(unittest.TestCase):
    LAB = "0.000000 0.928798 N\n0.928798 2.693515 A#:min7\n2.693515 3.157914 G#\n\n3.157914 5.0 C#:maj7\n"

    def test_lines_become_segments(self):
        self.assertEqual(parse_lab(self.LAB)[1], {"start_time": 0.928798, "end_time": 2.693515, "chord": "A#:min7"})
        self.assertEqual(len(parse_lab(self.LAB)), 4)   # the blank line is skipped

    def test_labels_read_like_lv_chordia_ones(self):
        chords = [postprocess.parse_chord(s["chord"]) for s in parse_lab(self.LAB)]
        self.assertEqual(chords, [None, (10, "min", None), (8, "maj", None), (1, "maj", None)])


if __name__ == "__main__":
    unittest.main()
