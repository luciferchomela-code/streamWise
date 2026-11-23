// Times are media seconds. Preserve gaps caused by seeks.
export function mergePlayed(previous, incoming, duration) {
  const sorted = [...previous, ...incoming]
    .map(([start, end]) => [Math.max(0, start), Math.min(duration, end)])
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0]);
  const ranges = [];
  for (const [start, end] of sorted) {
    const last = ranges.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else ranges.push([start, end]);
  }
  const seconds = ranges.reduce((total, [start, end]) => total + end - start, 0);
  return { ranges, seconds };
}
