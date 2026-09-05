import assert from "node:assert/strict";
import { test } from "node:test";
import { authorizeComputerAction, classifyDesktopIntent, intentAligned } from "../src/approvals.js";

test("typed prose is not a high-impact family in French or English", () => {
  const fr = classifyDesktopIntent({ action: "type", text: "envoie ce mail à Paul" });
  const en = classifyDesktopIntent({ action: "type", text: "send this email to Paul" });
  assert.equal(fr.family, "computer");
  assert.equal(fr.confirm, false);
  assert.equal(en.family, "computer");
  const allowedFr = authorizeComputerAction({
    action: { action: "type", text: "envoie ce mail à Paul" },
    hudVisible: true,
  });
  const allowedEn = authorizeComputerAction({
    action: { action: "type", text: "send this email to Paul" },
    hudVisible: true,
  });
  assert.equal(allowedFr.allowed, true);
  assert.equal(allowedEn.allowed, true);
});

test("structured high-impact opcodes always need confirm", () => {
  for (const opcode of ["exec", "shell", "system.run"]) {
    const gate = authorizeComputerAction({ action: { action: opcode }, hudVisible: true });
    assert.equal(gate.allowed, false, opcode);
    assert.equal(gate.reason, "needs_human", opcode);
    assert.equal(gate.classification.family, "exec", opcode);
  }
  const ok = authorizeComputerAction({
    action: { action: "shell" },
    hudVisible: true,
    approved: true,
  });
  assert.equal(ok.allowed, true);
});

test("intent alignment compares compiled steps, not FR/EN keywords", () => {
  const mailFr = intentAligned("envoie ce mail à Paul", { action: "type", text: "bonjour" });
  const mailEn = intentAligned("send this mail to Paul", { action: "type", text: "hello" });
  assert.equal(mailFr.aligned, false);
  assert.equal(mailFr.reason, "no_structured_brief");
  assert.equal(mailEn.aligned, false);
  assert.equal(mailEn.reason, "no_structured_brief");

  const sendFr = intentAligned("envoie ce mail à Paul", { action: "send" });
  assert.equal(sendFr.aligned, false);
  assert.equal(sendFr.reason, "no_structured_brief");

  const notes = intentAligned("ouvre le Bloc-notes et écris hello", { action: "type", text: "hello" });
  assert.equal(notes.aligned, true);
  assert.equal(notes.reason, "structured_match");

  const mismatch = intentAligned("ouvre le Bloc-notes et écris hello", { action: "exec" });
  assert.equal(mismatch.aligned, false);
  assert.equal(mismatch.reason, "structured_mismatch");
});

test("unlisted launch_app targets need human confirm; allowlisted stay medium", () => {
  for (const app of ["msiexec", "winget", "powershell", "pwsh", "cmd"]) {
    const gate = authorizeComputerAction({
      action: { action: "launch_app", app },
      hudVisible: true,
    });
    assert.equal(gate.allowed, false, app);
    assert.equal(gate.reason, "needs_human", app);
    assert.equal(gate.classification.confirm, true, app);
  }
  const notes = authorizeComputerAction({
    action: { action: "launch_app", app: "notepad" },
    hudVisible: true,
  });
  assert.equal(notes.allowed, true);
  assert.equal(notes.classification.confirm, false);
  assert.equal(notes.classification.family, "computer");
  const calc = classifyDesktopIntent({ action: "launch_app", app: "calculatrice" });
  assert.equal(calc.confirm, false);
});
