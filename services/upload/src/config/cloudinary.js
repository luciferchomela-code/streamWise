import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { Readable } from "stream";

// ─── Allowed MIME types ───────────────────────────────────────────────────────
const ALLOWED_IMAGE_MIMETYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// ─── Lazy Cloudinary init ─────────────────────────────────────────────────────
// dotenv.config() in index.js runs BEFORE routes are hit, so by the time
// any request arrives, process.env is fully populated. We configure Cloudinary
// on first use so we are guaranteed the env vars are present.
let _cloudinaryConfigured = false;
const ensureCloudinaryConfig = () => {
  if (_cloudinaryConfigured) return;
  cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_SECRET_KEY,
  });
  _cloudinaryConfigured = true;
};

// ─── Generate Signed Upload Parameters for Direct Uploads (Option B) ─────────
export const generateImageSignature = (folderType = "image") => {
  ensureCloudinaryConfig();
  const timestamp = Math.round(new Date().getTime() / 1000);
  const folder = `streamwise/${folderType}s`;

  const paramsToSign = {
    timestamp,
    folder,
  };

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUD_SECRET_KEY
  );

  return {
    signature,
    timestamp,
    folder,
    apiKey: process.env.CLOUD_API_KEY,
    cloudName: process.env.CLOUD_NAME,
    uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUD_NAME}/image/upload`,
  };
};

export { cloudinary, ensureCloudinaryConfig };
