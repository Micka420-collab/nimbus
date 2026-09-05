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

const EXPLOIT_MARKERS = Object.freeze([
  "exploit",
  "cve-",
  "payload",
  "shellcode",
  "privilege-escalation",
  "zero-day",
]);

export function classifyDesktopIntent(action) {
  const name = typeof action === "string" ? action : action?.action ?? action?.op ?? "";
  const text = `${name} ${action?.text ?? ""} ${action?.command ?? ""} ${action?.app ?? ""}`.toLowerCase();
  if (EXPLOIT_MARKERS.some((marker) => text.includes(marker))) {
    return { family: "exploit", risk: "blocked", confirm: false };
  }
  if (name === "screen.record" || text.includes("screen.record")) {
    return { family: "screen.record", risk: "denied", confirm: false };
  }
  if (name.startsWith("camera.") || text.includes("camera.snap") || text.includes("camera.clip")) {
    return { family: "camera", risk: "denied", confirm: false };
  }
  if (/\b(send|mail|email|envoyer)\b/.test(text)) {
    return { family: "send", risk: "high", confirm: true };
  }
  if (/\b(delete|supprim|rm -|unlink)\b/.test(text)) {
    return { family: "delete", risk: "high", confirm: true };
  }
  if (/\b(buy|purchase|acheter|payer|checkout|payment)\b/.test(text)) {
    return { family: "purchase", risk: "high", confirm: true };
  }
  if (/\b(install|installer|msiexec|winget)\b/.test(text)) {
    return { family: "install", risk: "high", confirm: true };
  }
  if (name === "system.run" || name === "exec") {
    return { family: "exec", risk: "high", confirm: true };
  }
  return { family: "computer", risk: "medium", confirm: false };
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

export function intentAligned(brief, action) {
  const goal = String(brief ?? "").trim().toLowerCase();
  if (!goal) {
    return { aligned: true, reason: "no_brief" };
  }
  const classification = classifyDesktopIntent(action);
  if (classification.confirm) {
    const hinted = HIGH_IMPACT_FAMILIES.some((family) => goal.includes(family));
    return hinted
      ? { aligned: true, reason: "brief_mentions_impact" }
      : { aligned: false, reason: "impact_not_in_brief" };
  }
  return { aligned: true, reason: "desktop_step" };
}
