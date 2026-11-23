import hashlib
import hmac
import os
import time
from collections import OrderedDict
from datetime import datetime, timezone
from functools import lru_cache
from threading import Lock

import numpy as np
from bson import ObjectId
from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastembed import TextEmbedding
from pydantic import BaseModel, Field
from pymongo import MongoClient

from ranker import rank

app = FastAPI(title="StreamWise recommendations")
db = MongoClient(os.getenv("MONGO_URL", "mongodb://localhost:27017"), tz_aware=True, serverSelectionTimeoutMS=3000)[
    os.getenv("MONGO_DB_NAME", "streamwise")
]
secret = os.getenv("GATEWAY_SECRET")
if not secret and os.getenv("NODE_ENV") == "production":
    raise RuntimeError("GATEWAY_SECRET is required")
secret = (secret or "dev_internal_gateway_secret_streamwise_key_8492").encode()
model_name = "sentence-transformers/all-MiniLM-L6-v2"
embedding_lock = Lock()


@lru_cache(maxsize=1)
def model():
    return TextEmbedding(model_name=model_name, cache_dir=os.getenv("MODEL_CACHE", "/tmp/streamwise-models"))


# Small-catalog exact search. Metadata edits naturally change the cache key.
vector_cache = OrderedDict()


def encode(videos):
    texts = []
    text_to_idx = []
    matrix_rows = [None] * len(videos)

    for idx, video in enumerate(videos):
        emb = video.get("embedding")
        if isinstance(emb, (list, tuple)) and len(emb) == 384:
            matrix_rows[idx] = np.asarray(emb, dtype=np.float32)
            continue
        fields = [video.get("title"), " ".join(video.get("tags") or []),
                  video.get("category"), (video.get("description") or "")[:1200]]
        txt = " ".join(filter(None, fields)) or "video"
        texts.append(txt)
        text_to_idx.append(idx)

    if texts:
        with embedding_lock:
            missing = list(dict.fromkeys(text for text in texts if text not in vector_cache))
            if missing:
                vector_cache.update(zip(missing, model().embed(missing), strict=True))
            for txt, idx in zip(texts, text_to_idx):
                matrix_rows[idx] = vector_cache[txt]
                vector_cache.move_to_end(txt)
            while len(vector_cache) > 8192:
                vector_cache.popitem(last=False)

    matrix = np.asarray(matrix_rows, dtype=np.float32)
    return matrix / np.maximum(np.linalg.norm(matrix, axis=1, keepdims=True), 1e-9)


def identity(request):
    headers = request.headers
    user = headers.get("x-user-id", "")
    stamp = headers.get("x-gateway-timestamp", "")
    payload = f"{user or 'anonymous'}:{headers.get('x-request-id', '')}:{stamp}"
    expected = hmac.digest(secret, payload.encode(), hashlib.sha256).hex()
    if (not stamp.isascii() or not stamp.isdigit() or len(stamp) > 15
            or abs(time.time() * 1000 - int(stamp)) > 60000
            or not hmac.compare_digest(expected, headers.get("x-gateway-signature", ""))):
        raise HTTPException(403, "Gateway signature required")
    if user and not ObjectId.is_valid(user):
        raise HTTPException(400, "Invalid account ID")
    return ObjectId(user) if user else None


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/recommendations")
def feed(request: Request, response: Response, limit: int = Query(12, ge=1, le=50)):
    user = identity(request)
    response.headers["Cache-Control"] = "private, no-store"
    fields = "title description tags category duration views channelId createdAt thumbnailUrl embedding".split()
    base_filter = {"visibility": "public", "status": {"$in": ["ready", "published"]}}

    # Stage 1: Candidate Generation (Retrieval shortlist)
    history = list(db.videointeractions.find({"userId": user}, {"playedRanges": 0}).sort("updatedAt", -1).limit(50)) if user else []

    candidates = {}
    # Pool A: Top recent uploads in last 48 hours
    for v in db.videos.find(base_filter, fields).sort("createdAt", -1).limit(40):
        candidates[v["_id"]] = v

    # Pool B: All-time top viewed
    for v in db.videos.find(base_filter, fields).sort("views", -1).limit(40):
        candidates[v["_id"]] = v

    # Pool C: Category/Topic affinity candidates for signed-in users
    if history:
        recent_ids = [h["videoId"] for h in history[:10] if h.get("liked") or (h.get("playedSeconds", 0) > 10)]
        if recent_ids:
            samples = list(db.videos.find({"_id": {"$in": recent_ids}}, ["category"]).limit(10))
            cats = list(filter(None, {s.get("category") for s in samples}))
            if cats:
                for v in db.videos.find({**base_filter, "category": {"$in": cats}}, fields).sort("views", -1).limit(30):
                    candidates[v["_id"]] = v

    catalog = list(candidates.values())
    now = datetime.now(timezone.utc)
    chosen = []
    for pick in rank(catalog, history, encode, now, limit):
        video = catalog[pick.index]
        chosen.append({**video, "videoId": str(video["_id"]), "score": float(pick.score),
                       "reason": pick.reason})
    channel_ids = [v.get("channelId") for v in chosen]
    channels = {c["_id"]: c for c in db.channels.find({"_id": {"$in": channel_ids}}, ["name", "image"])}
    for video in chosen:
        cid = video.get("channelId")
        channel = channels.get(cid, {})
        video["channelId"] = {**channel, "_id": str(cid)} if cid else None
        video["_id"] = str(video["_id"])
    feed_id = None
    if user and chosen:
        feed_id = db.recommendationfeeds.insert_one({
            "userId": user, "servedAt": now, "version": 2,
            "videoIds": [ObjectId(v["_id"]) for v in chosen],
            "seenPositions": [],
        }).inserted_id
    return {"videos": chosen, "feedId": str(feed_id) if feed_id else None}


class Impression(BaseModel):
    feedId: str = Field(pattern="^[0-9a-f]{24}$")
    position: int = Field(ge=0, lt=50)


@app.post("/api/recommendations/impressions", status_code=204)
def impression(request: Request, event: Impression):
    user = identity(request)
    if not user:
        raise HTTPException(401, "Authentication required")
    match = db.recommendationfeeds.update_one(
        {"_id": ObjectId(event.feedId), "userId": user,
         f"videoIds.{event.position}": {"$exists": True}},
        {"$addToSet": {"seenPositions": event.position}},
    )
    if not match.matched_count:
        raise HTTPException(404, "Unknown feed position")
    return Response(status_code=204)
