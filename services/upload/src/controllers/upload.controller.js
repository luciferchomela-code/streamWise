import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_SECRET_KEY,
});

const uploadMedia = (kind) => async (req, res, next) => {
  try {
    const { videoId, data, buffer } = req.body;
    const media = data || buffer;

    if (!videoId) {
      return res.status(400).json({ message: "videoId is required" });
    }

    if (!media) {
      return res.status(400).json({ message: "Media data is required" });
    }

    const uploadedMedia = await cloudinary.uploader.upload(media, {
      resource_type: kind === "video" ? "video" : "image",
      folder: `streamwise/${kind}s`,
      public_id: `${videoId}-${kind}`,
      overwrite: true,
    });

    // RabbitMQ publishing is added after the broker and event contract are ready.
    res.status(201).json({
      videoId,
      status: `${kind}-uploaded`,
      [kind === "video" ? "videoUrl" : "thumbnailUrl"]: uploadedMedia.secure_url,
      ...(kind === "video" ? { duration: uploadedMedia.duration || null } : {}),
      publicId: uploadedMedia.public_id,
    });
  } catch (error) {
    next(error);
  }
};

export const uploadVideo = uploadMedia("video");
export const uploadThumbnail = uploadMedia("thumbnail");
