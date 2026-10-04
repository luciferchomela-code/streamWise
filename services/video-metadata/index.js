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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", service: "video-metadata" });
});

app.use("/api/videos", videoRoutes);
app.use("/api/channels", channelRoutes);
app.use("/api/interactions", interactionRoutes);
app.use((err, req, res, next) => {
    console.error(`[Video-Metadata Error]: ${err.message}`);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal Server Error",
    });
});

const PORT = process.env.PORT || 5002;

connectDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Video metadata service running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error("Database connection failed:", error.message);
        process.exit(1);
    });