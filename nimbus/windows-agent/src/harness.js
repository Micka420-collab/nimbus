/**
 * Constrained desktop program — code-execution *style*, not eval.
 * OpenAI Astra docs lean toward a code harness; this node accepts a closed
 * step list instead of arbitrary JS/Python so we never ship an exploit shell.
 */

import { parseComputerAction } from "./computer-actions.js";

export const HARNESS_OPS = Object.freeze([
  "screenshot",
  "launch",
  "launch_app",
  "click",
  "left_click",
  "type",
  "key",
  "scroll",
  "wait",
]);

const APP_ALIASES = Object.freeze({
  notepad: "notepad",
  "bloc-notes": "notepad",
  blocnotes: "notepad",
  "bloc notes": "notepad",
  calc: "calc",
  calculatrice: "calc",
});

export function parseHarnessProgram(raw) {
  const program = typeof raw === "string" ? safeJson(raw) : raw;
  if (!program || typeof program !== "object") {
    return { ok: false, code: "invalid_program", message: "Harness program must be an object." };
  }
  const steps = Array.isArray(program.steps) ? program.steps : null;
  if (!steps || steps.length === 0 || steps.length > 40) {
    return { ok: false, code: "invalid_program", message: "Harness needs 1-40 steps." };
  }
  const compiled = [];
  for (const step of steps) {
    const mapped = mapStep(step);
    if (!mapped.ok) {
      return mapped;
    }
    compiled.push(mapped.action);
  }
  return { ok: true, steps: compiled, brief: typeof program.brief === "string" ? program.brief : "" };
}

/**
 * Small, honest phrase compiler for the operator journeys we document.
 * Not a general planner — unknown text fails closed.
 */
export function compileDesktopPhrase(text) {
  const source = String(text ?? "").trim();
  if (!source) {
    return { ok: false, code: "empty_brief", message: "Task brief required." };
  }
  const lower = source.toLowerCase();
  const launchMatch = lower.match(
    /(?:ouvre|open|lance|launch)\s+(?:le\s+|la\s+|l')?(bloc[-\s]?notes|notepad|calculatrice|calc)/u,
  );
  const typeMatch = source.match(/(?:[eé]cris|write|type)\s+["«]?(.+?)["»]?$/iu);
  if (!launchMatch) {
    return {
      ok: false,
      code: "unsupported_brief",
      message: "No constrained harness match. Use structured computer.act steps instead.",
    };
  }
  const app = APP_ALIASES[launchMatch[1].replace(/\s+/g, "-")] ?? APP_ALIASES[launchMatch[1]];
  const steps = [{ action: "launch_app", app }];
  if (typeMatch) {
    steps.push({ action: "wait", duration: 0.4 });
    steps.push({ action: "type", text: typeMatch[1].trim() });
  }
  return { ok: true, brief: source, steps };
}

function mapStep(step) {
  if (!step || typeof step !== "object") {
    return { ok: false, code: "invalid_program", message: "Each step must be an object." };
  }
  const op = step.op ?? step.action;
  if (!HARNESS_OPS.includes(op)) {
    return { ok: false, code: "unsupported_op", message: `Harness op ${op} is not in the allowlist.` };
  }
  if (op === "launch" || op === "launch_app") {
    return parseComputerAction({ action: "launch_app", app: normalizeApp(step.app ?? step.target) });
  }
  if (op === "click") {
    return parseComputerAction({
      action: "left_click",
      x: step.x,
      y: step.y,
      frameId: step.frameId,
    });
  }
  return parseComputerAction({ ...step, action: op === "launch" ? "launch_app" : op });
}

function normalizeApp(name) {
  const key = String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  return APP_ALIASES[key] ?? key;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
