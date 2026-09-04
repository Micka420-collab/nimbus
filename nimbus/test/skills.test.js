import assert from "node:assert/strict";
import { test } from "node:test";
import { createSkillForge } from "../src/skills.js";
import { fixedClock, tempState } from "./helpers.js";

test("proposes a sandbox skill after three identical successes", () => {
  const forge = createSkillForge(tempState(), { now: fixedClock(), threshold: 3 });
  const first = forge.recordSuccess({ pattern: "status git", summary: "git status", action: "workspace.read" });
  const second = forge.recordSuccess({ pattern: "status git", summary: "git status", action: "workspace.read" });
  const third = forge.recordSuccess({ pattern: "status git", summary: "git status", action: "workspace.read" });
  assert.equal(first.draft, null);
  assert.equal(second.proposed, false);
  assert.equal(third.proposed, true);
  assert.equal(third.draft.status, "sandbox");
  assert.equal(third.draft.execMode, "deny");
});

test("sandbox run is allowed; live run waits for a human", () => {
  const forge = createSkillForge(tempState(), { now: fixedClock(), threshold: 1 });
  const { draft } = forge.recordSuccess({ pattern: "notes", summary: "écrire une note", action: "memory.write" });
  assert.equal(forge.run(draft.id).code, "sandbox_only");
  assert.equal(forge.sandboxRun(draft.id).ok, true);
  assert.equal(forge.approve(draft.id).skill.status, "approved");
  assert.equal(forge.run(draft.id).ok, true);
});

test("approved high-risk skills stay deny-exec", () => {
  const forge = createSkillForge(tempState(), { now: fixedClock(), threshold: 1 });
  const { draft } = forge.recordSuccess({ pattern: "install", summary: "pnpm add x", action: "exec" });
  forge.approve(draft.id);
  const ran = forge.run(draft.id);
  assert.equal(ran.ok, false);
  assert.equal(ran.code, "deny_exec");
});

test("refuses to draft a skill that embeds a secret", () => {
  const forge = createSkillForge(tempState(), { now: fixedClock(), threshold: 1 });
  const refused = forge.recordSuccess({
    pattern: "export key",
    summary: "api_key=super-secret-value",
    action: "workspace.read",
  });
  assert.equal(refused.code, "secret_refused");
});
