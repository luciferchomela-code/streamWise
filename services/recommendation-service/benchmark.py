"""Offline evaluation and benchmarking for StreamWise recommendation engine.
Compares personalized MiniLM ranker against popularity baseline using temporal leave-one-out backtesting.
"""
import math
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import numpy as np

from ranker import rank


@dataclass
class MetricSummary:
    count: int
    hit_rate_at_10: float
    ndcg_at_10: float


@dataclass
class BenchmarkReport:
    model_overall: MetricSummary
    baseline_overall: MetricSummary
    model_new_viewers: MetricSummary
    baseline_new_viewers: MetricSummary
    model_returning_viewers: MetricSummary
    baseline_returning_viewers: MetricSummary
    overall_lift: float


def compute_ndcg(rank_position: Optional[int]) -> float:
    """Computes Discounted Cumulative Gain for binary relevance at 1-based rank position."""
    if rank_position is None or rank_position < 1:
        return 0.0
    return 1.0 / math.log2(rank_position + 1)


def evaluate_user(
    catalog: List[dict],
    train_history: List[dict],
    target_video_id: str,
    encode_fn,
    now: datetime,
    k: int = 10,
) -> Tuple[bool, float, bool, float]:
    """Evaluates a single user session against ranker and baseline.
    Returns: (model_hit, model_ndcg, baseline_hit, baseline_ndcg)
    """
    target_str = str(target_video_id)

    # 1. Evaluate Model Ranker
    model_picks = rank(catalog, train_history, encode_fn, now, limit=k)
    model_ids = [str(catalog[p.index]["_id"]) for p in model_picks]
    model_hit = target_str in model_ids
    model_rank = (model_ids.index(target_str) + 1) if model_hit else None
    model_ndcg = compute_ndcg(model_rank)

    # 2. Evaluate Popularity Baseline (empty history = pure popularity)
    baseline_picks = rank(catalog, [], encode_fn, now, limit=k)
    baseline_ids = [str(catalog[p.index]["_id"]) for p in baseline_picks]
    baseline_hit = target_str in baseline_ids
    baseline_rank = (baseline_ids.index(target_str) + 1) if baseline_hit else None
    baseline_ndcg = compute_ndcg(baseline_rank)

    return model_hit, model_ndcg, baseline_hit, baseline_ndcg


def run_benchmark(
    catalog: List[dict],
    user_histories: Dict[str, List[dict]],
    encode_fn,
    now: Optional[datetime] = None,
    k: int = 10,
) -> BenchmarkReport:
    """Runs temporal leave-one-out benchmark across user watch histories.
    Users with <= 3 total events are categorized as 'New Viewers', > 3 as 'Returning Viewers'.
    """
    if now is None:
        now = datetime.now(timezone.utc)

    stats = {
        "new": {"model_hits": 0, "model_ndcg": 0.0, "base_hits": 0, "base_ndcg": 0.0, "count": 0},
        "returning": {"model_hits": 0, "model_ndcg": 0.0, "base_hits": 0, "base_ndcg": 0.0, "count": 0},
    }

    for user_id, events in user_histories.items():
        if len(events) < 2:
            continue

        # Sort events chronologically
        sorted_events = sorted(
            events,
            key=lambda e: e.get("playedAt") or e.get("updatedAt") or e.get("createdAt") or datetime.min.replace(tzinfo=timezone.utc),
        )

        train = sorted_events[:-1]
        target = sorted_events[-1]
        target_vid = target.get("videoId")
        if target_vid is None:
            continue

        segment = "new" if len(sorted_events) <= 3 else "returning"

        m_hit, m_ndcg, b_hit, b_ndcg = evaluate_user(
            catalog, train, target_vid, encode_fn, now, k=k
        )

        bucket = stats[segment]
        bucket["count"] += 1
        bucket["model_hits"] += int(m_hit)
        bucket["model_ndcg"] += m_ndcg
        bucket["base_hits"] += int(b_hit)
        bucket["base_ndcg"] += b_ndcg

    def summarize(data: dict) -> Tuple[MetricSummary, MetricSummary]:
        count = data["count"]
        if count == 0:
            return MetricSummary(0, 0.0, 0.0), MetricSummary(0, 0.0, 0.0)
        return (
            MetricSummary(count, data["model_hits"] / count, data["model_ndcg"] / count),
            MetricSummary(count, data["base_hits"] / count, data["base_ndcg"] / count),
        )

    m_new, b_new = summarize(stats["new"])
    m_ret, b_ret = summarize(stats["returning"])

    total_count = stats["new"]["count"] + stats["returning"]["count"]
    total_m_hits = stats["new"]["model_hits"] + stats["returning"]["model_hits"]
    total_b_hits = stats["new"]["base_hits"] + stats["returning"]["base_hits"]
    total_m_ndcg = stats["new"]["model_ndcg"] + stats["returning"]["model_ndcg"]
    total_b_ndcg = stats["new"]["base_ndcg"] + stats["returning"]["base_ndcg"]

    m_all = MetricSummary(
        total_count,
        total_m_hits / max(total_count, 1),
        total_m_ndcg / max(total_count, 1),
    )
    b_all = MetricSummary(
        total_count,
        total_b_hits / max(total_count, 1),
        total_b_ndcg / max(total_count, 1),
    )

    lift = ((m_all.hit_rate_at_10 - b_all.hit_rate_at_10) / max(b_all.hit_rate_at_10, 1e-6)) * 100.0

    return BenchmarkReport(
        model_overall=m_all,
        baseline_overall=b_all,
        model_new_viewers=m_new,
        baseline_new_viewers=b_new,
        model_returning_viewers=m_ret,
        baseline_returning_viewers=b_ret,
        overall_lift=lift,
    )


def format_report(report: BenchmarkReport) -> str:
    lines = [
        "=" * 72,
        "          STREAMWISE RECOMMENDATION BENCHMARK SCORECARD",
        "=" * 72,
        f"Evaluated Users with History: {report.model_overall.count}",
        "-" * 72,
        f"{'Segment':<20} | {'Model Hit@10':<14} | {'Base Hit@10':<14} | {'Lift':<8}",
        "-" * 72,
        f"{'Overall':<20} | {report.model_overall.hit_rate_at_10*100:>12.1f}% | {report.baseline_overall.hit_rate_at_10*100:>12.1f}% | {report.overall_lift:>+7.1f}%",
        f"{'New Viewers (<=3)':<20} | {report.model_new_viewers.hit_rate_at_10*100:>12.1f}% | {report.baseline_new_viewers.hit_rate_at_10*100:>12.1f}% |",
        f"{'Returning (>3)':<20} | {report.model_returning_viewers.hit_rate_at_10*100:>12.1f}% | {report.baseline_returning_viewers.hit_rate_at_10*100:>12.1f}% |",
        "-" * 72,
        f"{'NDCG@10 Overall':<20} | {report.model_overall.ndcg_at_10:>12.3f}  | {report.baseline_overall.ndcg_at_10:>12.3f}  |",
        "=" * 72,
    ]
    return "\n".join(lines)


if __name__ == "__main__":
    import os
    from pymongo import MongoClient

    mongo_url = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.getenv("MONGO_DB_NAME", "streamwise")
    client = MongoClient(mongo_url, serverSelectionTimeoutMS=3000)
    db = client[db_name]

    print(f"Loading data from MongoDB [{db_name}]...")
    catalog = list(db.videos.find({"visibility": "public", "status": {"$in": ["ready", "published"]}}))
    interactions = list(db.videointeractions.find())

    by_user = defaultdict(list)
    for doc in interactions:
        uid = str(doc.get("userId"))
        if uid:
            by_user[uid].append(doc)

    print(f"Catalog: {len(catalog)} videos, Users: {len(by_user)}")
    from main import encode
    report = run_benchmark(catalog, by_user, encode)
    print(format_report(report))
