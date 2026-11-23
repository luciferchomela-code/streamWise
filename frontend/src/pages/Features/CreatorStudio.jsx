import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { cursorPath, featureRequest } from '../../services/featuresService';
import { videoService } from '../../services/videoService';
import { FeatureLayout, action, field, panel, primary } from './FeatureLayout';

const statusNames = { draft: 'Draft', uploading: 'Uploading', processing: 'Processing', ready: 'Ready',
  published: 'Published', failed: 'Failed', moderated: 'Removed by moderation' };
const stages = { adaptive: 'Adaptive quality', thumbnail: 'Thumbnail', storyboard: 'Timeline previews' };
const stageStates = { pending: 'Queued', processing: 'Processing', ready: 'Ready', failed: 'Failed' };

function PublishingStages({ video, busy, onRetry }) {
  if (!video.publishing?.adaptive) return null;
  return <dl className="mt-3 grid gap-2 sm:grid-cols-3">
    {Object.entries(stages).map(([stage, label]) => {
      const item = video.publishing[stage];
      if (!item) return null;
      return <div key={stage} className="space-y-1 rounded-lg bg-black/20 p-3 text-sm">
        <dt className="font-medium">{label}</dt>
        <dd className={item.state === 'failed' ? 'text-red-300' : 'text-slate-300'}>{stageStates[item.state]}</dd>
        {item.error && <dd className="text-xs text-red-200">{item.error}</dd>}
        {item.state === 'failed' && <dd><button type="button" className={action} disabled={busy}
          onClick={() => onRetry(stage)}>Retry {label.toLowerCase()}</button></dd>}
      </div>;
    })}
  </dl>;
}

function CaptionEditor({ id, onError }) {
  const [tracks, setTracks] = useState([]);
  const [busy, setBusy] = useState(false);
  const reload = () => featureRequest(`/captions/${id}`).then((data) => setTracks(data.captions));
  useEffect(() => { reload().catch((error) => onError(error.message)); }, [id]);

  const change = async (work) => {
    setBusy(true);
    onError('');
    try { await work(); await reload(); } catch (error) { onError(error.message); }
    finally { setBusy(false); }
  };

  const upload = (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    void change(async () => {
      const file = data.get('file');
      if (!file?.size || file.size > 128 * 1024) throw new Error('Choose a WebVTT file up to 128 KB.');
      await featureRequest(`/captions/${id}/${encodeURIComponent(data.get('language').trim())}`, {
        method: 'PUT', body: { label: data.get('label'), text: await file.text() },
      });
      form.reset();
    });
  };

  return <div className="mt-3 space-y-3 rounded-lg bg-black/20 p-3">
    <form onSubmit={upload} className="flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-sm">Language tag<input name="language" className={field} placeholder="en" required maxLength={35} /></label>
      <label className="grid gap-1 text-sm">Caption label<input name="label" className={field} placeholder="English" required maxLength={100} /></label>
      <label className="grid gap-1 text-sm">WebVTT file<input name="file" type="file" accept=".vtt,text/vtt" required /></label>
      <button className={primary} disabled={busy}>Save captions</button>
    </form>
    {tracks.map((track) => <div className="flex flex-wrap items-center gap-3" key={track.language}>
      <span>{track.label} ({track.language})</span>
      <button type="button" disabled={busy} className={action} onClick={() => change(
        () => featureRequest(`/captions/${id}/${track.language}`, { method: 'DELETE' }),
      )}>Remove {track.label}</button>
    </div>)}
  </div>;
}

export default function CreatorStudio() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [captionVideo, setCaptionVideo] = useState(null);
  const [busy, setBusy] = useState(false);
  const refresh = async () => setData(await featureRequest('/studio'));
  const refreshUploads = async (cursor, options) => {
    const uploads = await featureRequest(cursorPath('/studio/uploads', cursor), options);
    setData((previous) => previous ? { ...previous, uploads: cursor
      ? { ...uploads, items: [...previous.uploads.items, ...uploads.items] }
      : uploads,
    } : previous);
  };
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    featureRequest('/studio', { signal: controller.signal }).then(setData).catch((err) => {
      if (!controller.signal.aborted) setError(err.message);
    });
    return () => controller.abort();
  }, [user]);
  const hasPending = Boolean(data?.uploads.items.some((video) => video.status === 'processing' ||
    Object.values(video.publishing || {}).some((stage) => ['pending', 'processing'].includes(stage.state))));
  const expanded = Boolean(data && data.uploads.items.length > 30);
  useEffect(() => {
    if (!hasPending || expanded) return;
    const controller = new AbortController();
    const timer = setInterval(() => refreshUploads(null, { signal: controller.signal }).catch(() => {}), 12000);
    return () => { clearInterval(timer); controller.abort(); };
  }, [hasPending, expanded]);

  const run = async (work) => {
    setBusy(true);
    setError('');
    try { await work(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <FeatureLayout title="Creator Studio" error={error} tools={<div className="flex gap-2">
    <button className={action} disabled={busy} onClick={() => run(() => refresh())}>Refresh</button>
    <Link className={primary} to="/upload">Upload video</Link>
  </div>}>
    {!data && !error && <p role="status">Loading Creator Studio…</p>}
    {!data && error && <Link to="/channel" className="text-cyan-300 underline">Go to my channel</Link>}
    {data && <>
      <div className="grid grid-cols-3 gap-3">
        {[['Views', data.views], ['Likes', data.likes], ['Subscribers', data.subscribers]].map(([label, value]) =>
          <div key={label} className={panel}><p className="text-sm text-slate-300">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{value.toLocaleString()}</p></div>)}
      </div>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <section className={panel}>
          <h2 className="text-lg font-semibold">Views over the last 30 days</h2>
          <div aria-hidden="true" className="my-4 flex h-28 items-end gap-0.5 border-b border-white/15">
            {data.viewsByDay.map(({ date, views }) => <div key={date} title={`${date}: ${views} views`}
              className="flex-1 rounded-t-sm bg-cyan-400" style={{ height: views
                ? `${Math.max(4, 100 * views / Math.max(...data.viewsByDay.map((row) => row.views))) }%` : '2px' }} />)}
          </div>
          <details className="text-sm"><summary>Daily view counts (UTC)</summary>
            <ul className="mt-2 grid grid-cols-2 gap-2">{data.viewsByDay.map(({ date, views }) => <li key={date}>{date} · {views.toLocaleString()}</li>)}</ul>
          </details>
        </section>
        <section className={panel}>
          <h2 className="text-lg font-semibold">Top videos by views</h2>
          {data.top.length ? <ol className="mt-3 space-y-2">{data.top.map((video) =>
            <li key={video._id} className="flex justify-between gap-3"><Link className="text-cyan-300" to={`/watch/${video._id}`}>{video.title}</Link><span>{video.views.toLocaleString()}</span></li>)}</ol>
            : <p className="mt-2 text-slate-300">Published videos will appear here.</p>}
        </section>
      </div>
      <section className={panel}>
        <h2 className="text-lg font-semibold">Uploads</h2>
        {data.uploads.items.length === 0 && <p className="mt-2 text-slate-300">No uploads yet.</p>}
        <ul className="mt-2 divide-y divide-white/10">{data.uploads.items.map((video) => {
          const playable = ['ready', 'published'].includes(video.status);
          return <li key={video._id} className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>{playable ? <Link className="font-medium text-cyan-300" to={`/watch/${video._id}`}>{video.title}</Link> : <strong>{video.title}</strong>}
                <p className="text-sm text-slate-300">{playable && video.publishing?.adaptive ? 'Playback ready' : statusNames[video.status] || video.status}</p>
                {video.processingError && <p className="text-sm text-red-300">{video.processingError}</p>}</div>
              {playable && <button className={action} aria-expanded={captionVideo === video._id}
                onClick={() => setCaptionVideo(captionVideo === video._id ? null : video._id)}>Captions</button>}
              {video.status === 'failed' && video.publicId && <button className={action} disabled={busy}
                onClick={() => run(async () => { await videoService.finalizeVideo(video._id, { publicId: video.publicId }); await refresh(); })}>Retry processing</button>}
            </div>
            {playable && <PublishingStages video={video} busy={busy} onRetry={(stage) => run(async () => {
              await featureRequest(`/studio/uploads/${video._id}/publishing/${stage}`, { method: 'PATCH' });
              await refresh();
            })} />}
            {captionVideo === video._id && <CaptionEditor id={video._id} onError={setError} />}
          </li>;
        })}</ul>
        {data.uploads.next && <button className={action} disabled={busy} onClick={() => run(() => refreshUploads(data.uploads.next))}>Load more uploads</button>}
      </section>
    </>}
  </FeatureLayout>;
}
