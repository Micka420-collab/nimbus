import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePairingInput } from "../src/pairing.js";
import { createGatewaySession, createMemoryTransport } from "../src/session.js";
import { extractAssistantText } from "../src/speech-transport.js";
import { runVoiceTurn } from "../src/voice-turn.js";
import { createVoiceSession } from "../src/voice.js";

function helloOk(id = "c1") {
  return {
    type: "res",
    id,
    ok: true,
    payload: {
      type: "hello-ok",
      protocol: 4,
      server: { version: "test", connId: "conn-1" },
      features: { methods: ["chat.send", "node.invoke.result"], events: ["node.invoke.request"] },
      snapshot: {},
      auth: { role: "node", scopes: ["node.invoke"], deviceToken: "dev-token" },
      policy: { maxPayload: 1000, maxBufferedBytes: 1000, tickIntervalMs: 1000 },
    },
  };
}

test("session connect sends node handshake and becomes connected on hello-ok", async () => {
  const transport = createMemoryTransport();
  const seen = [];
  transport.server.onMessage((raw) => {
    const frame = JSON.parse(raw);
    seen.push(frame);
    if (frame.method === "connect") {
      transport.server.send(helloOk(frame.id));
    }
  });
  const session = createGatewaySession({
    openSocket: async () => transport.client,
    requestTimeoutMs: 500,
  });
  const pairing = parsePairingInput({ gatewayUrl: "wss://gw.example:18789", token: "secret-token" });
  const result = await session.connect(pairing);
  assert.equal(result.status, "connected");
  assert.equal(session.snapshot().connected, true);
  assert.equal(seen[0].type, "req");
  assert.equal(seen[0].method, "connect");
  assert.equal(seen[0].params.role, "node");
  assert.equal(seen[0].params.auth.token, "secret-token");
  assert.ok(seen[0].params.commands.includes("computer.act"));
});

test("rejected connect stays rejected and does not look paired-online", async () => {
  const transport = createMemoryTransport();
  transport.server.onMessage((raw) => {
    const frame = JSON.parse(raw);
    transport.server.send({
      type: "res",
      id: frame.id,
      ok: false,
      error: { code: "not_approved", message: "device not approved" },
    });
  });
  const session = createGatewaySession({
    openSocket: async () => transport.client,
    requestTimeoutMs: 500,
  });
  const pairing = parsePairingInput({ gatewayUrl: "wss://gw.example:18789", token: "t" });
  const result = await session.connect(pairing);
  assert.equal(result.status, "rejected");
  assert.equal(session.snapshot().connected, false);
});

test("node.invoke.request is answered with node.invoke.result and default-denies record", async () => {
  const transport = createMemoryTransport();
  const results = [];
  transport.server.onMessage((raw) => {
    const frame = JSON.parse(raw);
    if (frame.method === "connect") {
      transport.server.send(helloOk(frame.id));
    }
    if (frame.method === "node.invoke.result") {
      results.push(frame.params);
    }
  });
  const session = createGatewaySession({
    openSocket: async () => transport.client,
    requestTimeoutMs: 500,
    invokeHandlers: {
      "screen.snapshot": () => ({ ok: true, format: "png", width: 10, height: 10 }),
    },
  });
  await session.connect(parsePairingInput({ gatewayUrl: "wss://gw.example:18789", token: "t" }));
  transport.server.send({
    type: "event",
    event: "node.invoke.request",
    payload: { id: "inv-1", nodeId: "n1", command: "screen.snapshot", paramsJSON: "{}" },
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(results[0].ok, true);
  assert.equal(results[0].payload.format, "png");
  transport.server.send({
    type: "event",
    event: "node.invoke.request",
    payload: { id: "inv-2", nodeId: "n1", command: "screen.record" },
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(results[1].ok, false);
  assert.equal(results[1].error.code, "default_deny");
});

test("chat.send carries the transcript and voice turn fails closed without audio or keys", async () => {
  const transport = createMemoryTransport();
  const chats = [];
  transport.server.onMessage((raw) => {
    const frame = JSON.parse(raw);
    if (frame.method === "connect") {
      transport.server.send(helloOk(frame.id));
    }
    if (frame.method === "chat.send") {
      chats.push(frame.params);
      transport.server.send({
        type: "res",
        id: frame.id,
        ok: true,
        payload: { text: "Bloc-notes ouvert." },
      });
    }
  });
  const session = createGatewaySession({
    openSocket: async () => transport.client,
    requestTimeoutMs: 500,
    sessionKey: "main",
  });
  await session.connect(parsePairingInput({ gatewayUrl: "wss://gw.example:18789", token: "t" }));
  const voice = createVoiceSession();
  voice.grantConsent();
  voice.startPtt();
  const empty = await runVoiceTurn({
    voice,
    env: {},
    sendChat: (text) => session.sendChat(text),
    fetchImpl: async () => ({ ok: true, text: "nope" }),
  });
  assert.equal(empty.ok, false);
  assert.equal(empty.code, "missing_speech_key");
  const turn = await runVoiceTurn({
    voice,
    env: { OPENAI_API_KEY: "sk-test" },
    audio: Buffer.from("wav"),
    sendChat: (text) => session.sendChat(text),
    fetchImpl: async (req) => {
      if (req.kind === "stt") {
        return { ok: true, text: "ouvre le Bloc-notes" };
      }
      return { ok: true, audio: Buffer.from("mp3") };
    },
  });
  assert.equal(turn.ok, true);
  assert.equal(turn.transcript, "ouvre le Bloc-notes");
  assert.equal(turn.reply, "Bloc-notes ouvert.");
  assert.equal(chats[0].message, "ouvre le Bloc-notes");
  assert.equal(chats[0].sessionKey, "main");
});

test("assistant text extractor stays honest on empty payloads", () => {
  assert.equal(extractAssistantText({ text: "bonjour" }), "bonjour");
  assert.equal(extractAssistantText({ payload: { message: "ok" } }), "ok");
  assert.equal(extractAssistantText({ runId: "r1" }), "");
});
