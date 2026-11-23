import { apiFetch, API_BASE_URL } from './apiFetch';

export const sleepWithJitter = (attempt, baseDelay = 1000, maxDelay = 15000) => {
  const exp = Math.min(maxDelay, baseDelay * Math.pow(2, attempt));
  const jitter = 0.8 + Math.random() * 0.4;
  const delay = Math.round(exp * jitter);
  return new Promise(resolve => setTimeout(resolve, delay));
};

export const uploadService = {
  // Fetch image signature
  getImageSignature: async (type = 'thumbnail') => {
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await apiFetch(`${API_BASE_URL}/upload/image/signature?type=${type}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Failed to get image signature');
        return data;
      } catch (err) {
        lastErr = err;
        if (attempt < 2) await sleepWithJitter(attempt);
      }
    }
    throw lastErr;
  },

  // Fetch video signature
  getVideoSignature: async (videoId) => {
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await apiFetch(`${API_BASE_URL}/upload/video/signature?videoId=${videoId}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Failed to get video signature');
        return data;
      } catch (err) {
        lastErr = err;
        if (attempt < 2) await sleepWithJitter(attempt);
      }
    }
    throw lastErr;
  },

  // Upload to Cloudinary with chunk resumption & jittered exponential backoff
  uploadToCloudinary: async (file, signatureData, onProgress) => {
    const { signature, timestamp, apiKey, cloudName, folder, publicId, eager, eagerAsync } = signatureData;
    const resourceType = file.type.startsWith('video/') ? 'video' : 'image';
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

    const CHUNK_SIZE = 6 * 1024 * 1024; // 6MB chunks for videos > 20MB
    const isChunked = resourceType === 'video' && file.size > 20 * 1024 * 1024;
    const uniqueUploadId = publicId || `up_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    if (!isChunked) {
      // Standard single-shot upload with exponential backoff retry
      let lastError;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          return await new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('api_key', apiKey);
            formData.append('timestamp', timestamp);
            formData.append('signature', signature);
            formData.append('folder', folder);
            if (publicId) formData.append('public_id', publicId);
            if (eager) formData.append('eager', eager);
            if (eagerAsync !== undefined) formData.append('eager_async', eagerAsync ? 'true' : 'false');

            const xhr = new XMLHttpRequest();
            xhr.open('POST', uploadUrl);
            if (onProgress && xhr.upload) {
              xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                  onProgress(Math.round((e.loaded / e.total) * 100));
                }
              };
            }
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve(JSON.parse(xhr.responseText));
              } else {
                reject(new Error(xhr.responseText || 'Upload failed'));
              }
            };
            xhr.onerror = () => reject(new Error('Network error during upload'));
            xhr.send(formData);
          });
        } catch (err) {
          lastError = err;
          if (attempt < 2) await sleepWithJitter(attempt);
        }
      }
      throw lastError;
    }

    // Chunked Resumable Upload
    let start = 0;
    let finalResponse = null;

    while (start < file.size) {
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      let chunkSuccess = false;
      let chunkError = null;

      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          finalResponse = await new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('file', chunk);
            formData.append('api_key', apiKey);
            formData.append('timestamp', timestamp);
            formData.append('signature', signature);
            formData.append('folder', folder);
            if (publicId) formData.append('public_id', publicId);
            if (eager) formData.append('eager', eager);
            if (eagerAsync !== undefined) formData.append('eager_async', eagerAsync ? 'true' : 'false');

            const xhr = new XMLHttpRequest();
            xhr.open('POST', uploadUrl);
            xhr.setRequestHeader('X-Unique-Upload-Id', uniqueUploadId);
            xhr.setRequestHeader('Content-Range', `bytes ${start}-${end - 1}/${file.size}`);

            if (onProgress && xhr.upload) {
              xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                  const bytesSent = start + e.loaded;
                  onProgress(Math.min(99, Math.round((bytesSent / file.size) * 100)));
                }
              };
            }
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve(JSON.parse(xhr.responseText));
              } else {
                reject(new Error(xhr.responseText || `Chunk upload failed (${xhr.status})`));
              }
            };
            xhr.onerror = () => reject(new Error('Network error during chunk upload'));
            xhr.send(formData);
          });
          chunkSuccess = true;
          break;
        } catch (err) {
          chunkError = err;
          await sleepWithJitter(attempt);
        }
      }

      if (!chunkSuccess) {
        throw new Error(`Upload failed at chunk [${start}-${end}]: ${chunkError?.message}`);
      }

      start = end;
    }

    if (onProgress) onProgress(100);
    return finalResponse;
  }
};
