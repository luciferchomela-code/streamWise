import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cursorPath, featureRequest } from '../../services/featuresService';
import { action, field } from '../Features/FeatureLayout';

export function ReportContent({ kind, targetId }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('spam');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  return <div className="space-y-2">
    <button type="button" aria-expanded={open} className={action} onClick={() => setOpen(!open)}>Report {kind}</button>
    {open && <form className="flex flex-wrap items-center gap-2" onSubmit={async (event) => {
      event.preventDefault();
      setBusy(true); setStatus('');
      try {
        await featureRequest('/moderation/reports', { method: 'POST', body: { kind, targetId, reason } });
        setStatus('Report submitted.'); setOpen(false);
      } catch (error) { setStatus(error.message); } finally { setBusy(false); }
    }}>
      <label className="flex items-center gap-2 text-sm">Reason
        <select className={field} value={reason} onChange={(event) => setReason(event.target.value)}>
          <option value="spam">Spam</option>
          <option value="harassment">Harassment</option>
          <option value="inappropriate">Inappropriate content</option>
          <option value="other">Other</option>
        </select>
      </label>
      <button className={action} disabled={busy}>Submit report</button>
    </form>}
    {status && <p role="status" className="text-sm">{status}</p>}
  </div>;
}

export function WatchActions({ videoId, channelId, isVideoOwner }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [playlists, setPlaylists] = useState(null);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    featureRequest('/playlists', { signal: controller.signal }).then(setPlaylists)
      .catch((error) => { if (!controller.signal.aborted) setStatus(error.message); });
    return () => controller.abort();
  }, [open]);
  const run = async (work) => {
    setBusy(true); setStatus('');
    try { await work(); } catch (error) { setStatus(error.message); }
    finally { setBusy(false); }
  };
  return <div className="mt-4 space-y-3 text-sm">
    <div className="flex flex-wrap items-start gap-2">
      <button className={action} type="button" aria-expanded={open} onClick={() => setOpen(!open)}>Add to playlist</button>
      <ReportContent kind="video" targetId={videoId} />
      {!isVideoOwner && channelId && <button className={action} type="button" aria-expanded={confirmBlock}
        onClick={() => setConfirmBlock(!confirmBlock)}>Block creator</button>}
    </div>
    {open && <div className="space-y-2 rounded-xl bg-white/5 p-3">
      <Link to="/playlists" className="text-[#d6b36a]">Manage playlists</Link>
      {!playlists ? <p role="status">Loading playlists…</p> : !playlists.items.length
        ? <p>Create a playlist to save this video.</p>
        : <ul className="flex flex-wrap gap-2">{playlists.items.map((entry) => <li key={entry._id}>
          <button className={action} disabled={busy} onClick={() => run(async () => {
            await featureRequest(`/playlists/${entry._id}/videos/${videoId}`, { method: 'PUT' });
            setOpen(false); setStatus(`Saved to ${entry.name}.`);
          })}>{entry.name}</button>
        </li>)}</ul>}
      {playlists?.next && <button className={action} disabled={busy} onClick={() => run(async () => {
        const next = await featureRequest(cursorPath('/playlists', playlists.next));
        setPlaylists((current) => ({ ...next, items: [...current.items, ...next.items] }));
      })}>Load more</button>}
    </div>}
    {confirmBlock && <div className="flex flex-wrap items-center gap-2">
      <span>Hide this creator’s videos from your account?</span>
      <button className={action} disabled={busy} onClick={() => run(async () => {
        await featureRequest(`/moderation/blocks/${channelId}`, { method: 'PUT' });
        navigate('/moderation');
      })}>Confirm block</button>
      <button className={action} onClick={() => setConfirmBlock(false)}>Cancel</button>
    </div>}
    {status && <p role="status">{status}</p>}
  </div>;
}
