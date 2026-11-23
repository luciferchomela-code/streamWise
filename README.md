# Smart Video Recommendation Platform

An event-driven, YouTube-style video platform. The first milestone combines a React frontend, Node.js microservices, RabbitMQ, MongoDB, Cloudinary, and a Python recommendation service.

## Workspace layout

```text
frontend/                         React + Vite client
services/
  api-gateway/                    Single public API entry point
  auth-service/                   Authentication and JWT lifecycle
  video-metadata/                 Catalogue and viewer interactions
  video-upload/                   Cloudinary media uploads
  recommendation-service/         FastAPI recommendation engine
  shared/                         Existing shared Node utilities and models
  media-processor/                Semester 2 placeholder
  telemetry/                      Semester 2 placeholder
packages/
  contracts/                      Shared HTTP, video, and RabbitMQ contracts
infrastructure/
  docker/                         Dockerfiles and Compose support
  rabbitmq/                       Broker configuration
docs/                             Architecture and API documentation
scripts/                          Local development utilities
```

## Semester 1 implementation order

1. Define the shared video, activity-event, and recommendation-response contracts in `packages/contracts`.
2. Build the API gateway and its health endpoint.
3. Complete Auth, Video Metadata, and Video Upload services.
4. Add MongoDB, RabbitMQ, Cloudinary, and Docker Compose integration.
5. Build the FastAPI recommendation service and connect it to RabbitMQ events.
6. Connect the React screens exclusively through the gateway.

## Core event flow

```text
Frontend -> API Gateway -> services
Upload complete -> RabbitMQ -> metadata updates video status
Viewer activity -> RabbitMQ -> recommendations update home feed
```

## Start the complete project

1. Copy `.env.example` to `.env` and replace the Google and Cloudinary placeholder values.
2. From the project root, run:

```powershell
.\scripts\start.ps1
```

This builds the images and starts MongoDB, Redis, RabbitMQ, every backend service, and the frontend. The script runs services in the background; use `-Foreground` to keep the logs attached.

Open `http://localhost:5173` after the frontend is running. RabbitMQ management is available at `http://localhost:15672`.

The Compose file is for development. MongoDB, Redis, and RabbitMQ host ports bind
to loopback. If an existing RabbitMQ volume was initialized with different
credentials, create the configured `RABBITMQ_USER` in that broker and grant it
permissions on the `/` virtual host, or set `COMPOSE_RABBITMQ_URL` to an existing
non-guest account. Changing the environment variables alone does not update
users stored in an existing volume.

For deployment, serve the frontend and API on the same HTTPS site. Set
`VITE_API_URL` and list the exact frontend origins in `ALLOWED_FRONTEND_ORIGINS`.
Set `TRUSTED_PROXY_ADDRESSES` to the addresses or CIDRs of any reverse proxies that
forward traffic to the gateway. Use private, authenticated MongoDB, Redis, and
RabbitMQ endpoints with deployment secrets. Set `NODE_ENV=production` and
provide strong values for `JWT_SEC` and `GATEWAY_SECRET`.

## Creator and viewer tools

- **Creator Studio** (`/studio`) shows upload status, totals, the five most
  viewed videos, and a 30 day view chart in UTC. Daily counts start when this
  version is deployed. Studio also supports WebVTT captions and retrying
  Cloudinary processing.
- **Uploads** send video bytes from the browser to Cloudinary. Reselect the
  same file in the same browser to resume from the last acknowledged chunk.
  An old checkpoint restarts the file transfer. Once uploaded, the processing
  worker verifies a baseline HLS playlist and its first media segment before
  publishing. Adaptive quality, the generated thumbnail (when no custom image
  is supplied), and timeline previews finish independently. Creator Studio
  shows each stage and lets the owner retry a failed stage.
- **Playlists** are private to the account. Use the watch page to save a
  video and the profile menu to manage playlists.
- **Moderation** includes reports and creator blocking. Set
  `MODERATOR_USER_IDS` to a comma-separated list of MongoDB user IDs to enable
  review and removal from the app. Moderation does not revoke Cloudinary URLs
  already shared outside the app.

## Background delivery

Video metadata requires a MongoDB replica set or sharded cluster for
transactions. Local Compose initializes a single member replica set named
`rs0`. If you use a separate MongoDB deployment, point `MONGO_URL` to a
transaction capable MongoDB deployment before restarting the metadata service.

The metadata service writes events in the same transaction as the changes
that produce them. The relay retries until RabbitMQ confirms routing to a
bound queue. Configure durable queues for consumers and deduplicate by
`eventId`, since a relay retry can redeliver a message. Pending events stay
in MongoDB, and confirmed entries expire after seven days.

The metadata service runs background workers by default. To scale separately,
set `VIDEO_METADATA_RUN_WORKERS=false` on API replicas and
`VIDEO_METADATA_WORKER_ONLY=true` on dedicated metadata worker replicas.

## Playback Health

Set `PLAYBACK_OPERATOR_USER_IDS` to a comma-separated list of operator account
IDs from MongoDB and restart the metadata service. Operators can open
`/ops/playback-health` on the frontend to compare playback startup, buffering,
failures, fallbacks, and sampled HLS.js CDN requests with gateway activity and
the upload pipeline. Selecting a session opens its recent events and request IDs.

The player batches anonymous events. RabbitMQ delivers them to the metadata
worker, which deduplicates event IDs while updating five-minute MongoDB
buckets. Session events expire after two days, playback aggregates after
30 days, and the dashboard shows the latest 24 hours of gateway activity
when Redis is available.

## Watch parties, notifications and live broadcasts

Rebuild the API gateway, video metadata service and frontend after installing the gateway's Socket.IO dependency. Keep Redis and RabbitMQ enabled. Forward WebSocket upgrades and the Socket.IO browser client at `/socket.io/` to the gateway, and configure the frontend origin in `ALLOWED_FRONTEND_ORIGINS`. Socket.IO carries updates across gateway replicas through Redis. MongoDB holds room versions, chat history and notification records. Keep at least one metadata worker running.

Start a party on a watch page, copy its invite link, and have each viewer select **Join playback**. Only the host can play, pause or seek the room. Rooms expire after a day. The inbox shows public video publications and active likes, dislikes, comments and subscriptions.

For public live broadcasts, provide Mux Video API credentials with read and write access in `MUX_TOKEN_ID` and `MUX_TOKEN_SECRET` on the metadata service and worker. Mux usage may incur charges. Open **Live**, create a broadcast and copy its server and private stream key into OBS. Start streaming from OBS. A metadata worker checks provider state and publishes the recording to the creator’s channel once ready. Select **End broadcast** to disable the ingest key.
