import { test } from "node:test";
import assert from "node:assert/strict";
import { mergePlayed } from "../utils/playedRanges.js";

test("seek gaps, partial overlaps, duplicate reports and out-of-order arrivals", () => {
  const a = [[0, 30], [540, 550]];
  const b = [[10, 35], [545, 560]];
  const expected = { ranges: [[0, 35], [540, 560]], seconds: 55 };
  assert.deepEqual(mergePlayed(a, b, 600), expected);
  assert.deepEqual(mergePlayed(b, a, 600), expected);
  assert.deepEqual(mergePlayed(expected.ranges, a, 600), expected);
});

test("clips to the catalog duration and keeps fractional seconds", () => {
  assert.deepEqual(mergePlayed([], [[5.25, 20], [30, 40]], 10),
    { ranges: [[5.25, 10]], seconds: 4.75 });
});
