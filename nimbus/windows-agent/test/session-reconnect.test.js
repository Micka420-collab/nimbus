import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePairingInput } from "../src/pairing.js";
import { createMemoryTransport, createReconnectingSession } from "../src/session.js";

const pairing = parsePairingInput({ gatewayUrl: "wss://gw.example:18789", token: "t" });

test("operator close does not reconnect", async () => {
  let connects = 0;
  const session = createReconnectingSession({
    openSocket: async () => helloTransport(() => {
      connects += 1;
    }).client,
    requestTimeoutMs: 200,
    reconnectDelaysMs: [1],
    wait: async () => undefined,
  });
  const first = await session.connect(pairing);
  assert.equal(first.status, "connected");
  assert.equal(connects, 1);
  session.close();
  await delay(20);
  assert.equal(connects, 1);
});

test("dropped socket reconnects with a new handshake", async () => {
  let connects = 0;
  let client = null;
  const session = createReconnectingSession({
    openSocket: async () => {
      const transport = helloTransport(() => {
        connects += 1;
      });
      client = transport.client;
      return transport.client;
    },
    requestTimeoutMs: 200,
    reconnectDelaysMs: [1],
    wait: async () => undefined,
  });
  const first = await session.connect(pairing);
  assert.equal(first.status, "connected");
  assert.equal(connects, 1);
  client.close();
  await delay(30);
  assert.equal(connects, 2);
  assert.equal(session.snapshot().connected, true);
  session.close();
});

test("rejected token stays rejected and does not retry", async () => {
  let connects = 0;
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
  const session = createReconnectingSession({
    openSocket: async () => {
      connects += 1;
      return transport.client;
    },
    requestTimeoutMs: 200,
    reconnectDelaysMs: [1],
    wait: async () => undefined,
  });
  const result = await session.connect(pairing);
  assert.equal(result.status, "rejected");
  assert.match(String(result.message ?? session.snapshot().lastError?.message), /refus|jeton|approuv/i);
  await delay(20);
  assert.equal(connects, 1);
});

function helloTransport(onConnect) {
  const transport = createMemoryTransport();
  transport.server.onMessage((raw) => {
    const frame = JSON.parse(raw);
    if (frame.method !== "connect") {
      return;
    }
    onConnect?.();
    transport.server.send({
      type: "res",
      id: frame.id,
      ok: true,
      payload: {
        type: "hello-ok",
        protocol: 4,
        server: { version: "test", connId: "c" },
        features: { methods: [], events: [] },
        snapshot: {},
        auth: { role: "node", scopes: [] },
        policy: { maxPayload: 1, maxBufferedBytes: 1, tickIntervalMs: 1 },
      },
    });
  });
  return transport;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
