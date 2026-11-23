import community from "./routes/community.routes.js";
import {startNotifications} from "./utils/communityEvents.js";
import {startBroadcasts} from "./utils/broadcast.js";
import mongoose from "mongoose";
import { studio, playlists, captions, moderation } from "./routes/features.routes.js";
import { startOutbox } from "./utils/outbox.js";
import { startProcessing } from "./controllers/video.controllers.js";
import playbackHealth from "./routes/playbackHealth.routes.js";
import { startPlaybackConsumer } from "./utils/playbackHealth.js";
import { PlaybackBucket, PlaybackEvent, UploadProcessingRun } from "./models/playbackHealth.js";
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import videoRoutes from "./routes/video.routes.js";
import channelRoutes from "./routes/channel.routes.js";
import interactionRoutes from "./routes/interaction.routes.js";
import connectDB from "../shared/config/db.js";
import "../shared/models/user.model.js";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", service: "video-metadata" });
});

app.use("/api/community",community);
app.use("/api/studio", studio);
app.use("/api/playlists", playlists);
app.use("/api/captions", captions);
app.use("/api/moderation", moderation);
app.use("/api/playback-health", playbackHealth);
app.use("/api/videos", videoRoutes);
app.use("/api/channels", channelRoutes);
app.use("/api/interactions", interactionRoutes);
app.use((err, req, res, next) => {
    console.error("[video-metadata]", req.get("x-request-id"), err.message);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal Server Error",
    });
});

const PORT = process.env.PORT || 5002;

connectDB()
    .then(async () => {
        const topology = await mongoose.connection.db.admin().command({ hello: 1 });
        if (!topology.setName && topology.msg !== "isdbgrid") {
            throw new Error("Video metadata requires a MongoDB replica set or sharded cluster.");
        }
        await Promise.all([PlaybackBucket.init(), PlaybackEvent.init(), UploadProcessingRun.init()]);
        const workerOnly = process.env.VIDEO_METADATA_WORKER_ONLY === "true";
        if (workerOnly || process.env.VIDEO_METADATA_RUN_WORKERS !== "false") {
            startNotifications();
            startBroadcasts();
            startOutbox();
            startProcessing();
            startPlaybackConsumer();
        }
        if (workerOnly) return;
        app.listen(PORT, () => {
            console.log(`Video metadata service running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error("Database connection failed:", error.message);
        process.exit(1);
    });
