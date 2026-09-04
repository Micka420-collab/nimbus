import assert from "node:assert/strict";
import { test } from "node:test";
import { createVoiceSession } from "../src/voice.js";

test("starts muted with mic off and no stealth listen", () => {
  const voice = createVoiceSession();
  const snap = voice.snapshot();
  assert.equal(snap.phase, "muted");
  assert.equal(snap.micLive, false);
  assert.equal(snap.consentGranted, false);
  assert.match(snap.hud.consentLabel, /Consentement requis/);
});

test("refuses to listen without consent", () => {
  const voice = createVoiceSession();
  const attempt = voice.startListening();
  assert.equal(attempt.ok, false);
  assert.equal(attempt.code, "consent_required");
  assert.equal(voice.snapshot().micLive, false);
});

test("streams STT to thinking to speaking with visible HUD labels", () => {
  const voice = createVoiceSession();
  voice.grantConsent();
  assert.equal(voice.startListening().ok, true);
  assert.equal(voice.snapshot().hud.phaseLabel, "Écoute");
  voice.hearPartial("Bonjour");
  voice.hearFinal("Bonjour Nimbus");
  assert.equal(voice.snapshot().phase, "thinking");
  assert.equal(voice.snapshot().hud.phaseLabel, "Réflexion");
  voice.agentReady("Oui, je t'écoute.");
  assert.equal(voice.snapshot().phase, "speaking");
  assert.equal(voice.snapshot().hud.phaseLabel, "Parole");
  assert.equal(voice.snapshot().micLive, true);
});

test("barge-in interrupts speaking and returns to listening", () => {
  const voice = createVoiceSession();
  voice.grantConsent();
  voice.startListening();
  voice.hearFinal("continue");
  voice.agentReady("Je parle.");
  const barged = voice.hearPartial("stop");
  assert.equal(barged.bargedIn, true);
  assert.equal(voice.snapshot().phase, "listening");
});

test("revoking consent hard-mutes the mic", () => {
  const voice = createVoiceSession();
  voice.grantConsent();
  voice.startListening();
  voice.revokeConsent();
  assert.equal(voice.snapshot().phase, "muted");
  assert.equal(voice.snapshot().micLive, false);
  assert.equal(voice.hearFinal("encore").ok, false);
});
