/**
 * Constrained desktop/browser program — code-execution *style*, not eval.
 * Closed step list only. Unknown ops fail closed.
 */

import { parseComputerAction } from "./computer-actions.js";
import { canonicalLaunchApp } from "./launch-targets.js";

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
  "goto",
  "navigate",
]);

/**
 * @param {unknown} raw
 * @returns {{ ok: boolean, steps?: object[], brief?: string, code?: string, message?: string }}
 */
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
  if (op === "goto" || op === "navigate") {
    return parseComputerAction({ action: "goto", url: step.url ?? step.href ?? step.target });
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
  return canonicalLaunchApp(name);
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
