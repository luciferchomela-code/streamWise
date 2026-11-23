import test from "node:test";
import assert from "node:assert/strict";
import { WatchPartyRoom, WatchPartyManager } from "../utils/watchPartySync.js";

test("Watch Party: calculates current position dynamically while playing", () => {
  const startTime = 1000000;
  const room = new WatchPartyRoom({
    roomId: "room_1",
    hostId: "host_a",
    videoId: "vid_101",
    position: 10,
    status: "playing",
  });
  room.anchorTimestamp = startTime;

  // 15 seconds later
  const posAfter15s = room.getCurrentPosition(startTime + 15000);
  assert.equal(posAfter15s, 25);

  // When paused, position does not advance with time
  room.applyAction({ action: "pause", position: 25, revision: 2, hostId: "host_a", now: startTime + 15000 });
  const posAfterPause = room.getCurrentPosition(startTime + 30000);
  assert.equal(posAfterPause, 25);
});

test("Watch Party: handles out-of-order rapid seeks safely", () => {
  const now = 2000000;
  const room = new WatchPartyRoom({
    roomId: "room_seek",
    hostId: "host_a",
    videoId: "vid_101",
    position: 0,
    revision: 1,
  });

  // Host sends Seek 1 (rev 2 to position 40) and Seek 2 (rev 3 to position 90).
  // Packet 2 arrives FIRST over the network:
  const res2 = room.applyAction({
    action: "seek",
    position: 90,
    revision: 3,
    hostId: "host_a",
    now,
  });
  assert.equal(res2.applied, true);
  assert.equal(room.anchorPosition, 90);
  assert.equal(room.revision, 3);

  // Stale Packet 1 arrives LATER:
  const res1 = room.applyAction({
    action: "seek",
    position: 40,
    revision: 2,
    hostId: "host_a",
    now: now + 50,
  });
  assert.equal(res1.applied, false);
  assert.equal(res1.reason, "stale_or_out_of_order");
  // Position must remain 90, NOT revert to 40!
  assert.equal(room.anchorPosition, 90);
});

test("Watch Party: late join and host refresh restores exact playhead", () => {
  const t0 = 3000000;
  const manager = new WatchPartyManager();
  const room = manager.getOrCreateRoom({
    roomId: "room_party",
    hostId: "host_user",
    videoId: "vid_interstellar",
    position: 0,
  });

  // Host presses play at t0
  room.applyAction({ action: "play", position: 0, revision: 2, hostId: "host_user", now: t0 });

  // Member joins 45 seconds later
  const t45 = t0 + 45000;
  const lateSnapshot = room.getSnapshot(t45);
  assert.equal(lateSnapshot.status, "playing");
  assert.equal(lateSnapshot.currentPosition, 45);
  assert.equal(lateSnapshot.videoId, "vid_interstellar");

  // Host tab refreshes at t60: fetches room state
  const t60 = t0 + 60000;
  const reconnectedRoom = manager.getRoom("room_party");
  assert.notEqual(reconnectedRoom, null);
  const hostRestoreSnapshot = reconnectedRoom.getSnapshot(t60);
  assert.equal(hostRestoreSnapshot.currentPosition, 60);
  assert.equal(hostRestoreSnapshot.status, "playing");
});
