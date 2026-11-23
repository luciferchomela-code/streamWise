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
