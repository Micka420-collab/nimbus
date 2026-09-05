import assert from "node:assert/strict";
import { test } from "node:test";
import { createComputerLoop } from "../src/computer-loop.js";
import { hashObservationBytes } from "../src/observation.js";
import { createComputerTrustGate } from "../src/trust-gate.js";
import { tempState } from "../../test/helpers.js";

test("stale screenshot hash retries once then fails closed", async () => {
  const hashes = [];
  const loop = createComputerLoop({
    adapter: {
      async execute() {
        return { ok: true, executed: "type" };
      },
    },
  });
  const same = Buffer.from("same-pixels");
  loop.setBrief("ouvre le Bloc-notes et écris hello");
  await loop.observe({ frameId: "f1", bytes: same, hash: hashObservationBytes(same, "utf8") });
  const result = await loop.execute(
    { action: "type", text: "hello" },
    {
      hudVisible: true,
      retryStale: true,
      capture: async () => {
        hashes.push("cap");
        return { frameId: `f${hashes.length + 1}`, bytes: same, hash: hashObservationBytes(same, "utf8") };
      },
    },
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, "stale_ui");
  assert.equal(hashes.length, 2);
});

test("approve and deny pending high-impact steps, abort stops the loop", async () => {
  const loop = createComputerLoop({
    adapter: {
      async execute() {
        return { ok: true, executed: "type" };
      },
    },
  });
  await loop.observe({ frameId: "f1", bytes: Buffer.from("a"), hash: "h1" });
  const held = await loop.execute({ action: "shell" }, { hudVisible: true });
  assert.equal(held.ok, false);
  assert.equal(held.reason, "needs_human");
  assert.equal(loop.snapshot().status, "waiting_approval");
  const denied = loop.denyPending();
  assert.equal(denied.status, "idle");
  const again = await loop.execute({ action: "exec" }, { hudVisible: true });
  assert.equal(again.reason, "needs_human");
  const approved = await loop.approvePending({ hudVisible: true });
  assert.equal(approved.code, "unknown_action");
  loop.abort();
  const afterAbort = await loop.execute({ action: "type", text: "hello" }, { hudVisible: true });
  assert.equal(afterAbort.code, "aborted");
});

test("trust auto-run after enough medium computer approvals", () => {
  const state = tempState("nimbus-trust-");
  const gate = createComputerTrustGate(state);
  gate.record({ action: "type", text: "hello" }, "approve");
  gate.record({ action: "type", text: "hello" }, "approve");
  gate.record({ action: "type", text: "hello" }, "approve");
  const auto = gate.authorize({
    action: { action: "type", text: "hello" },
    hudVisible: true,
  });
  assert.equal(auto.reason, "trust_auto");
  const send = gate.authorize({
    action: { action: "shell" },
    hudVisible: true,
  });
  assert.equal(send.allowed, false);
  assert.equal(send.reason, "needs_human");
});
