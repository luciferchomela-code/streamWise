import React, { useRef, useState } from 'react';

/**
 * VideoUploader
 *
 * A self-contained, reusable video file selection component.
 * Handles drag & drop, local file info preview, and duration detection.
 *
 * NOTE: Unlike ImageUploader, this component does NOT upload to Cloudinary
 * automatically — video upload requires a backend `videoId` first (from the
 * draft step). Instead it calls `onFileSelected(file)` when a file is picked,
 * and the parent page triggers the actual upload via `useVideoUpload`.
 *
 * While uploading, the parent passes `uploading` and `progress` props back down
 * so this component can render the upload progress overlay.
 *
 * Props:
 *  - onFileSelected: (file: File) => void  — called when user picks a video
 *  - uploading: boolean                    — parent signals upload in progress
 *  - progress: number                      — 0–100, shown in progress bar
 *  - statusText: string                    — label shown above the progress bar
 *  - disabled: boolean
 *  - className: string
 *
 * Usage:
 *   const [videoFile, setVideoFile] = useState(null);
 *   const { uploadVideo, uploading, progress } = useVideoUpload();
 *
 *   <VideoUploader
 *     onFileSelected={setVideoFile}
 *     uploading={uploading}
 *     progress={progress}
 *     statusText="Uploading video…"
 *   />
 */

const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/mpeg'];

const formatFileSize = (bytes) => {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
};

const formatDuration = (seconds) => {
  if (!seconds || !isFinite(seconds)) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

export default function VideoUploader({
  onFileSelected,
  uploading = false,
  progress = 0,
  statusText = 'Uploading…',
  disabled = false,
  className = '',
}) {
  const fileInputRef = useRef(null);
  const videoPreviewRef = useRef(null);
  const [file, setFile] = useState(null);
  const [detectedDuration, setDetectedDuration] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  const processFile = (f) => {
    if (!f) return;
    if (!f.type.startsWith('video/') && !ACCEPTED_TYPES.includes(f.type)) return;

    setFile(f);

    // Create a temporary object URL for preview and duration detection
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);

    if (onFileSelected) onFileSelected(f);
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled || uploading) return;
    const f = e.dataTransfer.files?.[0];
    if (f) processFile(f);
  };

  const handleClick = () => {
    if (!disabled && !uploading && !file) {
      fileInputRef.current?.click();
    }
  };

  const handleRemove = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setDetectedDuration(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (onFileSelected) onFileSelected(null);
  };

  const handleMetadata = () => {
    const vid = videoPreviewRef.current;
    if (vid && vid.duration) {
      setDetectedDuration(vid.duration);
    }
  };

  const isInteractive = !disabled && !uploading;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div
        role={!file ? 'button' : undefined}
        tabIndex={isInteractive && !file ? 0 : -1}
        onClick={handleClick}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        onDragOver={(e) => { e.preventDefault(); if (isInteractive) setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={[
          'relative overflow-hidden rounded-xl border-2 transition-all select-none',
          'aspect-video',
          !file && isInteractive ? 'cursor-pointer' : '',
          isDragOver
            ? 'border-cyan-400 bg-cyan-500/10'
            : file
            ? 'border-white/10 bg-black'
            : 'border-dashed border-white/20 bg-[#0B0D12] hover:border-cyan-400/60 hover:bg-white/5',
        ].join(' ')}
      >
        {/* Hidden video element for duration detection + thumbnail frame */}
        {previewUrl && (
          <video
            ref={videoPreviewRef}
            src={previewUrl}
            className="w-full h-full object-cover"
            onLoadedMetadata={handleMetadata}
            muted
            playsInline
            preload="metadata"
          />
        )}

        {/* Upload progress overlay */}
        {uploading && (
          <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-4 backdrop-blur-sm px-6">
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="none" stroke="white" strokeOpacity="0.1" strokeWidth="4" />
                <circle
                  cx="32" cy="32" r="28"
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 28}`}
                  strokeDashoffset={`${2 * Math.PI * 28 * (1 - progress / 100)}`}
                  className="transition-all duration-300"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
                {progress}%
              </span>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-cyan-400">{statusText}</p>
              <p className="text-xs text-gray-500 mt-1">Please do not close this page</p>
            </div>
          </div>
        )}

        {/* File selected — info bar at bottom */}
        {file && !uploading && (
          <>
            {/* Play icon overlay */}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm">
                <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>

            {/* Bottom info bar */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm px-3 py-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <svg className="w-4 h-4 text-cyan-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span className="text-xs text-white truncate">{file.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-xs text-gray-400">
                {detectedDuration && <span>{formatDuration(detectedDuration)}</span>}
                <span>{formatFileSize(file.size)}</span>
              </div>
            </div>

            {/* Remove button */}
            {isInteractive && (
              <button
                type="button"
                onClick={handleRemove}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 border border-white/20 flex items-center justify-center text-gray-300 hover:text-white hover:bg-red-500/80 transition-colors backdrop-blur-sm"
                aria-label="Remove video"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </>
        )}

        {/* Empty state */}
        {!file && !uploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-6">
            <div className={`w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/10 transition-transform ${isDragOver ? 'scale-110' : ''}`}>
              <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-white mb-1">
                {isDragOver ? 'Drop to select' : 'Click or drag & drop a video'}
              </p>
              <p className="text-xs text-gray-500">MP4, MOV, AVI, WebM supported</p>
            </div>
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/x-msvideo,video/webm,video/mpeg"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || uploading}
      />
    </div>
  );
}
