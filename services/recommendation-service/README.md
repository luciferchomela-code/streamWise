# StreamWise recommendations

The homepage calls GET /api/recommendations through the API gateway. Only public ready or published videos enter the catalog. For guests and new accounts the feed sorts today's uploads by views and fills from all-time popularity. The homepage retains its existing discovery sections if the service is unavailable.

MiniLM embeds titles, tags, categories and descriptions on CPU. Docker downloads the pretrained model at build time. A worker caches up to 8,192 distinct metadata strings. Ranking currently scans the eligible catalog per request and is intended for a small deployment.

The player samples native played time ranges and flushes every 15 seconds, on pause, end and departure. The metadata service unions ranges across sessions using an optimistic revision. Replays and seek gaps add no unique seconds. The playhead remains a separate resume position. Historical playhead percentages carry no implicit ranking weight.

For unique played seconds t and duration D, the watch weight is sqrt((t/D) * (1-exp(-t/30))). A like adds 2. Each signal decays by half every 21 days. Total positive weight S sets the personal slot share to S/(S+8). A seed is a previously engaged video. For a candidate, affinity is 80% strongest capped seed evidence and 20% weighted mean squared positive cosine similarity. Personalized slots mix affinity with 10% global rank. Both pools subtract similarity penalties for dislikes and for duplicates of topics already selected. Exact dislikes, likes and at least 90%-covered videos are excluded. Coefficients are initial design choices and require real traffic for tuning.

Each video card includes videoId, score and reason. The score is the selection score for that slot, after penalties. Different slots can draw from different pools, so scores are not probabilities. The UI displays the reason string. A completed replay updates the resume position, while the preference timestamp advances only when new coverage is observed.

Signed-in responses record the served video IDs and their order in recommendationfeeds. The UI marks zero-based positions seen once at least half a card enters the viewport. Repeated reports for a position are idempotent. This records exposures for future evaluation. Current watch summaries do not uniquely attribute playback outcomes to individual impressions.

Start the project with its existing Docker Compose setup. The service uses MONGO_URL, MONGO_DB_NAME and the same GATEWAY_SECRET as the gateway. Run the ranking tests from this directory with python -m unittest test_ranker.
