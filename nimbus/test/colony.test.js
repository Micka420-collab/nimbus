import assert from "node:assert/strict";
import { test } from "node:test";
import { createColony } from "../src/colony.js";
import { fixedClock, tempState } from "./helpers.js";

function colony() {
  return createColony(tempState(), { now: fixedClock(), permissionMode: "deny" });
}

test("lead can add a worker and assign a task", () => {
  const hive = colony();
  const lead = hive.addWorker({ id: "nimbus", role: "lead" });
  const worker = hive.addWorker({ id: "alpha", role: "worker", skills: ["docs"] });
  const task = hive.createTask({ title: "Rédiger le brief" });
  const assigned = hive.assignTask(task.task.id, worker.worker.id);
  assert.equal(lead.ok, true);
  assert.equal(assigned.task.assignee, "alpha");
});

test("risky exec step stays parked until a human approves", () => {
  const hive = colony();
  hive.addWorker({ id: "nimbus", role: "lead" });
  const task = hive.createTask({ title: "Installer un paquet" });
  const proposed = hive.proposeStep({
    taskId: task.task.id,
    action: "exec",
    summary: "pnpm add left-pad",
  });
  assert.equal(proposed.step.status, "needs_approval");
  const blocked = hive.runStep(proposed.step.id);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, "blocked");
  const decided = hive.decideStep(proposed.step.id, "approve");
  assert.equal(decided.step.status, "ready");
  const ran = hive.runStep(proposed.step.id);
  assert.equal(ran.ok, true);
  assert.equal(ran.step.status, "done");
});

test("local-safe memory write does not wait for approval", () => {
  const hive = colony();
  const task = hive.createTask({ title: "Noter une préférence" });
  const proposed = hive.proposeStep({
    taskId: task.task.id,
    action: "memory.write",
    summary: "Prefère le français",
  });
  assert.equal(proposed.step.status, "ready");
  assert.equal(hive.runStep(proposed.step.id).ok, true);
});

test("rejected steps never run", () => {
  const hive = colony();
  const task = hive.createTask({ title: "Envoyer un mail" });
  const proposed = hive.proposeStep({
    taskId: task.task.id,
    action: "send",
    summary: "Mail externe",
  });
  hive.decideStep(proposed.step.id, "reject");
  const ran = hive.runStep(proposed.step.id);
  assert.equal(ran.ok, false);
  assert.equal(hive.ledger().steps[0].status, "rejected");
});
