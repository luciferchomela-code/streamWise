import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { cursorPath, featureRequest } from '../../services/featuresService';
import { FeatureLayout, action, panel } from './FeatureLayout';

export default function Moderation() {
  const { user } = useAuth();
  const [blocks, setBlocks] = useState(null);
  const [reports, setReports] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    const options = { signal: controller.signal };
    Promise.all([featureRequest('/moderation/blocks', options), featureRequest('/moderation/access', options)])
      .then(async ([list, access]) => {
        setBlocks(list);
        if (access.moderator) setReports(await featureRequest('/moderation/reports', options));
      }).catch((err) => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [user]);

  const run = async (work) => {
    setBusy(true); setError('');
    try { await work(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const more = (path, state, setState) => run(async () => {
    const next = await featureRequest(cursorPath(path, state.next));
    setState((current) => ({ ...next, items: [...current.items, ...next.items] }));
  });
  return <FeatureLayout title="Moderation" error={error}>
    {!blocks && !error && <p role="status">Loading blocked creators…</p>}
    {blocks && <section className={panel}>
      <h2 className="text-lg font-semibold">Blocked creators</h2>
      {!blocks.items.length && <p className="mt-2 text-slate-300">You haven’t blocked any creators.</p>}
      <ul className="divide-y divide-white/10">{blocks.items.map((block) => <li key={block._id} className="flex items-center justify-between gap-3 py-3">
        {block.name}
        <button className={action} disabled={busy} onClick={() => run(async () => {
          await featureRequest(`/moderation/blocks/${block.channelId}`, { method: 'DELETE' });
          setBlocks((current) => ({ ...current, items: current.items.filter((item) => item._id !== block._id) }));
        })}>Unblock</button>
      </li>)}</ul>
      {blocks.next && <button className={action} disabled={busy} onClick={() => more('/moderation/blocks', blocks, setBlocks)}>Load more blocked creators</button>}
    </section>}
    {reports && <section className={panel}>
      <h2 className="text-lg font-semibold">Open reports</h2>
      {!reports.items.length && <p className="mt-2 text-slate-300">No open reports.</p>}
      <ul className="divide-y divide-white/10">{reports.items.map((report) => <li key={report._id} className="space-y-2 py-3">
        <p className="font-medium">{report.title || 'Unavailable video'}</p>
        <p className="text-sm text-slate-300">{report.kind} · {report.reason} · {new Date(report.createdAt).toLocaleDateString()}</p>
        {report.body && <p className="break-words">{report.body}</p>}
        <div className="flex gap-2">{[['dismissed', 'Dismiss'], ['removed', 'Remove content']].map(([state, label]) =>
          <button key={state} className={action} disabled={busy} onClick={() => run(async () => {
            await featureRequest(`/moderation/reports/${report._id}`, { method: 'PATCH', body: { state } });
            setReports((current) => ({ ...current, items: current.items.filter((item) => item._id !== report._id) }));
          })}>{label}</button>)}</div>
      </li>)}</ul>
      {reports.next && <button className={action} disabled={busy} onClick={() => more('/moderation/reports', reports, setReports)}>Load more reports</button>}
    </section>}
  </FeatureLayout>;
}
