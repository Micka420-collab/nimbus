import assert from "node:assert/strict";
import { test } from "node:test";
import { createVoiceSession, isVoicePhase, normalizeVoiceSettings } from "../src/voice.js";

const VOICE_PHASES_OK = ["idle", "muted", "listening", "thinking", "speaking"];

test("session walks idle → muted → listening → thinking → speaking → muted", () => {
  const voice = createVoiceSession();
  assert.equal(voice.snapshot().phase, "idle");
  assert.equal(voice.snapshot().micLive, false);
  assert.equal(voice.snapshot().astraAudio, false);
  assert.equal(voice.startPtt().ok, false);
  voice.grantConsent();
  assert.equal(voice.snapshot().phase, "muted");
  assert.equal(voice.startPtt().ok, true);
  assert.equal(voice.snapshot().phase, "listening");
  assert.equal(voice.snapshot().micLive, true);
  voice.hearFinal("bonjour");
  assert.equal(voice.snapshot().phase, "thinking");
  voice.agentReady("salut");
  assert.equal(voice.snapshot().phase, "speaking");
  voice.speakEnd();
  assert.equal(voice.snapshot().phase, "muted");
  assert.ok(VOICE_PHASES_OK.every(isVoicePhase));
});

test("conversation keeps listening after speakEnd and barge-in stops TTS", () => {
  const voice = createVoiceSession();
  voice.grantConsent();
  assert.equal(voice.startConversation().ok, true);
  voice.hearFinal("ouvre notepad");
  voice.agentReady("c'est fait");
  assert.equal(voice.snapshot().micLive, true);
  const barged = voice.bargeIn();
  assert.equal(barged.ok, true);
  assert.equal(voice.snapshot().phase, "listening");
  voice.hearFinal("stop");
  voice.agentReady("ok");
  voice.speakEnd();
  assert.equal(voice.snapshot().phase, "listening");
});

test("mute and missing consent fail closed without a live mic", () => {
  const voice = createVoiceSession();
  assert.equal(voice.unmute().ok, false);
  voice.grantConsent();
  voice.startPtt();
  voice.mute();
  assert.equal(voice.snapshot().phase, "muted");
  assert.equal(voice.snapshot().micLive, false);
  assert.equal(voice.startPtt().ok, false);
  assert.equal(voice.startPtt().code, "operator_muted");
  assert.equal(voice.bargeIn().ok, false);
  voice.failClosed("stt_failed", "x");
  assert.equal(voice.snapshot().phase, "muted");
});

test("hotkey and device ids persist through normalizeVoiceSettings", () => {
  const settings = normalizeVoiceSettings({
    inputDeviceId: "mic-2",
    outputDeviceId: "spk-1",
    pttHotkey: "Control+Shift+Space",
  });
  assert.equal(settings.pttHotkey, "Control+Shift+Space");
  const voice = createVoiceSession({ settings });
  voice.setSettings({ pttHotkey: "Alt+Space" });
  assert.equal(voice.snapshot().settings.pttHotkey, "Alt+Space");
  assert.equal(normalizeVoiceSettings({}).pttHotkey, "Alt+Space");
});
