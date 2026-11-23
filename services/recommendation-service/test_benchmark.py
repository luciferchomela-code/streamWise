import unittest
from datetime import datetime, timedelta, timezone
import numpy as np

from benchmark import run_benchmark, compute_ndcg, format_report


class BenchmarkTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime.now(timezone.utc)
        # 10 videos: 0..9
        self.videos = [{"_id": str(i), "views": 100 - i * 5, "createdAt": self.now} for i in range(10)]
        self.vectors = np.eye(10)
        # video 9 is very similar to video 0
        self.vectors[9] = self.vectors[0]

    def test_compute_ndcg(self):
        self.assertAlmostEqual(compute_ndcg(1), 1.0)
        self.assertAlmostEqual(compute_ndcg(2), 1.0 / 1.5849625, places=4)
        self.assertEqual(compute_ndcg(None), 0.0)

    def test_benchmark_runs_and_measures_lift(self):
        # User 1: watched 0, then watched 9 (similar to 0) -> ranker should hit, baseline might miss if 9 is low views
        # User 2: watched 1, 2, then watched 3 (popular)
        histories = {
            "u1": [
                {"videoId": "0", "liked": True, "playedAt": self.now - timedelta(days=2)},
                {"videoId": "9", "playedAt": self.now - timedelta(days=1)},
            ],
            "u2": [
                {"videoId": "1", "playedAt": self.now - timedelta(days=4)},
                {"videoId": "2", "playedAt": self.now - timedelta(days=3)},
                {"videoId": "3", "playedAt": self.now - timedelta(days=2)},
                {"videoId": "4", "playedAt": self.now - timedelta(days=1)},
            ],
        }

        report = run_benchmark(self.videos, histories, lambda _: self.vectors, self.now, k=5)
        self.assertEqual(report.model_overall.count, 2)
        self.assertEqual(report.model_new_viewers.count, 1)  # u1 has 2 events (<=3)
        self.assertEqual(report.model_returning_viewers.count, 1)  # u2 has 4 events (>3)
        self.assertGreaterEqual(report.model_overall.hit_rate_at_10, 0.5)

        text = format_report(report)
        self.assertIn("STREAMWISE RECOMMENDATION BENCHMARK SCORECARD", text)
        self.assertIn("New Viewers", text)
        self.assertIn("Returning", text)


if __name__ == "__main__":
    unittest.main()
