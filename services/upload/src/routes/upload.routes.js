import express from "express";
import { uploadThumbnail, uploadVideo } from "../controllers/upload.controller.js";

const router = express.Router();

router.post("/video", uploadVideo);
router.post("/thumbnail", uploadThumbnail);

export default router;
