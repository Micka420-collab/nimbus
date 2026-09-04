import assert from "node:assert/strict";
import { test } from "node:test";
import { createContinuum } from "../src/continuum.js";
import { fixedClock, tempState } from "./helpers.js";

test("queues work offline and returns pending approvals on reconnect", () => {
  const line = createContinuum(tempState(), { now: fixedClock() });
  line.setOnline(false);
  line.enqueue({ action: "memory.write", summary: "noter une idée", risk: "low", needsApproval: false });
  line.enqueue({ action: "exec", summary: "apt upgrade", risk: "high" });
  assert.equal(line.status().online, false);
  assert.equal(line.status().queued, 2);
  const back = line.reconnect();
  assert.equal(back.summary.delivered, 1);
  assert.equal(back.summary.pendingApprovals, 1);
  assert.match(back.summary.text, /approbation/);
  const decided = line.decide(back.pendingApprovals[0].id, "reject");
  assert.equal(decided.item.status, "rejected");
});

test("online enqueue delivers immediately and still holds approvals", () => {
  const line = createContinuum(tempState(), { now: fixedClock() });
  const item = line.enqueue({ action: "send", summary: "mail client" });
  assert.equal(item.item.status, "pending_approval");
});
