export function trackPlayback(el, save) {
  let snapshot = null;
  let lastSent = '';
  let inFlight = false;
  let queued = false;
  const capture = () => {
    const played = el.played;
    if (!Number.isFinite(el.duration) || el.duration <= 0 || !played.length) return;
    const ranges = Array.from({ length: played.length }, (_, i) => [played.start(i), played.end(i)]);
    snapshot = { ranges, position: el.currentTime, duration: el.duration };
  };
  const flush = async () => {
    capture();
    if (inFlight) { queued = true; return; }
    const data = snapshot;
    const key = JSON.stringify(data);
    if (!data || key === lastSent) return;
    inFlight = true;
    try {
      for (let i = 0; i < data.ranges.length; i += 128) {
        await save({
          ...data, ranges: data.ranges.slice(i, i + 128),
        });
      }
      lastSent = key;
    } catch {
      // Each subsequent snapshot includes the ranges from failed requests.
    } finally {
      inFlight = false;
      if (queued) { queued = false; void flush(); }
    }
  };
  const onHidden = () => { if (document.hidden) void flush(); };
  const timer = setInterval(flush, 15000);
  el.addEventListener('timeupdate', capture);
  el.addEventListener('pause', flush);
  el.addEventListener('ended', flush);
  document.addEventListener('visibilitychange', onHidden);
  window.addEventListener('pagehide', flush);
  return () => {
    clearInterval(timer);
    el.removeEventListener('timeupdate', capture);
    el.removeEventListener('pause', flush);
    el.removeEventListener('ended', flush);
    document.removeEventListener('visibilitychange', onHidden);
    window.removeEventListener('pagehide', flush);
    void flush();
  };
}
