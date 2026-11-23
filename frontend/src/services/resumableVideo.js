import { uploadService } from './uploadService';

const CHUNK_SIZE = 8 * 1024 * 1024;
const CHECKPOINT_AGE = 30 * 60 * 1000;

export function readUpload(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || null;
  } catch {
    return null;
  }
}

export function saveUpload(key, checkpoint) {
  try {
    if (checkpoint) localStorage.setItem(key, JSON.stringify(checkpoint));
    else localStorage.removeItem(key);
  } catch {
    // The in-memory checkpoint still supports a retry on this page.
  }
}

export async function fileFingerprint(file) {
  const starts = [0, Math.max(0, Math.floor(file.size / 2) - 32768), Math.max(0, file.size - 65536)];
  const samples = starts.map((start) => file.slice(start, start + 65536));
  const buffer = await new Blob([JSON.stringify([file.name, file.size, file.lastModified]), ...samples]).arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash), (value) => value.toString(16).padStart(2, '0')).join('');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendChunk(blob, signature, onProgress, headers) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await uploadService.uploadToCloudinary(blob, signature, onProgress, headers);
    } catch (error) {
      if (!error.retryable || attempt >= 2) throw error;
      await delay(500 * 2 ** attempt + Math.random() * 250);
    }
  }
}

export async function resumeVideoUpload(file, checkpoint, save, onProgress) {
  if (checkpoint.publicId) return checkpoint.publicId;
  const signature = await uploadService.getVideoSignature(checkpoint.videoId);
  if (!checkpoint.uploadId || Date.now() - checkpoint.updatedAt > CHECKPOINT_AGE) {
    checkpoint.uploadId = crypto.randomUUID();
    checkpoint.offset = 0;
    checkpoint.updatedAt = Date.now();
    save(checkpoint);
  }

  const isChunked = file.size > CHUNK_SIZE;
  while (checkpoint.offset < file.size) {
    const start = checkpoint.offset;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = isChunked ? file.slice(start, end, file.type) : file;
    const headers = isChunked ? {
      'X-Unique-Upload-Id': checkpoint.uploadId,
      'Content-Range': `bytes ${start}-${end - 1}/${file.size}`,
    } : {};
    let result;
    try {
      result = await sendChunk(chunk, signature, (percent) => {
        onProgress(Math.round((start + (end - start) * percent / 100) / file.size * 100));
      }, headers);
    } catch (error) {
      if (error.status === 400 && start > 0) {
        checkpoint.uploadId = null;
        checkpoint.offset = 0;
        save(checkpoint);
        throw new Error('The upload session expired. Retry to restart the file upload.');
      }
      throw error;
    }
    if (end === file.size && result.public_id !== signature.publicId) {
      throw new Error('Cloudinary did not confirm the complete upload.');
    }
    if (end < file.size && result.done !== false) {
      throw new Error('Cloudinary did not acknowledge the upload chunk.');
    }
    checkpoint.offset = end;
    checkpoint.updatedAt = Date.now();
    if (end === file.size) checkpoint.publicId = result.public_id;
    save(checkpoint);
  }
  return checkpoint.publicId;
}
