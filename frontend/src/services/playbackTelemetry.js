import { API_BASE_URL } from './apiFetch';

const events = [];
let timer;
let sending = false;

function schedule(delay) {
  if (!timer) timer = setTimeout(() => { timer = undefined; void flush(); }, delay);
}

async function flush() {
  if (sending || !events.length) return;
  sending = true;
  const batch = events.splice(0, 25);
  let retry = false;
  try {
    const response = await fetch(`${API_BASE_URL}/playback-health/events`, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      // A simple request lets a final batch leave the page without a CORS preflight.
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    });
    retry = response.status >= 500 || response.status === 429;
  } catch {
    retry = true;
  } finally {
    if (retry) events.unshift(...batch.filter((event) => Date.now() - event.timestamp < 60_000));
    if (events.length > 100) events.splice(0, events.length - 100);
    sending = false;
    if (events.length) schedule(retry ? 15_000 : 0);
  }
}

export function createPlaybackSession(videoId, initialFormat) {
  if (!videoId || !globalThis.crypto?.randomUUID) return null;
  const sessionId = crypto.randomUUID();
  let format = initialFormat;
  let player = 'native';
  let startedAt;
  let attemptedAt;
  let stalledAt;
  let started = false;
  let failed = false;
  let deliveries = 0;
  let slices = 0;
  let clickedAt;
  const emit = (type, data) => {
    if (events.length >= 100) events.shift();
    events.push({ eventId: crypto.randomUUID(), sessionId, videoId, type, format, player,
      timestamp: Date.now(), ...data });
    schedule(events.length >= 25 ? 0 : 5000);
  };
  const duration = (start) => Math.min(600_000, Math.max(0, Math.round(performance.now() - start)));
  const attempt = () => {
    if (startedAt !== undefined) return;
    startedAt = clickedAt ?? performance.now();
    attemptedAt = Date.now();
    emit('attempt');
  };
  const clearStall = () => { stalledAt = undefined; };
  return {
    source(nextFormat, nextPlayer) {
      if (nextFormat === format && nextPlayer === player) return;
      const wasPlaying = startedAt !== undefined;
      format = nextFormat;
      player = nextPlayer;
      startedAt = undefined;
      started = failed = false;
      deliveries = slices = 0;
      clearStall();
      if (wasPlaying) attempt();
    },
    intent() { clickedAt = performance.now(); },
    attempt,
    waiting(video) {
      if (started && !video.paused && !video.seeking && !video.ended) stalledAt ??= performance.now();
    },
    playing() {
      if (failed) return;
      attempt();
      if (!started) emit('startup', { durationMs: duration(startedAt) });
      if (stalledAt !== undefined && slices < 40) {
        slices++;
        emit('rebuffer', { durationMs: duration(stalledAt) });
      }
      started = true;
      clearStall();
    },
    clearStall,
    fallback(code) { emit('fallback', { code }); },
    error(code) {
      if (failed) return;
      attempt();
      failed = true;
      clearStall();
      emit('error', { code, attemptedAt });
    },
    delivery(stats) {
      const durationMs = Math.round(stats?.loading?.end - stats?.loading?.start);
      if (deliveries >= 8 || !Number.isFinite(durationMs) || durationMs < 0 || durationMs > 600_000) return;
      deliveries++;
      emit('delivery', { durationMs });
    },
  };
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { void flush(); });
}
