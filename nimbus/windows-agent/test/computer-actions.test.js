import assert from "node:assert/strict";
import { test } from "node:test";
import { createActionExecutor, parseComputerAction } from "../src/computer-actions.js";
import { parseHarnessProgram } from "../src/harness.js";
import { compileDesktopPhrase } from "../src/planner.js";
import { createComputerLoop } from "../src/computer-loop.js";
import { authorizeComputerAction } from "../src/approvals.js";
import { planWindowsCommand } from "../src/windows-input.js";

test("structured actions require a frameId for coordinates and reject recording", () => {
  assert.equal(parseComputerAction({ action: "left_click", x: 10, y: 20 }).ok, false);
  assert.equal(parseComputerAction({ action: "left_click", x: 10, y: 20, frameId: "f1" }).ok, true);
  assert.equal(parseComputerAction({ action: "screen.record" }).code, "unsupported_action");
  assert.equal(parseComputerAction({ action: "type", text: "hello" }).ok, true);
});

test("phrase compiler covers the Notepad journey and stays closed otherwise", () => {
  const compiled = compileDesktopPhrase("ouvre le Bloc-notes et écris hello");
  assert.equal(compiled.ok, true);
  assert.equal(compiled.steps[0].app, "notepad");
  assert.equal(compiled.steps.at(-1).text, "hello");
  assert.equal(compileDesktopPhrase("scan the network for cve-2024").ok, false);
});

test("harness refuses unknown ops instead of eval", () => {
  const bad = parseHarnessProgram({ steps: [{ op: "eval", code: "process.exit()" }] });
  assert.equal(bad.ok, false);
  const good = parseHarnessProgram({
    brief: "notes",
    steps: [
      { op: "launch", app: "notepad" },
      { op: "wait", duration: 0.2 },
      { op: "type", text: "hello" },
    ],
  });
  assert.equal(good.ok, true);
  assert.equal(good.steps.length, 3);
});

test("observe-validate-execute-reobserve loop keeps the HUD on and honors abort", async () => {
  const calls = [];
  const loop = createComputerLoop({
    adapter: {
      async execute(action) {
        calls.push(action.action);
        return { ok: true, executed: action.action };
      },
    },
  });
  loop.setBrief("ouvre le Bloc-notes et écris hello");
  await loop.observe({ frameId: "f1", width: 1280, height: 720 });
  assert.equal(loop.snapshot().hud.visible, true);
  assert.equal(loop.snapshot().hud.title, "Nimbus contrôle le bureau");
  const typed = await loop.execute({ action: "type", text: "hello" }, { hudVisible: true });
  assert.equal(typed.ok, true);
  await loop.reobserve({ frameId: "f2" });
  assert.equal(loop.snapshot().frameId, "f2");
  loop.abort();
  const after = await loop.execute({ action: "type", text: "nope" }, { hudVisible: true });
  assert.equal(after.ok, false);
  assert.equal(after.code, "aborted");
  assert.deepEqual(calls, ["type"]);
});

test("high-impact and stealth commands stay default-deny until confirmed", () => {
  const shell = authorizeComputerAction({
    action: { action: "shell" },
    hudVisible: true,
  });
  assert.equal(shell.allowed, false);
  assert.equal(shell.reason, "needs_human");
  const approved = authorizeComputerAction({
    action: { action: "exec" },
    hudVisible: true,
    approved: true,
  });
  assert.equal(approved.allowed, true);
  const record = authorizeComputerAction({
    action: { command: "screen.record" },
    hudVisible: true,
    approved: true,
  });
  assert.equal(record.allowed, false);
  const exploit = authorizeComputerAction({
    action: { action: "exploit" },
    hudVisible: true,
    approved: true,
  });
  assert.equal(exploit.reason, "exploit_blocked");
});

test("Windows planner maps Notepad and stays dry on Linux", () => {
  const launch = planWindowsCommand({ action: "launch_app", app: "notepad" });
  assert.equal(launch.exe, "notepad.exe");
  const click = planWindowsCommand({ action: "left_click", x: 4, y: 8 });
  assert.equal(click.kind, "left_click");
});
