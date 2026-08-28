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
