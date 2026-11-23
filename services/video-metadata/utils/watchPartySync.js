/**
 * Authoritative Watch Party Synchronization Engine.
 * Manages synchronized video playback, anchor timestamps, monotonic revisions,
 * out-of-order packet guards, and disconnect/late-join recovery.
 */

export class WatchPartyRoom {
  constructor({ roomId, hostId, videoId, position = 0, status = "paused", revision = 1 }) {
    this.roomId = roomId;
    this.hostId = hostId;
    this.videoId = videoId;
    this.status = status; // "playing" | "paused"
    this.anchorPosition = Number(position) || 0;
    this.anchorTimestamp = Date.now();
    this.playbackRate = 1.0;
    this.revision = Number(revision) || 1;
    this.members = new Set([hostId]);
  }

  /**
   * Computes the exact current playback position for any viewer at current time.
   */
  getCurrentPosition(now = Date.now()) {
    if (this.status !== "playing") {
      return this.anchorPosition;
    }
    const elapsedSeconds = Math.max(0, (now - this.anchorTimestamp) / 1000);
    return this.anchorPosition + elapsedSeconds * this.playbackRate;
  }

  /**
   * Returns snapshot for reconnecting clients or late joiners.
   */
  getSnapshot(now = Date.now()) {
    return {
      roomId: this.roomId,
      hostId: this.hostId,
      videoId: this.videoId,
      status: this.status,
      currentPosition: parseFloat(this.getCurrentPosition(now).toFixed(3)),
      anchorPosition: this.anchorPosition,
      anchorTimestamp: this.anchorTimestamp,
      playbackRate: this.playbackRate,
      revision: this.revision,
      memberCount: this.members.size,
    };
  }

  /**
   * Applies an update from the host with monotonic revision protection.
   * If an incoming packet has a revision <= current revision (arrived out of order), it is rejected.
   */
  applyAction({ action, position, revision, videoId, hostId, now = Date.now() }) {
    if (hostId && hostId !== this.hostId) {
      return { applied: false, reason: "unauthorized" };
    }

    const incomingRev = Number(revision);
    if (!Number.isFinite(incomingRev) || incomingRev <= this.revision) {
      return {
        applied: false,
        reason: "stale_or_out_of_order",
        currentRevision: this.revision,
      };
    }

    if (action === "play") {
      const pos = Number.isFinite(position) ? Number(position) : this.getCurrentPosition(now);
      this.anchorPosition = Math.max(0, pos);
      this.anchorTimestamp = now;
      this.status = "playing";
      this.revision = incomingRev;
    } else if (action === "pause") {
      this.anchorPosition = Math.max(0, Number.isFinite(position) ? Number(position) : this.getCurrentPosition(now));
      this.anchorTimestamp = now;
      this.status = "paused";
      this.revision = incomingRev;
    } else if (action === "seek") {
      this.anchorPosition = Math.max(0, Number(position) || 0);
      this.anchorTimestamp = now;
      this.revision = incomingRev;
    } else if (action === "change_video") {
      if (videoId) this.videoId = videoId;
      this.anchorPosition = 0;
      this.anchorTimestamp = now;
      this.status = "paused";
      this.revision = incomingRev;
    }

    return { applied: true, snapshot: this.getSnapshot(now) };
  }

  join(userId) {
    this.members.add(userId);
    return this.getSnapshot();
  }

  leave(userId) {
    this.members.delete(userId);
  }
}

/**
 * In-memory or Redis-backed registry of watch party rooms.
 */
export class WatchPartyManager {
  constructor() {
    this.rooms = new Map();
  }

  getOrCreateRoom({ roomId, hostId, videoId, position = 0 }) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new WatchPartyRoom({ roomId, hostId, videoId, position }));
    }
    return this.rooms.get(roomId);
  }

  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  deleteRoom(roomId) {
    this.rooms.delete(roomId);
  }
}
