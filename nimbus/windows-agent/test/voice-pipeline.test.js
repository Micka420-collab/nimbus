import assert from "node:assert/strict";
import { test } from "node:test";
import { createVoiceSession } from "../src/voice.js";
import { createVoicePipeline, runVoiceTurn } from "../src/voice-pipeline.js";

test("pipeline STT → chat → TTS and barge-in aborts mid-speech", async () => {
  const voice = createVoiceSession();
  voice.grantConsent();
  voice.startPtt();
  let ttsStarted;
  const ttsGate = new Promise((resolve) => {
    ttsStarted = resolve;
  });
  const pipeline = createVoicePipeline({
    voice,
    env: { OPENAI_API_KEY: "sk-test" },
    sendChat: async (text) => ({ ok: true, payload: { text: `re:${text}` } }),
    fetchImpl: async (req) => {
      if (req.kind === "stt") {
        return { ok: true, text: "ouvre le Bloc-notes" };
      }
      ttsStarted();
      await new Promise((resolve) => {
        req.signal.addEventListener("abort", resolve);
      });
      return { ok: false, code: "aborted", message: "Tour vocal interrompu." };
    },
  });
  const running = pipeline.runTurn({ audio: Buffer.from("wav") });
  await ttsGate;
  const barged = pipeline.bargeIn();
  assert.equal(barged.ok, true);
  const result = await running;
  assert.equal(result.code, "aborted");
  assert.equal(result.transcript, "ouvre le Bloc-notes");
  assert.equal(result.reply, "re:ouvre le Bloc-notes");
  assert.equal(voice.snapshot().phase, "muted");
});

test("node token without chat.send fails in French", async () => {
  const voice = createVoiceSession();
  voice.grantConsent();
  voice.startPtt();
  const result = await runVoiceTurn({
    voice,
    env: { OPENAI_API_KEY: "sk-test" },
    transcript: "bonjour",
    sendChat: async () => ({ ok: false, error: { code: "scope_denied", message: "missing chat.send" } }),
    fetchImpl: async () => ({ ok: true, audio: Buffer.from("x") }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "scope_denied");
  assert.match(result.message, /jeton|opérateur|chat\.send/i);
});

test("runVoiceTurn fails closed without audio or keys", async () => {
  const voice = createVoiceSession();
  voice.grantConsent();
  voice.startPtt();
  const empty = await runVoiceTurn({
    voice,
    env: {},
    sendChat: async () => ({ ok: true, payload: { text: "nope" } }),
    fetchImpl: async () => ({ ok: true, text: "nope" }),
  });
  assert.equal(empty.ok, false);
  assert.equal(empty.code, "missing_speech_key");
  assert.equal(voice.snapshot().micLive, false);
});
