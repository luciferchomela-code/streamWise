import { useState, useCallback } from 'react';
import { uploadService } from '../services/uploadService';

/**
 * useImageUpload
 *
 * A modular hook that handles the full frontend→Cloudinary image upload flow:
 *   1. Request a signed upload signature from your backend
 *   2. Upload the file directly to Cloudinary from the browser
 *   3. Return the secure Cloudinary URL
 *
 * @param {'thumbnail' | 'avatar' | 'banner'} imageType - The type of image (used to pick the correct backend folder)
 *
 * Usage:
 *   const { uploadImage, uploading, progress, error } = useImageUpload('thumbnail');
 *   const url = await uploadImage(file);
 */
export const useImageUpload = (imageType = 'thumbnail') => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const uploadImage = useCallback(async (file) => {
    if (!file) throw new Error('No file provided');

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      // Step 1: Get signed upload params from our backend
      const signatureData = await uploadService.getImageSignature(imageType);

      // Step 2: Upload directly to Cloudinary with the signature
      const cloudinaryResponse = await uploadService.uploadToCloudinary(
        file,
        signatureData,
        (pct) => setProgress(pct)
      );

      // Step 3: Return the public URL
      return cloudinaryResponse.secure_url;
    } catch (err) {
      const msg = err.message || 'Image upload failed';
      setError(msg);
      throw new Error(msg);
    } finally {
      setUploading(false);
    }
  }, [imageType]);

  const reset = useCallback(() => {
    setUploading(false);
    setProgress(0);
    setError(null);
  }, []);

  return { uploadImage, uploading, progress, error, reset };
};
