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
  return <FeatureLayout title="Creator studio" error={error} tools={<nav className="rail">
    <Link to="/live">Broadcast</Link><button disabled={busy} onClick={()=>run(refresh)}>Refresh</button><Link className={primary} to="/upload">Upload video</Link></nav>}>
    {!data && (error?<Link to="/channel">Manage channel</Link>:<p role="status">Opening studio…</p>)}
    {data && <>
      <dl className="ledger">{[['Views',data.views],['Subscribers',data.subscribers],['Likes',data.likes]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v.toLocaleString()}</dd></div>)}</dl>
      <section><h2>Publishing desk</h2>{!data.uploads.items.length&&<p>Your uploads will appear here.</p>}
      {data.uploads.items.map(v=><article key={v._id} className="upload-entry"><div><h3>{['ready','published'].includes(v.status)?<Link to={'/watch/'+v._id}>{v.title}</Link>:v.title}</h3><small>{statusNames[v.status]||v.status}</small></div>
        {v.processingError&&<p role="alert">{v.processingError}</p>}
        {v.status==='failed'&&v.publicId&&<button disabled={busy} onClick={()=>run(async()=>{await videoService.finalizeVideo(v._id,{publicId:v.publicId});await refresh()})}>Retry processing</button>}
        {['ready','published'].includes(v.status)&&<><button aria-expanded={captionVideo===v._id} onClick={()=>setCaptionVideo(captionVideo===v._id?null:v._id)}>Manage captions</button><PublishingStages video={v} busy={busy} onRetry={stage=>run(async()=>{await featureRequest('/studio/uploads/'+v._id+'/publishing/'+stage,{method:'PATCH'});await refresh()})}/></>}
        {captionVideo===v._id&&<CaptionEditor id={v._id} onError={setError}/>}</article>)}
      {data.uploads.next&&<button disabled={busy} onClick={()=>run(()=>refreshUploads(data.uploads.next))}>More uploads</button>}</section>
      <div className="program"><section><h2>Audience over 30 days</h2><div className="bars" aria-hidden="true">{data.viewsByDay.map(v=><i key={v.date} style={{height:Math.max(1,100*v.views/Math.max(1,...data.viewsByDay.map(x=>x.views)))+'%'}}/>)}</div>
      <details><summary>Daily views</summary>{data.viewsByDay.map(v=><p key={v.date}>{v.date} · {v.views}</p>)}</details></section><section><h2>Most watched</h2>{data.top.map(v=><p key={v._id}><Link to={'/watch/'+v._id}>{v.title}</Link> · {v.views}</p>)}</section></div>
    </>}
  </FeatureLayout>;
}
