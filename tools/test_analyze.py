import unittest

from analyze import parse_metadata, video_id_from

ID = "CocA4mTVKw4"


class VideoId(unittest.TestCase):
    def test_accepts_ids_and_common_urls(self):
        for arg in [
            ID,
            f"https://www.youtube.com/watch?v={ID}",
            f"https://www.youtube.com/watch?list=PL123&v={ID}&t=30",
            f"https://youtu.be/{ID}?si=abc",
            f"https://www.youtube.com/shorts/{ID}",
            f"https://www.youtube.com/embed/{ID}",
            f"https://youtube.com/live/{ID}?feature=share",
        ]:
            with self.subTest(arg=arg):
                self.assertEqual(video_id_from(arg), ID)

    def test_rejects_text_without_an_id(self):
        with self.assertRaises(SystemExit):
            video_id_from("https://www.youtube.com/@CarolFekadu")


class Metadata(unittest.TestCase):
    def test_normal_video(self):
        info = {"id": ID, "title": "Yihew Liben\twith a tab", "duration": 427, "playable_in_embed": True}
        self.assertEqual(parse_metadata(info), ("Yihew Liben\twith a tab", 427.0, True))

    def test_embedding_disabled_and_unknown(self):
        self.assertFalse(parse_metadata({"title": "x", "duration": 60, "playable_in_embed": False})[2])
        self.assertIsNone(parse_metadata({"title": "x", "duration": 60})[2])

    def test_live_or_missing_duration_is_refused(self):
        for info in [{"title": "x", "is_live": True, "duration": 60},
                     {"title": "x", "duration": None},
                     {"title": "x"}]:
            with self.subTest(info=info), self.assertRaises(ValueError):
                parse_metadata(info)


if __name__ == "__main__":
    unittest.main()
