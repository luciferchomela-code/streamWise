import { useState, useCallback } from 'react';
import { uploadService } from '../services/uploadService';

/**
 * useVideoUpload
 *
 * Handles the full frontend→Cloudinary video upload flow:
 *   1. Request a signed upload signature from your backend using the videoId
 *   2. Upload the file directly to Cloudinary from the browser
 *   3. Return { videoUrl, publicId, duration }
 *
 * NOTE: Unlike image uploads, video upload requires a `videoId` (obtained after
 * creating a draft) so it is triggered imperatively via `uploadVideo(file, videoId)`
 * rather than automatically when a file is selected.
 *
 * Usage:
 *   const { uploadVideo, uploading, progress, error } = useVideoUpload();
 *   const result = await uploadVideo(file, videoId);
 *   // result → { videoUrl, publicId, duration }
 */
export const useVideoUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const uploadVideo = useCallback(async (file, videoId) => {
    if (!file) throw new Error('No video file provided');
    if (!videoId) throw new Error('videoId is required to upload a video');

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      // Step 1: Get signed upload params from our backend (tied to this videoId)
      const signatureData = await uploadService.getVideoSignature(videoId);

      // Step 2: Upload directly to Cloudinary with the signature
      const cloudinaryResponse = await uploadService.uploadToCloudinary(
        file,
        signatureData,
        (pct) => setProgress(pct)
      );

      return {
        videoUrl: cloudinaryResponse.secure_url,
        publicId: cloudinaryResponse.public_id,
        duration: cloudinaryResponse.duration || 0,
      };
    } catch (err) {
      const msg = err.message || 'Video upload failed';
      setError(msg);
      throw new Error(msg);
    } finally {
      setUploading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setUploading(false);
    setProgress(0);
    setError(null);
  }, []);

  return { uploadVideo, uploading, progress, error, reset };
};
