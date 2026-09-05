import assert from "node:assert/strict";
import { test } from "node:test";
import { createColony } from "../src/colony.js";
import { createTrust } from "../src/trust.js";
import { fixedClock, tempState } from "./helpers.js";

test("does not auto-run high-risk tools even with a perfect score", () => {
  const trust = createTrust(tempState(), { threshold: 0.8, minSamples: 3 });
  trust.record("exec", "approve");
  trust.record("exec", "approve");
  trust.record("exec", "approve");
  const score = trust.score("exec");
  assert.equal(score.score, 1);
  assert.equal(score.mayAutoRun, false);
});

test("medium tools auto-run only after enough approvals", () => {
  const trust = createTrust(tempState(), { threshold: 0.8, minSamples: 3 });
  assert.equal(trust.mayAutoRun("workspace.write"), false);
  trust.record("workspace.write", "approve");
  trust.record("workspace.write", "approve");
  trust.record("workspace.write", "reject");
  assert.equal(trust.mayAutoRun("workspace.write"), false);
  trust.record("workspace.write", "approve");
  trust.record("workspace.write", "approve");
  assert.equal(trust.mayAutoRun("workspace.write"), true);
});

test("colony uses trust to ready medium actions but still gates exec", () => {
  const root = tempState();
  const trust = createTrust(root, { threshold: 0.8, minSamples: 2 });
  trust.record("workspace.write", "approve");
  trust.record("workspace.write", "approve");
  const hive = createColony(root, { now: fixedClock(), permissionMode: "deny", trust });
  const task = hive.createTask({ title: "écrire" });
  const write = hive.proposeStep({
    taskId: task.task.id,
    action: "workspace.write",
    summary: "mettre à jour USER.md",
  });
  assert.equal(write.step.status, "ready");
  assert.equal(write.step.trusted, true);
  const ran = hive.runStep(write.step.id);
  assert.equal(ran.ok, true);
  assert.equal(ran.decision.reason, "trust_ready");
  assert.notEqual(ran.decision.reason, "human_approved");
  const exec = hive.proposeStep({
    taskId: task.task.id,
    action: "exec",
    summary: "rm -rf /",
  });
  assert.equal(exec.step.status, "needs_approval");
  hive.decideStep(exec.step.id, "reject");
  assert.equal(trust.score("exec").rejects, 1);
});
