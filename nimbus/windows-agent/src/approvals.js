import { compileDesktopPhrase } from "./planner.js";

/** High-impact families that always need a visible human confirm outside `full`. */
export const HIGH_IMPACT_FAMILIES = Object.freeze([
  "send",
  "delete",
  "purchase",
  "pay",
  "install",
  "credentials",
  "exec",
]);

export const DEFAULT_DENIED_COMMANDS = Object.freeze(["screen.record", "camera.snap", "camera.clip"]);

const HIGH_IMPACT_OPS = Object.freeze({
  exec: "exec",
  shell: "exec",
  "system.run": "exec",
  install: "install",
  delete: "delete",
  send: "send",
});

const EXPLOIT_MARKERS = Object.freeze([
  "exploit",
  "cve-",
  "payload",
  "shellcode",
  "privilege-escalation",
  "zero-day",
]);

/**
 * Classify from the structured opcode only — never from typed prose.
 */
export function classifyDesktopIntent(action) {
  const opcode = structuredOpcode(action);
  const command = typeof action === "string" ? "" : String(action?.command ?? "");
  if (isExploitOpcode(opcode, command)) {
    return { family: "exploit", risk: "blocked", confirm: false, opcode };
  }
  if (opcode === "screen.record" || command === "screen.record") {
    return { family: "screen.record", risk: "denied", confirm: false, opcode };
  }
  if (opcode.startsWith("camera.") || command.startsWith("camera.")) {
    return { family: "camera", risk: "denied", confirm: false, opcode };
  }
  if (DEFAULT_DENIED_COMMANDS.includes(command)) {
    return { family: command, risk: "denied", confirm: false, opcode };
  }
  const impact = HIGH_IMPACT_OPS[opcode];
  if (impact) {
    return { family: impact, risk: "high", confirm: true, opcode };
  }
  return { family: "computer", risk: "medium", confirm: false, opcode };
}

export function authorizeComputerAction(input = {}) {
  const action = input.action ?? {};
  const classification = classifyDesktopIntent(action);
  const approved = input.approved === true;
  const computerControlEnabled = input.computerControlEnabled !== false;
  const hudVisible = input.hudVisible === true;
  const allowedCommands = Array.isArray(input.allowedCommands) ? input.allowedCommands : null;

  if (classification.family === "exploit") {
    return {
      ok: false,
      allowed: false,
      reason: "exploit_blocked",
      classification,
    };
  }
  if (classification.risk === "denied") {
    return {
      ok: false,
      allowed: false,
      reason: "default_deny",
      classification,
    };
  }
  if (!computerControlEnabled) {
    return { ok: false, allowed: false, reason: "computer_control_off", classification };
  }
  if (!hudVisible && classification.family === "computer") {
    return { ok: false, allowed: false, reason: "hud_required", classification };
  }
  const command = typeof action.command === "string" ? action.command : null;
  if (command && DEFAULT_DENIED_COMMANDS.includes(command)) {
    return { ok: false, allowed: false, reason: "default_deny", classification };
  }
  if (command && allowedCommands && !allowedCommands.includes(command)) {
    return { ok: false, allowed: false, reason: "command_not_declared", classification };
  }
  if (classification.confirm && !approved) {
    return { ok: false, allowed: false, reason: "needs_human", classification };
  }
  return { ok: true, allowed: true, reason: "authorized", classification };
}

/**
 * Structured brief (compiled steps) vs structured action. No FR/EN keyword overlap.
 */
export function intentAligned(brief, action) {
  const opcode = structuredOpcode(action);
  const goal = String(brief ?? "").trim();
  if (!goal) {
    return { aligned: true, reason: "no_brief", opcode };
  }
  const planned = compileDesktopPhrase(goal);
  if (!planned.ok) {
    return { aligned: true, reason: "no_structured_brief", opcode };
  }
  const ops = new Set((planned.steps ?? []).map((step) => structuredOpcode(step)));
  if (ops.has(opcode)) {
    return { aligned: true, reason: "structured_match", opcode };
  }
  return { aligned: false, reason: "structured_mismatch", opcode, planned: [...ops] };
}

export function structuredOpcode(action) {
  const raw = typeof action === "string" ? action : (action?.action ?? action?.op ?? "");
  const name = String(raw).trim();
  if (name === "launch") {
    return "launch_app";
  }
  if (name === "click" || name === "left_click") {
    return "left_click";
  }
  if (name === "navigate") {
    return "goto";
  }
  return name;
}

function isExploitOpcode(opcode, command) {
  const surface = `${opcode} ${command}`.toLowerCase();
  return EXPLOIT_MARKERS.some((marker) => surface.includes(marker));
}
