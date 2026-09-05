import assert from "node:assert/strict";
import { test } from "node:test";
import { measurePcmLevel, meterFill } from "../src/audio-meter.js";

test("PCM meter reports silence and a non-zero peak for a square wave", () => {
  const silent = measurePcmLevel(Buffer.alloc(8));
  assert.equal(silent.rms, 0);
  assert.equal(meterFill(silent), 0);
  const loud = Buffer.alloc(4);
  loud.writeInt16LE(30000, 0);
  loud.writeInt16LE(-30000, 2);
  const level = measurePcmLevel(loud);
  assert.ok(level.peak > 0.8);
  assert.ok(meterFill(level) > 0.8);
});
