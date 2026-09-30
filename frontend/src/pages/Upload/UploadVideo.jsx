import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../../components/layout/Navbar/Navbar';
import { Sidebar } from '../../components/layout/Sidebar/Sidebar';
import { videoService } from '../../services/videoService';
import { useAuth } from '../../hooks/useAuth';
import ImageUploader from '../../components/common/ImageUploader/ImageUploader';
import VideoUploader from '../../components/common/VideoUploader/VideoUploader';
import { useVideoUpload } from '../../hooks/useVideoUpload';

export default function UploadVideo() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // ── Form fields ──────────────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('public');

  // ── Managed by child uploaders ───────────────────────────────────────────────
  const [thumbnailUrl, setThumbnailUrl] = useState('');   // set by <ImageUploader>
  const [videoFile, setVideoFile] = useState(null);        // set by <VideoUploader>

  // ── Upload flow ──────────────────────────────────────────────────────────────
  const { uploadVideo, uploading: videoUploading, progress: videoProgress } = useVideoUpload();
  const [statusText, setStatusText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const uploading = submitting || videoUploading;

  // ─── Derived readiness ────────────────────────────────────────────────────
  const canSubmit =
    !uploading &&
    videoFile &&
    thumbnailUrl &&
    title.trim() &&
    description.trim();

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) {
      setError('Please fill in all required fields, upload a thumbnail, and select a video file.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Step 1: Create draft — thumbnail is already a Cloudinary URL
      setStatusText('Creating video draft…');
      const draftVideo = await videoService.createDraft({
        title,
        description,
        visibility,
        thumbnailUrl,
      });
      const videoId = draftVideo._id || draftVideo.id;

      // Step 2: Upload video to Cloudinary (useVideoUpload tracks its own progress)
      setStatusText('Uploading video…');
      const { videoUrl, publicId, duration } = await uploadVideo(videoFile, videoId);

      // Step 3: Finalize — mark the video as ready in the backend
      setStatusText('Finalizing…');
      await videoService.finalizeVideo(videoId, { videoUrl, publicId, duration });

      setStatusText('Upload complete! 🎉');
      setTimeout(() => navigate('/channel'), 1500);
    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred during upload.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Guard ────────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0B0D12] text-white flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400">Please sign in to upload videos.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0D12] text-white flex flex-col font-sans">
      <Navbar />
      <div className="flex-1 flex">
        <Sidebar />

        <main className="flex-1 lg:pl-64 p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto w-full">
          {/* Page header */}
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
              Upload Video
            </h1>
            <p className="text-gray-400">Share your content with the world.</p>
          </div>

          {/* Global error */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* ── Left column: details + thumbnail ─────────────────────────── */}
            <div className="lg:col-span-2 space-y-6">

              {/* Details */}
              <div className="bg-[#151923] rounded-2xl p-6 border border-white/5 shadow-lg">
                <h2 className="text-xl font-bold mb-4">Details</h2>
                <div className="space-y-4">

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Title <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Add a title that describes your video"
                      className="w-full bg-[#0B0D12] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors"
                      disabled={uploading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Description <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      required
                      rows={5}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Tell viewers about your video"
                      className="w-full bg-[#0B0D12] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors resize-none"
                      disabled={uploading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Visibility</label>
                    <select
                      value={visibility}
                      onChange={(e) => setVisibility(e.target.value)}
                      className="w-full bg-[#0B0D12] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors"
                      disabled={uploading}
                    >
                      <option value="public">Public – Everyone can watch</option>
                      <option value="unlisted">Unlisted – Anyone with the link can watch</option>
                      <option value="private">Private – Only you can watch</option>
                    </select>
                  </div>

                </div>
              </div>

              {/* Thumbnail — uploads independently to Cloudinary on selection */}
              <div className="bg-[#151923] rounded-2xl p-6 border border-white/5 shadow-lg">
                <h2 className="text-xl font-bold mb-1">Thumbnail</h2>
                <p className="text-sm text-gray-500 mb-4">
                  Uploaded directly to Cloudinary from your browser the moment you pick a file.
                </p>

                <ImageUploader
                  imageType="thumbnail"
                  aspectRatio="16 / 9"
                  label="Thumbnail image"
                  hint="PNG, JPG, WEBP · Recommended 1280×720"
                  disabled={uploading}
                  onUploadComplete={(url) => setThumbnailUrl(url)}
                />

                {thumbnailUrl && (
                  <p className="mt-2 text-xs text-cyan-400 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    Thumbnail uploaded successfully
                  </p>
                )}
              </div>

            </div>

            {/* ── Right column: video + actions ────────────────────────────── */}
            <div className="space-y-6">

              {/* Video file — selection only; upload fires on form submit */}
              <div className="bg-[#151923] rounded-2xl p-6 border border-white/5 shadow-lg">
                <h2 className="text-xl font-bold mb-1">Video File</h2>
                <p className="text-sm text-gray-500 mb-4">
                  Uploaded directly to Cloudinary when you click "Upload Video".
                </p>

                <VideoUploader
                  onFileSelected={(f) => {
                    setVideoFile(f);
                    if (f && !title) {
                      setTitle(f.name.replace(/\.[^/.]+$/, ''));
                    }
                  }}
                  uploading={videoUploading}
                  progress={videoProgress}
                  statusText={statusText}
                  disabled={submitting && !videoUploading}
                />

                {videoFile && !videoUploading && (
                  <p className="mt-2 text-xs text-gray-400 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-violet-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Video will upload to Cloudinary when you submit
                  </p>
                )}
              </div>

              {/* Submit / status card */}
              <div className="bg-[#151923] rounded-2xl p-6 border border-white/5 shadow-lg">
                {!uploading ? (
                  <>
                    <button
                      type="submit"
                      disabled={!canSubmit}
                      className="w-full py-3 bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-600 hover:to-cyan-600 text-white font-bold rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Upload Video
                    </button>

                    {/* Checklist to guide user */}
                    <ul className="mt-4 space-y-1.5">
                      {[
                        { done: !!title.trim(), label: 'Title added' },
                        { done: !!description.trim(), label: 'Description added' },
                        { done: !!thumbnailUrl, label: 'Thumbnail uploaded' },
                        { done: !!videoFile, label: 'Video file selected' },
                      ].map(({ done, label }) => (
                        <li key={label} className="flex items-center gap-2 text-xs">
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${done ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-gray-600'}`}>
                            {done ? (
                              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <span className="w-1 h-1 rounded-full bg-gray-600 block" />
                            )}
                          </span>
                          <span className={done ? 'text-gray-300' : 'text-gray-600'}>{label}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-cyan-400">{statusText}</span>
                      {videoUploading && (
                        <span className="text-gray-400 tabular-nums">{videoProgress}%</span>
                      )}
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          videoUploading ? 'bg-cyan-400' : 'bg-violet-500 animate-pulse'
                        }`}
                        style={{ width: videoUploading ? `${videoProgress}%` : '100%' }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 text-center">Please do not close this page.</p>
                  </div>
                )}
              </div>

            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
