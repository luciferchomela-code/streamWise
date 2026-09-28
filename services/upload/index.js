import express from "express";
import dotenv from "dotenv";
import uploadRoutes from "./src/routes/upload.routes.js";

dotenv.config();

const app = express();

app.use(express.json());

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
