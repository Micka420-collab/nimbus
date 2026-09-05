import assert from "node:assert/strict";
import { test } from "node:test";
import { buildConnectParams, dispatchNodeInvoke, NODE_COMMANDS } from "../src/protocol.js";
import { parsePairingInput } from "../src/pairing.js";
import { speechReadiness, transcribeAudio } from "../src/speech.js";
import { createVoiceSession } from "../src/voice.js";
import { applyVisionModel } from "../src/config.js";
import { resolveWindowsAgentDownload, WINDOWS_AGENT_ASSET } from "../src/download.js";

test("connect payload advertises talk + computer.act and omits record/camera", () => {
  const pairing = parsePairingInput({ gatewayUrl: "wss://gw.example:18789", token: "t" });
  const connect = buildConnectParams(pairing);
  assert.equal(connect.ok, true);
  assert.equal(connect.params.role, "node");
  assert.equal(connect.params.client.mode, "node");
  assert.equal(connect.params.minProtocol, 3);
  assert.equal(connect.params.maxProtocol, 4);
  assert.ok(connect.params.commands.includes("computer.act"));
  assert.ok(connect.params.commands.includes("talk.ptt.start"));
  assert.ok(!connect.params.commands.includes("screen.record"));
  assert.equal(connect.params.computerUse.features.recording, false);
  assert.ok(NODE_COMMANDS.every((command) => command !== "screen.record"));
});

test("connect auth can carry a stored deviceToken after hello-ok", () => {
  const pairing = parsePairingInput({ gatewayUrl: "wss://gw.example:18789", token: "t" });
  pairing.auth.deviceToken = "dev-token";
  const connect = buildConnectParams(pairing);
  assert.equal(connect.params.auth.token, "t");
  assert.equal(connect.params.auth.deviceToken, "dev-token");
});

test("invoke dispatcher default-denies record/camera and requires a bound handler", () => {
  assert.equal(dispatchNodeInvoke("screen.record", {}, {}).code, "default_deny");
  assert.equal(dispatchNodeInvoke("camera.snap", {}, {}).code, "default_deny");
  const bound = dispatchNodeInvoke("screen.snapshot", { maxWidth: 800 }, {
    "screen.snapshot": (params) => ({ ok: true, maxWidth: params.maxWidth }),
  });
  assert.equal(bound.ok, true);
  assert.equal(bound.maxWidth, 800);
});

test("speech fails closed without keys and refuses to invent a transcript", async () => {
  const missing = speechReadiness({});
  assert.equal(missing.ok, false);
  assert.equal(missing.code, "missing_speech_key");
  const transcribed = await transcribeAudio({
    env: {},
    audio: Buffer.from("x"),
    fetchImpl: async () => ({ ok: true, text: "should not run" }),
  });
  assert.equal(transcribed.ok, false);
});

test("voice PTT never starts muted stealth listening", () => {
  const voice = createVoiceSession();
  assert.equal(voice.snapshot().micLive, false);
  assert.equal(voice.startPtt().ok, false);
  voice.grantConsent();
  assert.equal(voice.startPtt().ok, true);
  assert.equal(voice.snapshot().micLive, true);
  assert.equal(voice.snapshot().astraAudio, false);
  voice.stopPtt("bonjour");
  assert.equal(voice.snapshot().phase, "thinking");
});

test("vision model apply is opt-in and keeps an existing model", () => {
  const first = applyVisionModel({}, "openai/gpt-6-astra");
  assert.equal(first.written, true);
  assert.equal(first.config.agents.defaults.model, "openai/gpt-6-astra");
  const kept = applyVisionModel(first.config, "openai/other");
  assert.equal(kept.written, false);
  assert.equal(kept.kept, "openai/gpt-6-astra");
});

test("download resolver prefers a gateway-served exe then GitHub latest", () => {
  assert.equal(resolveWindowsAgentDownload({ localAvailable: true }).source, "gateway");
  const github = resolveWindowsAgentDownload();
  assert.equal(github.source, "github");
  assert.match(github.href, new RegExp(`${WINDOWS_AGENT_ASSET}$`));
});
