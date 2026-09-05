/**
 * Nimbus permission overlay. Default-deny.
 * Maps onto OpenClaw `tools.exec.mode` without changing OpenClaw core defaults.
 *
 * Modes (same names as OpenClaw host exec):
 *   deny      — block everything that is not an explicit local-safe read
 *   allowlist — only listed action families
 *   ask       — allowlist hits pass; misses need human approval
 *   auto      — same as ask; reviewer may pre-approve low risk only
 *   full      — operator-owned escape hatch
 */

export const PERMISSION_MODES = Object.freeze(["deny", "allowlist", "ask", "auto", "full"]);

export const ACTION_FAMILIES = Object.freeze({
  "memory.read": { risk: "low", localSafe: true },
  "memory.write": { risk: "low", localSafe: true },
  "timeline.read": { risk: "low", localSafe: true },
  "park.read": { risk: "low", localSafe: true },
  "park.write": { risk: "low", localSafe: true },
  "voice.hud": { risk: "low", localSafe: true },
  "voice.listen": { risk: "medium", localSafe: false, needsConsent: true },
  "workspace.read": { risk: "low", localSafe: true },
  "workspace.write": { risk: "medium", localSafe: false },
  exec: { risk: "high", localSafe: false },
  network: { risk: "high", localSafe: false },
  send: { risk: "high", localSafe: false },
  delete: { risk: "high", localSafe: false },
  credentials: { risk: "high", localSafe: false },
  "fs.outside-workspace": { risk: "high", localSafe: false },
});

export function normalizePermissionMode(mode) {
  if (PERMISSION_MODES.includes(mode)) {
    return mode;
  }
  return "deny";
}

export function classifyAction(action) {
  const family = ACTION_FAMILIES[action];
  if (!family) {
    return { action, risk: "high", localSafe: false, known: false };
  }
  return { action, ...family, known: true };
}

export function authorize(input) {
  const mode = normalizePermissionMode(input?.mode);
  const classification = classifyAction(input?.action);
  const allowlist = Array.isArray(input?.allowlist) ? input.allowlist : [];
  const approved = input?.approved === true;
  const consentGranted = input?.consentGranted === true;

  if (classification.needsConsent && !consentGranted) {
    return denied(classification, mode, "consent_required");
  }

  if (classification.localSafe && classification.risk === "low") {
    return allowed(classification, mode, "local_safe");
  }

  if (mode === "full") {
    return allowed(classification, mode, "full_escape");
  }

  if (mode === "deny") {
    if (approved && classification.risk !== "high") {
      return allowed(classification, mode, "human_approved");
    }
    if (approved && classification.risk === "high") {
      return allowed(classification, mode, "human_approved_high");
    }
    return denied(classification, mode, "default_deny");
  }

  const listed = allowlist.includes(classification.action);
  if (mode === "allowlist") {
    return listed
      ? allowed(classification, mode, "allowlist_hit")
      : denied(classification, mode, "allowlist_miss");
  }

  if (listed) {
    return allowed(classification, mode, "allowlist_hit");
  }

  if (approved) {
    return allowed(classification, mode, "human_approved");
  }

  if (mode === "auto" && classification.risk === "low") {
    return allowed(classification, mode, "auto_low");
  }

  return denied(classification, mode, "needs_human");
}

export function describePermissionModes() {
  return {
    defaultMode: "deny",
    openclawMapping: {
      deny: "tools.exec.mode = deny",
      allowlist: "tools.exec.mode = allowlist",
      ask: "tools.exec.mode = ask",
      auto: "tools.exec.mode = auto",
      full: "tools.exec.mode = full",
    },
    modes: PERMISSION_MODES,
    families: { ...ACTION_FAMILIES },
  };
}

function allowed(classification, mode, reason) {
  return { ok: true, allowed: true, classification, mode, reason };
}

function denied(classification, mode, reason) {
  return { ok: false, allowed: false, classification, mode, reason };
}
