import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { cursorPath, featureRequest } from '../../services/featuresService';
import { FeatureLayout, action, field, panel, primary } from './FeatureLayout';

export default function Playlists() {
  const { user } = useAuth();
  const { playlistId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const path = playlistId ? `/playlists/${playlistId}` : '/playlists';
  const load = async (cursor) => {
    const next = await featureRequest(cursorPath(path, cursor));
    setData((current) => cursor ? { ...next, items: [...current.items, ...next.items] } : next);
    if (!cursor && playlistId) setName(next.playlist.name);
  };

  useEffect(() => {
    setError('');
    setData(null);
    setName('');
    setConfirmDelete(false);
    if (!user) return;
    const controller = new AbortController();
    featureRequest(path, { signal: controller.signal }).then((result) => {
      setData(result); setName(result.playlist?.name || '');
    }).catch((err) => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [user, path]);

  const run = async (work) => {
    setBusy(true);
    setError('');
    try { await work(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <FeatureLayout title={data?.playlist?.name || 'Playlists'} error={error}
    tools={playlistId && <Link to="/playlists" className={action}>All playlists</Link>}>
    {!data && !error && <p role="status">Loading playlists…</p>}
    {data && <section className={panel}>
      <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => {
        event.preventDefault();
        void run(async () => {
          const result = await featureRequest(path, { method: playlistId ? 'PATCH' : 'POST', body: { name } });
          if (playlistId) await load();
          else navigate(`/playlists/${result.playlist._id}`);
        });
      }}>
        <label className="grid gap-1 text-sm">Playlist name<input className={field} value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} /></label>
        <button className={primary} disabled={busy || !name.trim()}>{playlistId ? 'Rename' : 'Create playlist'}</button>
        {playlistId && <button type="button" className={action} onClick={() => setConfirmDelete(!confirmDelete)}>Delete playlist</button>}
      </form>
      {confirmDelete && <div className="mt-4 flex flex-wrap items-center gap-3" role="group" aria-label="Confirm playlist deletion">
        <span>Delete this playlist and its saved entries?</span>
        <button className={action} disabled={busy} onClick={() => run(async () => {
          await featureRequest(path, { method: 'DELETE' }); navigate('/playlists');
        })}>Confirm deletion</button>
        <button className={action} onClick={() => setConfirmDelete(false)}>Cancel</button>
      </div>}
      <ul className="mt-4 divide-y divide-white/10">
        {data.items.map((item) => <li key={item._id} className="flex items-center justify-between gap-3 py-3">
          {playlistId ? <>
            {item.video ? <Link className="text-[#d6b36a]" to={`/watch/${item.video._id}`}>{item.video.title}</Link> : <span>Unavailable video</span>}
            <button className={action} disabled={busy} onClick={() => run(async () => {
              await featureRequest(`${path}/videos/${item.videoId}`, { method: 'DELETE' });
              setData((current) => ({ ...current, items: current.items.filter((row) => row._id !== item._id) }));
            })}>Remove</button>
          </> : <Link className="text-[#d6b36a]" to={`/playlists/${item._id}`}>{item.name}</Link>}
        </li>)}
      </ul>
      {data.items.length === 0 && <p className="mt-3 text-slate-300">{playlistId ? 'Save a video from its watch page to add it here.' : 'Create a playlist to save videos together.'}</p>}
      {data.next && <button className={action} disabled={busy} onClick={() => run(() => load(data.next))}>Load more</button>}
    </section>}
  </FeatureLayout>;
}
