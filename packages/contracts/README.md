# Shared Contracts

This directory is the source of truth for data exchanged between the web services and the recommendation service.

Keep these stable:

- Video fields: `videoId`, `ownerId`, `title`, `description`, `tags`, `category`, `duration`, `status`, `visibility`
- Activity-event fields: `eventId`, `eventType`, `userId`, `videoId`, `watchPercentage`, `occurredAt`, `requestId`
- Recommendation fields: `videoId`, `score`, `reason`

Place versioned event examples in `events/` and request/response schemas in `schemas/`.
