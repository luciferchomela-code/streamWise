import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { videoService } from '../../services/videoService';
import { useAuth } from '../../hooks/useAuth';
import ImageUploader from '../../components/common/ImageUploader/ImageUploader';
import { fileFingerprint, readUpload, resumeVideoUpload, saveUpload } from '../../services/resumableVideo';

export default function UploadVideo() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // ── Form fields ──────────────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [category, setCategory] = useState('General');

  // ── Managed by child uploaders ───────────────────────────────────────────────
  const [thumbnailUrl, setThumbnailUrl] = useState('');   // set by <ImageUploader>
  const [videoFile, setVideoFile] = useState(null);        // set by <VideoUploader>

  // ── Upload flow ──────────────────────────────────────────────────────────────
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const checkpointRef = useRef(null);
  const selectionRef = useRef(null);
  const key = `streamwise-upload:${user?._id || user?.id}`;
  const selectFile = async (file) => {
    selectionRef.current = file;
    setVideoFile(file);
    if (!file) return;
    try {
      const fingerprint = await fileFingerprint(file);
      if (selectionRef.current !== file) return;
      const saved = checkpointRef.current || readUpload(key);
      if (saved?.fingerprint === fingerprint && saved.fields) {
        setTitle(saved.fields.title);
        setDescription(saved.fields.description);
        setVisibility(saved.fields.visibility);
        setCategory(saved.fields.category);
        setThumbnailUrl(saved.fields.thumbnailUrl);
        setStatusText('Upload checkpoint found. Submit to resume.');
      }
    } catch {}
  };
  const [statusText, setStatusText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const uploading = submitting || videoUploading;

  // ─── Derived readiness ────────────────────────────────────────────────────
  const canSubmit =
    !uploading &&
    videoFile?.size > 0 &&
    title.trim() &&
    description.trim();

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) {
      setError('Please fill in all required fields and select a video file.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const fingerprint = await fileFingerprint(videoFile);
      let checkpoint = checkpointRef.current || readUpload(key);
      if (checkpoint?.fingerprint !== fingerprint) {
        setStatusText('Creating video draft.');
        const fields = { title, description, visibility, category, thumbnailUrl };
        const draft = await videoService.createDraft(fields);
        checkpoint = { fingerprint, videoId: draft._id || draft.id, fields, offset: 0 };
      }
      const save = (value) => {
        checkpointRef.current = value;
        saveUpload(key, value);
      };
      save(checkpoint);
      setStatusText('Uploading video.');
      setVideoUploading(true);
      setVideoProgress(Math.round((checkpoint.offset || 0) / videoFile.size * 100));
      const publicId = await resumeVideoUpload(videoFile, checkpoint, save, setVideoProgress);
      setVideoUploading(false);
      setStatusText('Queuing video processing.');
      await videoService.finalizeVideo(checkpoint.videoId, { publicId });
      save(null);
      navigate('/studio');
    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred during upload.');
    } finally {
      setVideoUploading(false);
      setSubmitting(false);
    }
  };

  // ─── Guard ────────────────────────────────────────────────────────────────

  if(!user)return <main className="folio"><a href="/login">Sign in to upload</a></main>;
  return <main className="desk"><header><h1>Upload a video</h1></header><form className="submission" onSubmit={handleSubmit}>
  <fieldset disabled={uploading}><legend>Video file</legend><input type="file" accept="video/*" aria-label="Video file" required onChange={e=>selectFile(e.target.files[0])}/>
  <label>Title<input required value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Description<textarea required value={description} onChange={e=>setDescription(e.target.value)}/></label>
  <label>Category<input required value={category} onChange={e=>setCategory(e.target.value)}/></label>
  <label>Visibility<select value={visibility} onChange={e=>setVisibility(e.target.value)}>{['public','private','unlisted'].map(v=><option key={v}>{v}</option>)}</select></label></fieldset>
  <section><ImageUploader imageType="thumbnail" label="Thumbnail" aspectRatio="16 / 9" disabled={uploading} onUploadComplete={setThumbnailUrl}/>
  <button className="ticket" disabled={!canSubmit}>Publish video</button><p role="status">{statusText}</p>{uploading&&<progress max="100" value={videoProgress}/>}
  {error&&<p role="alert">{error}</p>}</section></form></main>
}