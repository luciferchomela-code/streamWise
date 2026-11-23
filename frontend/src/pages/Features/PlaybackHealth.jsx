import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { featureRequest } from '../../services/featuresService';
import { FeatureLayout, action, field, panel } from './FeatureLayout';

const count = (value) => (value || 0).toLocaleString();
const average = (total, samples) => samples ? `${count(Math.round(total / samples))} ms` : '—';
const rate = (errors, attempts) => attempts ? `${(100 * errors / attempts).toFixed(1)}%` : '—';
const time = (value) => new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

function Table({ headings, rows, empty }) {
  if (!rows.length) return <p className="mt-3 text-sm text-slate-300">{empty}</p>;
  return <div className="mt-3 overflow-x-auto">
    <table className="w-full whitespace-nowrap text-left text-sm">
      <thead><tr>{headings.map((heading) => <th key={heading} scope="col" className="px-3 py-2 font-medium text-slate-300">{heading}</th>)}</tr></thead>
      <tbody className="divide-y divide-white/10">{rows.map(({ id, cells }) => <tr key={id}>
        {cells.map((cell, index) => <td key={index} className="px-3 py-2 tabular-nums">{cell}</td>)}
      </tr>)}</tbody>
    </table>
  </div>;
}

const columns = (row) => [
  count(row.attempts), average(row.startupMs, row.startups), count(row.rebuffers),
  average(row.rebufferMs, row.rebuffers), count(row.errors), count(row.fallbacks), average(row.deliveryMs, row.deliveries),
];
const headings = ['Attempts', 'Avg startup', 'Buffering pauses', 'Avg pause', 'Errors', 'Fallbacks', 'Avg CDN request'];

function SessionEvents({ id, onClose }) {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    featureRequest(`/playback-health/sessions/${id}`, { signal: controller.signal }).then((data) => setEvents(data.events)).catch((failure) => {
      if (!controller.signal.aborted) setError(failure.message);
    });
    return () => controller.abort();
  }, [id]);
  return <div className="mt-4 rounded-xl bg-black/20 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-semibold">Playback session <span className="break-all font-mono text-sm text-slate-300">{id}</span></h3>
      <button type="button" className={action} onClick={onClose}>Close session</button>
    </div>
    {error && <p className="mt-2 text-sm text-red-300" role="alert">{error}</p>}
    {!events && !error && <p role="status">Loading session.</p>}
    {events && <Table headings={['Time', 'Event', 'Format', 'Code', 'Duration', 'Request ID']}
      rows={events.map((event) => ({ id: event._id, cells: [
        time(event.timestamp), event.type, event.format.toUpperCase(), event.code || '—',
        event.durationMs == null ? '—' : `${count(event.durationMs)} ms`, event.requestId,
      ] }))} />}
  </div>;
}

export default function PlaybackHealth() {
  const { user } = useAuth();
  const [window, setWindow] = useState('1h');
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [session, setSession] = useState(null);
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    featureRequest(`/playback-health?window=${window}`, { signal: controller.signal }).then(setData).catch((failure) => {
      if (!controller.signal.aborted) setError(failure.message);
    });
    return () => controller.abort();
  }, [user, window, refresh]);
  const total = data?.series.reduce((result, row) => {
    for (const [key, value] of Object.entries(row)) if (key !== '_id') result[key] = (result[key] || 0) + value;
    return result;
  }, {});
  const gatewayByTime = new Map(data?.gateway?.map((row) => [row.time, row]) || []);
  const trendRows = data ? Array.from({ length: Math.ceil((data.end - data.start) / data.step) }, (_, index) => data.start + index * data.step)
    .map((start) => {
      const playback = data.series.find((row) => row._id === start) || {};
      const gateway = gatewayByTime.get(start);
      return { id: start, cells: [time(start), ...columns(playback), gateway ? gateway.requestsPerMinute.toFixed(1) : '—',
        gateway ? average(gateway.durationMs, gateway.requests) : '—', gateway ? count(gateway.errors) : '—'] };
    }).reverse() : [];

  return <FeatureLayout title="Playback Health" error={error} tools={<div className="flex items-center gap-2">
    <label className="sr-only" htmlFor="playback-health-window">Time range</label>
    <select id="playback-health-window" className={field} value={window} onChange={(event) => {
      setError(''); setData(null); setWindow(event.target.value);
    }}>
      <option value="1h">Last hour</option><option value="24h">Last 24 hours</option>
      <option value="7d">Last 7 days</option><option value="30d">Last 30 days</option>
    </select>
    <button type="button" className={action} onClick={() => { setError(''); setRefresh((value) => value + 1); }}>Refresh</button>
  </div>}>
    {!data && !error && <p role="status">Loading playback health.</p>}
    {data && <>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Playback attempts', count(total.attempts)], ['Average startup', average(total.startupMs, total.startups)],
          ['Playback error rate', rate(total.errors, total.attempts)], ['Buffering pauses', count(total.rebuffers)],
          ['Average CDN request', average(total.deliveryMs, total.deliveries)],
          ['Upload processing time', data.uploads.averageMs == null ? '—' : `${(data.uploads.averageMs / 1000).toFixed(1)} s`],
          ['Upload failure rate', rate(data.uploads.failed, data.uploads.completed)],
          ['Pending outbox events', `${count(data.outbox.pending)} · oldest ${count(data.outbox.oldestAgeSeconds)} s`],
        ].map(([label, value]) => <div className={panel} key={label}>
          <dt className="text-sm text-slate-300">{label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
        </div>)}
      </dl>
      <section className={panel}>
        <h2 className="text-lg font-semibold">Playback and gateway activity</h2>
        <p className="text-sm text-slate-300">CDN timing samples come from HLS.js segment requests. Gateway activity covers the latest 24 hours.</p>
        <Table headings={['Interval start', ...headings, 'Gateway req/min', 'Avg gateway latency', 'Gateway 5xx']} rows={trendRows} />
      </section>
      <section className={panel}>
        <h2 className="text-lg font-semibold">Browser, player and format</h2>
        <Table headings={['Browser', 'Player', 'Format', ...headings]} empty="No playback events in this time range."
          rows={data.breakdown.map((row) => {
            const { browser, player, format } = row._id;
            return { id: `${browser}/${player}/${format}`, cells: [browser, player, format.toUpperCase(), ...columns(row)] };
          })} />
      </section>
      <section className={panel}>
        <h2 className="text-lg font-semibold">Recent playback issues</h2>
        <Table headings={['Time', 'Video ID', 'Session ID', 'Browser', 'Player', 'Format', 'Event', 'Code', 'Request ID']}
          empty="No recent playback issues in this time range."
          rows={data.recentErrors.map((entry) => ({ id: entry._id, cells: [
            time(entry.timestamp), entry.videoId,
            <button type="button" className="text-cyan-300 underline" onClick={() => setSession(entry.sessionId)}>{entry.sessionId}</button>,
            entry.browser, entry.player, entry.format.toUpperCase(), entry.type, entry.code || 'unknown', entry.requestId,
          ] }))} />
        {session && <SessionEvents id={session} key={session} onClose={() => setSession(null)} />}
      </section>
    </>}
  </FeatureLayout>;
}
