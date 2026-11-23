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
  uploadToCloudinary: async (file, signatureData, onProgress, headers = {}) => {
    const { signature, timestamp, apiKey, uploadUrl, folder, publicId, overwrite, eager, eagerAsync } = signatureData;
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp);
    formData.append('signature', signature);
    if (folder) formData.append('folder', folder);

    // These MUST be included if they were part of the signed params
    if (publicId) formData.append('public_id', publicId);
    if (overwrite !== undefined) formData.append('overwrite', String(overwrite));
    if (eager) formData.append('eager', eager);
    if (eagerAsync !== undefined) formData.append('eager_async', eagerAsync ? 'true' : 'false');
    
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadUrl);
      xhr.timeout = 120000;
      for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);

      if (onProgress && xhr.upload) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            onProgress(percentComplete);
          }
        };
      }

      xhr.onload = () => {
        let response;
        try { response = JSON.parse(xhr.responseText); } catch {}
        if (xhr.status >= 200 && xhr.status < 300 && response) {
          resolve(response);
        } else {
          reject(Object.assign(new Error(response?.error?.message || 'Upload failed.'), {
            status: xhr.status, retryable: xhr.status === 429 || xhr.status >= 500,
          }));
        }
      };

      xhr.onerror = xhr.ontimeout = () =>
        reject(Object.assign(new Error('Upload interrupted. Retry to continue.'), { retryable: true }));
      xhr.send(formData);
    });
  }
};
