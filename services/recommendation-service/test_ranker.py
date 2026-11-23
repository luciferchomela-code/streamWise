import unittest
from datetime import datetime, timedelta, timezone

import numpy as np

from ranker import rank


class FeedTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime.now(timezone.utc)
        self.videos = [{"_id": i, "views": 20 - i, "createdAt": self.now}
                       for i in range(10)]
        self.vectors = np.eye(10)
        self.vectors[9] = self.vectors[8]

    def event(self, i, days=0, **fields):
        return {"videoId": i, "lastViewedAt": self.now - timedelta(days=days), **fields}

    def feed(self, events, limit=10):
        return [p.index for p in rank(self.videos, events, lambda _: self.vectors, self.now, limit)]

    def test_cold_start_and_old_popular_backfill(self):
        self.videos[0]["createdAt"] -= timedelta(days=3)
        self.assertEqual(self.feed([]), list(range(1, 10)) + [0])

    def test_click_does_not_change_order(self):
        self.assertEqual(self.feed([self.event(8, watchPercentage=1)]), self.feed([]))

    def test_like_promotes_related_and_excludes_seed(self):
        ids = self.feed([self.event(8, liked=True)])
        self.assertLess(ids.index(9), 4)
        self.assertNotIn(8, ids)
        self.assertEqual(len(set(ids)), len(ids))

    def test_old_interest_decays(self):
        ids = self.feed([self.event(8, days=365, liked=True)])
        self.assertEqual(ids[-1], 9)

    def test_dislike_excludes_and_suppresses(self):
        self.vectors[0] = self.vectors[8]
        ids = self.feed([self.event(8, disliked=True)])
        self.assertNotIn(8, ids)
        self.assertGreater(ids.index(0), ids.index(1))

    def test_all_blocked(self):
        self.assertEqual(self.feed([self.event(i, disliked=True) for i in range(10)]), [])

    def test_legacy_seek_to_end_is_not_completion(self):
        self.assertEqual(self.feed([self.event(8, watchPercentage=100)]), self.feed([]))

    def test_unique_coverage_drives_retrieval_and_returns_contract_evidence(self):
        events = [self.event(8, playedSeconds=100, playedDuration=100, playedAt=self.now)]
        picks = rank(self.videos, events, lambda _: self.vectors, self.now, 10)
        self.assertNotIn(8, [p.index for p in picks])
        neighbor = next(p for p in picks if p.index == 9)
        self.assertEqual(neighbor.reason, "Similar to videos you watched")
        self.assertTrue(np.isfinite(neighbor.score))

    def test_reaction_and_playback_age_independently(self):
        old = self.now - timedelta(days=365)
        ids = self.feed([self.event(8, reactionAt=old, updatedAt=self.now, liked=True)])
        self.assertEqual(ids[-1], 9)

    def test_empty_catalog(self):
        picks = rank([], [], lambda _: np.zeros((0, 4)), self.now, 10)
        self.assertEqual(picks, [])

    def test_naive_and_string_timestamps(self):
        naive_dt = datetime.now()
        iso_str = "2026-01-01T00:00:00Z"
        videos = [
            {"_id": "v1", "views": 10, "createdAt": naive_dt},
            {"_id": "v2", "views": 20, "createdAt": iso_str},
        ]
        history = [{"videoId": "v1", "liked": True, "reactionAt": iso_str}]
        picks = rank(videos, history, lambda _: np.eye(2), self.now, 10)
        self.assertNotIn(0, [p.index for p in picks])

    def test_mixed_id_types_match(self):
        videos = [{"_id": "100", "views": 5, "createdAt": self.now}, {"_id": 200, "views": 10, "createdAt": self.now}]
        history = [{"videoId": 100, "disliked": True}]
        picks = rank(videos, history, lambda _: np.eye(2), self.now, 10)
        self.assertEqual(len(picks), 1)
        self.assertEqual(picks[0].index, 1)

    def test_exploration_slot_placed_for_fresh_upload(self):
        # 8 popular videos and 1 fresh upload with 2 views
        videos = [
            {"_id": i, "views": 1000 - i * 10, "createdAt": self.now - timedelta(days=20)}
            for i in range(8)
        ]
        # video 8 is fresh with 2 views
        videos.append({"_id": 8, "views": 2, "createdAt": self.now - timedelta(hours=2)})
        vectors = np.eye(9)
        vectors[8] = vectors[0]

        history = [{"videoId": 0, "liked": True, "reactionAt": self.now}]
        picks = rank(videos, history, lambda _: vectors, self.now, 6)
        pick_indices = [p.index for p in picks]
        # Fresh video 8 should be picked in the exploration slot
        self.assertIn(8, pick_indices)
