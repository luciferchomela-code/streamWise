import { randomUUID } from "node:crypto";
import Video from "../../shared/models/video.model.js";

export const enhancementStages = ["adaptive", "thumbnail", "storyboard"];
const playable = { $in: ["ready", "published"] };
const stagePath = (stage) => `publishing.${stage}`;
const retryDelay = (attempts) => Math.min(60_000, 4000 * 2 ** Math.min(attempts - 1, 4));

async function verifyImage(url) {
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(5000) });
  await response.body?.cancel();
  return response.ok && response.headers.get("content-type")?.startsWith("image/");
}

async function readPlaylist(url) {
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(5000) });
  if (!response.ok) {
    await response.body?.cancel();
    return [];
  }
  const lines = (await response.text()).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines[0] === "#EXTM3U" ? lines : [];
}

function playlistUrl(path, base) {
  const url = new URL(path, base);
  if (url.origin !== new URL(base).origin || url.protocol !== "https:") {
    throw new Error("Unexpected HLS delivery host");
  }
  return url;
}

export async function verifyManifest(url, { adaptive = false } = {}) {
  try {
    const manifest = await readPlaylist(url);
    const variants = manifest.flatMap((line, index) => {
      const path = manifest[index + 1];
      if (!line.startsWith("#EXT-X-STREAM-INF:") || !path || path.startsWith("#")) return [];
      return [{ path, bandwidth: Number(line.match(/(?:[:,])BANDWIDTH=(\d+)/)?.[1] || 0) }];
    }).sort((a, b) => a.bandwidth - b.bandwidth);
    const variant = adaptive ? variants.at(-1) : variants[0];
    const mediaUrl = variant ? playlistUrl(variant.path, url) : url;
    const media = variant ? await readPlaylist(mediaUrl) : manifest;
    const segment = media.find((line, index) => !line.startsWith("#") &&
      media.slice(0, index).some((previous) => previous.startsWith("#EXTINF:")));
    if (!segment) return false;
    const firstBytes = await fetch(playlistUrl(segment, mediaUrl), {
      headers: { Range: "bytes=0-1023" }, redirect: "error", signal: AbortSignal.timeout(5000),
    });
    await firstBytes.body?.cancel();
    return firstBytes.ok && firstBytes.headers.get("content-length") !== "0";
  } catch {
    return false;
  }
}

export function queueEnhancements(video, now = new Date()) {
  return {
    adaptive: { state: "pending", dueAt: now },
    thumbnail: video.thumbnailUrl ? { state: "ready" } : { state: "pending", dueAt: now },
    storyboard: { state: "pending", dueAt: now },
  };
}

export async function processEnhancement(stage, invalidate) {
  const path = stagePath(stage);
  const now = new Date();
  const claim = randomUUID();
  const video = await Video.findOneAndUpdate(
    { status: playable, [`${path}.dueAt`]: { $type: "date", $lte: now } },
    { $set: { [`${path}.state`]: "processing", [`${path}.claim`]: claim,
      [`${path}.dueAt`]: new Date(+now + 60_000) }, $inc: { [`${path}.attempts`]: 1 } },
    { sort: { [`${path}.dueAt`]: 1, _id: 1 }, new: true },
  ).select(`+processingAsset +processingRequestId +${path}.attempts`);
  if (!video) return;

  const asset = video.processingAsset;
  const attempts = video.publishing[stage].attempts;
  const filter = { _id: video._id, status: playable, [`${path}.claim`]: claim };
  let output;
  try {
    if (stage === "adaptive" && await verifyManifest(asset?.hlsUrl, { adaptive: true })) output = { hlsUrl: asset.hlsUrl };
    if (stage === "thumbnail" && await verifyImage(asset?.thumbnailUrl)) {
      output = { thumbnailUrl: asset.thumbnailUrl };
    }
    if (stage === "storyboard" && asset?.storyboard?.length &&
        (await Promise.all(asset.storyboard.map((frame) => verifyImage(frame.url)))).every(Boolean)) {
      output = { storyboard: asset.storyboard };
    }
  } catch {
    // Cloudinary may still be preparing this delivery transformation.
  }
  if (output) {
    const ready = await Video.findOneAndUpdate(filter, { $set: { ...output, [path]: { state: "ready" } } }, { new: true });
    if (ready) await invalidate(ready, { search: true });
  } else if (attempts >= 12) {
    const failed = await Video.updateOne(filter, { $set: { [path]: {
      state: "failed", error: "Cloudinary did not deliver this asset. Retry to check again.",
    } } });
    if (failed.modifiedCount) console.warn(JSON.stringify({
      service: "video-worker", event: "enhancement.failed", stage, videoId: video.id,
      requestId: video.processingRequestId,
    }));
  } else {
    await Video.updateOne(filter, { $set: { [`${path}.state`]: "pending",
      [`${path}.dueAt`]: new Date(Date.now() + retryDelay(attempts)) }, $unset: { [`${path}.claim`]: "" } });
  }
}

export async function retryEnhancement(videoId, channelId, stage) {
  if (!enhancementStages.includes(stage)) return false;
  const path = stagePath(stage);
  const result = await Video.updateOne({ _id: videoId, channelId, status: playable, [`${path}.state`]: "failed" },
    { $set: { [path]: { state: "pending", dueAt: new Date() } } });
  return Boolean(result.modifiedCount);
}
