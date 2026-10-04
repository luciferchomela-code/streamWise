import { apiFetch, API_BASE_URL } from './apiFetch';

export const uploadService = {
  // Fetch image signature
  getImageSignature: async (type = 'thumbnail') => {
    const res = await apiFetch(`${API_BASE_URL}/upload/image/signature?type=${type}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to get image signature');
    return data;
  },

  // Fetch video signature
  getVideoSignature: async (videoId) => {
    const res = await apiFetch(`${API_BASE_URL}/upload/video/signature?videoId=${videoId}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to get video signature');
    return data;
  },

  // Upload to Cloudinary using signature
  uploadToCloudinary: async (file, signatureData, onProgress) => {
    const { signature, timestamp, apiKey, cloudName, folder, publicId, eager, eagerAsync } = signatureData;
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp);
    formData.append('signature', signature);
    formData.append('folder', folder);

    // These MUST be included if they were part of the signed params
    if (publicId) formData.append('public_id', publicId);
    if (eager) formData.append('eager', eager);
    if (eagerAsync !== undefined) formData.append('eager_async', eagerAsync ? 'true' : 'false');
    
    // Determine resource type (image or video) based on file type
    const resourceType = file.type.startsWith('video/') ? 'video' : 'image';
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadUrl);

      if (onProgress && xhr.upload) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            onProgress(percentComplete);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } else {
          reject(new Error(xhr.responseText || 'Upload failed'));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(formData);
    });
  }
};
