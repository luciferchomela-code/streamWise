import express from "express";
import dotenv from "dotenv";
import uploadRoutes from "./src/routes/upload.routes.js";

dotenv.config();

const app = express();

// Base64 media is supported only as a small-development convenience.
// Production video uploads should use multipart or direct signed Cloudinary uploads.
app.use(express.json({ limit: "50mb" }));

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "video-upload" });
});

app.use("/api/upload", uploadRoutes);

app.use((error, req, res, next) => {
  console.error(error);

  if (res.headersSent) {
    return next(error);
  }

  res.status(error.statusCode || 500).json({
    message: error.message || "Internal server error",
  });
});

const PORT = process.env.PORT || 5003;

app.listen(PORT, () => {
  console.log(`Video upload service running on port ${PORT}`);
});
