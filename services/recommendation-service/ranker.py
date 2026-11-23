"""Exact, training-free ranking for a small catalog of normalized content vectors."""
from dataclasses import dataclass
from datetime import datetime, timezone
from math import expm1, sqrt

import numpy as np


@dataclass(frozen=True)
class Pick:
    index: int
    score: float
    reason: str


def age_days(now, timestamp):
    if timestamp is None:
        return 365.0
    if isinstance(timestamp, str):
        try:
            timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        except Exception:
            return 365.0
    if getattr(timestamp, "tzinfo", None) is None:
        if getattr(now, "tzinfo", None) is not None:
            timestamp = timestamp.replace(tzinfo=timezone.utc)
    elif getattr(now, "tzinfo", None) is None:
        now = now.replace(tzinfo=timezone.utc)
    return max(0.0, (now - timestamp).total_seconds() / 86400)


def rank(videos, history, encode, now, limit):
    by_id = {str(v["_id"]): i for i, v in enumerate(videos)}
    blocked = set()
    seeds, dislikes = [], []
    for event in history:
        vid = event.get("videoId")
        if vid is None:
            continue
        i = by_id.get(str(vid))
        if i is None:
            continue
        if event.get("disliked"):
            blocked.add(i)
            dislikes.append(i)
            continue
        duration = videos[i].get("duration") or event.get("playedDuration") or 0
        seconds = min(duration, max(0, event.get("playedSeconds") or 0))
        coverage = seconds / duration if duration > 0 else 0
        liked = bool(event.get("liked"))
        if liked or coverage >= 0.90:
            blocked.add(i)
        # Reward completion on short clips and sustained viewing on long videos.
        watched = sqrt(coverage * -expm1(-seconds / 30))
        watched *= 2 ** (-age_days(now, event.get("playedAt")) / 21)
        like_time = event.get("reactionAt") or event.get("updatedAt") or event.get("lastViewedAt")
        strength = watched + 2 * liked * 2 ** (-age_days(now, like_time) / 21)
        if strength >= 0.01:
            seeds.append((i, strength, liked))

    def global_key(i):
        video = videos[i]
        age = age_days(now, video.get("createdAt"))
        return (age <= 1, video.get("views") or 0, -age, str(video["_id"]))

    eligible = sorted(set(range(len(videos))) - blocked, key=global_key, reverse=True)
    popularity = np.zeros(len(videos))
    for position, i in enumerate(eligible):
        popularity[i] = 1 / (1 + position / 5)
    def global_reason(i):
        return "Trending in the last 24 hours" if global_key(i)[0] else "Popular on StreamWise"

    if not eligible or not (seeds or dislikes):
        return [Pick(i, popularity[i], global_reason(i)) for i in eligible[:limit]]

    vectors = encode(videos)
    penalty = np.zeros(len(videos))
    for i in dislikes:
        penalty = np.maximum(penalty, np.maximum(0, vectors @ vectors[i]) ** 4)

    strongest = np.zeros(len(videos))
    support = np.zeros(len(videos))
    best_seed_liked = np.zeros(len(videos), dtype=bool)
    exposure = sum(weight for _, weight, _ in seeds)
    for i, weight, liked in seeds:
        similarity = np.maximum(0, vectors @ vectors[i]) ** 2
        evidence = min(1, weight) * similarity
        best_seed_liked[evidence > strongest] = liked
        strongest = np.maximum(strongest, evidence)
        support += weight * similarity
    affinity = 0.8 * strongest + 0.2 * support / max(exposure, 1e-9)
    share = exposure / (exposure + 8)
    redundancy = np.zeros(len(videos))
    results = []

    # Dedicated exploration slot for new uploads with few impressions (Item 4)
    explore_slot = 4 if limit >= 6 else -1
    explore_placed = False

    for slot in range(1, min(limit, len(eligible)) + 1):
        if slot == explore_slot and not explore_placed:
            fresh_candidates = [
                i for i in eligible
                if ((videos[i].get("impressions") is not None and videos[i].get("impressions") < 50) or
                    ((videos[i].get("views") or 0) < 5 and age_days(now, videos[i].get("createdAt")) <= 7))
            ]
            if fresh_candidates:
                winner = max(fresh_candidates, key=lambda i: (float(affinity[i]), -age_days(now, videos[i].get("createdAt"))))
                explore_placed = True
                if affinity[winner] > 0.05:
                    reason = "Similar to videos you liked" if best_seed_liked[winner] else "Similar to videos you watched"
                else:
                    reason = "Fresh upload you might like" if affinity[winner] > 0.01 else "New on StreamWise"
                score_val = float(0.9 * affinity[winner] + 0.1 * popularity[winner])
                results.append(Pick(winner, score_val, reason))
                eligible.remove(winner)
                redundancy = np.maximum(redundancy, np.maximum(0, vectors @ vectors[winner]) ** 4)
                continue

        personal = round(slot * share) > round((slot - 1) * share)
        relevance = 0.9 * affinity + 0.1 * popularity if personal else popularity
        scores = relevance - penalty - 0.12 * redundancy
        winner = max(eligible, key=scores.__getitem__)
        reason = global_reason(winner)
        if personal and affinity[winner] > 0.05:
            reason = "Similar to videos you liked" if best_seed_liked[winner] else "Similar to videos you watched"
        results.append(Pick(winner, float(scores[winner]), reason))
        eligible.remove(winner)
        redundancy = np.maximum(redundancy, np.maximum(0, vectors @ vectors[winner]) ** 4)
    return results
