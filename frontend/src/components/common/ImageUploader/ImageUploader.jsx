import React, { useRef, useState } from 'react';
import { useImageUpload } from '../../../hooks/useImageUpload';

/**
 * ImageUploader
 *
 * A self-contained, reusable image upload component.
 * Handles file selection, local preview, and uploading directly to Cloudinary
 * via a backend-generated signature.
 *
 * Props:
 *  - imageType: 'thumbnail' | 'avatar' | 'banner'  (default: 'thumbnail')
 *  - aspectRatio: CSS aspect-ratio string (default: '16 / 9')
 *  - label: string - Label shown above the picker
 *  - hint: string - Small helper text below label
 *  - onUploadComplete: (url: string) => void - Called with Cloudinary URL on success
 *  - disabled: boolean
 *  - className: string - Extra classes for the wrapper div
 *
 * Usage:
 *   <ImageUploader
 *     imageType="thumbnail"
 *     label="Thumbnail"
 *     onUploadComplete={(url) => setThumbnailUrl(url)}
 *   />
 */
export default function ImageUploader({
  imageType = 'thumbnail',
  aspectRatio = '16 / 9',
  label = 'Upload Image',
  hint = 'PNG, JPG, WEBP supported',
  onUploadComplete,
  disabled = false,
  className = '',
}) {
  const fileInputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const { uploadImage, uploading, progress, error } = useImageUpload(imageType);

  const processFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return;

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);

    try {
      const url = await uploadImage(file);
      if (onUploadComplete) onUploadComplete(url);
    } catch {
      // error is already set by the hook
      setPreview(null);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled || uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleClick = () => {
    if (!disabled && !uploading) {
      fileInputRef.current?.click();
    }
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (onUploadComplete) onUploadComplete('');
  };

  const isInteractive = !disabled && !uploading;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Label + Hint */}
      {label && (
        <div>
          <span className="block text-sm font-medium text-gray-400">{label}</span>
          {hint && <span className="text-xs text-gray-600">{hint}</span>}
        </div>
      )}

      {/* Drop Zone */}
      <div
        role="button"
        tabIndex={isInteractive ? 0 : -1}
        onClick={handleClick}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        onDragOver={(e) => { e.preventDefault(); if (isInteractive) setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={[
          'relative overflow-hidden rounded-xl border-2 transition-all select-none',
          isInteractive ? 'cursor-pointer' : 'cursor-not-allowed opacity-60',
          isDragOver
            ? 'border-cyan-400 bg-cyan-500/10'
            : preview
            ? 'border-white/20'
            : 'border-dashed border-white/20 hover:border-cyan-400/60 hover:bg-white/5',
        ].join(' ')}
        style={{ aspectRatio }}
      >
        {/* Preview image */}
        {preview && (
          <img
            src={preview}
            alt="Preview"
            className="w-full h-full object-cover"
          />
        )}

        {/* Upload progress overlay */}
        {uploading && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3 backdrop-blur-sm">
            <svg className="w-8 h-8 text-cyan-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <div className="w-3/4">
              <div className="flex justify-between text-xs text-gray-300 mb-1">
                <span>Uploading…</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-cyan-400 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Empty state placeholder */}
        {!preview && !uploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-4">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-300">
              {isDragOver ? 'Drop to upload' : 'Click or drag & drop'}
            </p>
            {hint && <p className="text-xs text-gray-600">{hint}</p>}
          </div>
        )}

        {/* Remove button — only shown when there's a preview and not uploading */}
        {preview && !uploading && isInteractive && (
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 border border-white/20 flex items-center justify-center text-gray-300 hover:text-white hover:bg-red-500/80 transition-colors backdrop-blur-sm"
            aria-label="Remove image"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-400 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </p>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || uploading}
      />
    </div>
  );
}
