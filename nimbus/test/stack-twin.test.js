import assert from "node:assert/strict";
import { test } from "node:test";
import { createColony } from "../src/colony.js";
import { createStackTwin } from "../src/stack-twin.js";
import { fixedClock, tempState } from "./helpers.js";

test("builds a local stack graph and dry-runs impact", () => {
  const twin = createStackTwin(tempState());
  twin.upsertNode({ id: "sqlite", kind: "service", critical: true });
  twin.upsertNode({ id: "gateway", kind: "service", deps: ["sqlite"], critical: true });
  twin.upsertNode({ id: "ui", kind: "repo", deps: ["gateway"] });
  const impact = twin.simulateImpact({ action: "exec", targetId: "sqlite" });
  assert.equal(impact.dryRun, true);
  assert.equal(impact.blocked, true);
  assert.ok(impact.affected.some((node) => node.id === "gateway"));
  assert.match(impact.summary, /critique/);
});

test("unknown target is a non-blocking stub simulation", () => {
  const twin = createStackTwin(tempState());
  const impact = twin.simulateImpact({ action: "delete", targetId: "ghost" });
  assert.equal(impact.blocked, false);
  assert.deepEqual(impact.affected, []);
});

test("colony attaches twin impact and keeps exec gated", () => {
  const root = tempState();
  const twin = createStackTwin(root);
  twin.upsertNode({ id: "gateway", kind: "service", critical: true });
  const hive = createColony(root, { now: fixedClock(), permissionMode: "deny", twin });
  const task = hive.createTask({ title: "Restart gateway" });
  const proposed = hive.proposeStep({
    taskId: task.task.id,
    action: "exec",
    summary: "systemctl restart openclaw",
    targetId: "gateway",
  });
  assert.equal(proposed.step.status, "needs_approval");
  assert.equal(proposed.impact.blocked, true);
  assert.equal(hive.runStep(proposed.step.id).ok, false);
});
