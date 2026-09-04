import assert from "node:assert/strict";
import { test } from "node:test";
import { createPresence } from "../src/presence.js";
import { createVoiceSession } from "../src/voice.js";
import { tempState } from "./helpers.js";

test("entering a room never starts the microphone", () => {
  const presence = createPresence(tempState());
  const voice = createVoiceSession();
  const entered = presence.enter("bureau");
  voice.setRoom(entered.room);
  assert.equal(entered.ok, true);
  assert.equal(entered.room.memoryZone, "tech");
  assert.equal(entered.voice.phase, "muted");
  assert.equal(voice.snapshot().phase, "muted");
  assert.equal(voice.snapshot().micLive, false);
  assert.equal(voice.snapshot().hud.roomLabel, "Bureau");
});

test("salon switches memory defaults and keeps HUD visible", () => {
  const presence = createPresence(tempState());
  const voice = createVoiceSession();
  const salon = presence.enter("salon");
  voice.setRoom(salon.room);
  assert.equal(salon.room.memoryZone, "perso");
  assert.ok(salon.room.toolDefaults.includes("memory.read"));
  assert.equal(voice.snapshot().hud.phaseLabel, "Micro coupé");
  assert.match(voice.snapshot().hud.consentLabel, /Consentement requis/);
});

test("unknown rooms are rejected", () => {
  const presence = createPresence(tempState());
  assert.equal(presence.enter("cave").ok, false);
});
