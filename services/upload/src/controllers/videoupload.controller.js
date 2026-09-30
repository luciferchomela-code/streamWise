import {
  cloudinary,
  ensureCloudinaryConfig,
  generateVideoSignature,
} from "../config/cloudinary.js";

export const getVideoSignature = async (req, res, next) => {
  try {
    const { videoId } = req.query;

    if (!videoId) {
      return res.status(400).json({ message: "videoId query param is required." });
    }

    const signatureData = generateVideoSignature(videoId);

    return res.status(200).json({
      success: true,
      videoId,
      ...signatureData,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteVideo = async (req, res, next) => {
  try {
    const { publicId } = req.query;

    if (!publicId) {
      return res.status(400).json({ message: "publicId query param is required." });
    }

    ensureCloudinaryConfig();

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: "video",
    });

    return res.status(200).json({ success: true, result: result.result });
  } catch (error) {
    next(error);
  }
};
