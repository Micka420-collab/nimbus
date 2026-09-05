import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

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
  "workspace.read": { risk: "low", localSafe: true },
  "workspace.write": { risk: "medium", localSafe: false },
  computer: { risk: "medium", localSafe: false },
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
  const trustReady = input?.trustReady === true && classification.risk !== "high";

  if (classification.localSafe && classification.risk === "low") {
    return allowed(classification, mode, "local_safe");
  }

  if (mode === "full") {
    return allowed(classification, mode, "full_escape");
  }

  if (mode === "deny") {
    if (trustReady) {
      return allowed(classification, mode, "trust_ready");
    }
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

  if (trustReady) {
    return allowed(classification, mode, "trust_ready");
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

/**
 * Merge Nimbus default-deny into an OpenClaw config file on disk.
 * Creates the file when missing. Keeps an existing `tools.exec.mode` unless
 * `--force` or the file has no mode yet. Rewrites as JSON (comments dropped).
 * Before rewriting an existing file, copies it to `<path>.bak-YYYYMMDDTHHMMSS`.
 */
export function applyToOpenClawConfig(configPath, options = {}) {
  if (typeof configPath !== "string" || configPath.trim() === "") {
    return { ok: false, code: "invalid_path", message: "config path required" };
  }
  const path = configPath.trim();
  const requestedMode = normalizePermissionMode(options.mode ?? "deny");
  const force = options.force === true;
  const now = options.now ?? (() => new Date());
  const workspace =
    typeof options.workspace === "string" && options.workspace.trim() !== ""
      ? options.workspace.trim()
      : null;

  const existed = existsSync(path);
  let config = {};
  if (existed) {
    const loaded = readOpenClawConfigFile(path);
    if (!loaded.ok) {
      return loaded;
    }
    config = loaded.config;
  }

  ensureRecord(config, "tools");
  ensureRecord(config.tools, "exec");
  if (workspace) {
    ensureRecord(config, "agents");
    ensureRecord(config.agents, "defaults");
  }

  const changes = [];
  const skipped = [];
  const currentMode = typeof config.tools.exec.mode === "string" ? config.tools.exec.mode : null;
  if (currentMode === requestedMode) {
    skipped.push({ path: "tools.exec.mode", reason: "already_set", value: currentMode });
  } else if (currentMode && !force) {
    skipped.push({
      path: "tools.exec.mode",
      reason: "existing_mode_kept",
      value: currentMode,
      requested: requestedMode,
    });
  } else {
    config.tools.exec.mode = requestedMode;
    changes.push({ path: "tools.exec.mode", from: currentMode, to: requestedMode });
  }

  if (workspace) {
    const currentWorkspace =
      typeof config.agents.defaults.workspace === "string" ? config.agents.defaults.workspace : null;
    if (currentWorkspace === workspace) {
      skipped.push({ path: "agents.defaults.workspace", reason: "already_set", value: currentWorkspace });
    } else if (currentWorkspace && !force) {
      skipped.push({
        path: "agents.defaults.workspace",
        reason: "existing_workspace_kept",
        value: currentWorkspace,
        requested: workspace,
      });
    } else {
      config.agents.defaults.workspace = workspace;
      changes.push({ path: "agents.defaults.workspace", from: currentWorkspace, to: workspace });
    }
  }

  let bak = null;
  if (changes.length > 0 || !existed) {
    if (existed) {
      bak = timestampedBakPath(path, now());
      copyFileSync(path, bak);
    }
    writeOpenClawConfigFile(path, config);
  }

  const appliedMode =
    typeof config.tools.exec.mode === "string" ? config.tools.exec.mode : requestedMode;
  return {
    ok: true,
    path,
    bak,
    created: !existed,
    written: changes.length > 0 || !existed,
    mode: appliedMode,
    changes,
    skipped,
  };
}

export function timestampedBakPath(path, at = new Date()) {
  const date = at instanceof Date ? at : new Date(at);
  const stamp = date.toISOString().replaceAll("-", "").replaceAll(":", "").replace(/\.\d{3}Z$/, "");
  let bak = `${path}.bak-${stamp}`;
  if (!existsSync(bak)) {
    return bak;
  }
  let n = 2;
  while (existsSync(`${path}.bak-${stamp}-${n}`)) {
    n += 1;
  }
  return `${path}.bak-${stamp}-${n}`;
}

export function readOpenClawConfigFile(path) {
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (error) {
    return { ok: false, code: "unreadable", message: error instanceof Error ? error.message : String(error) };
  }
  const parsed = parseOpenClawConfigText(raw);
  if (!parsed.ok) {
    return parsed;
  }
  return { ok: true, config: parsed.config };
}

function writeOpenClawConfigFile(path, config) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

function ensureRecord(parent, key) {
  const value = parent[key];
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    parent[key] = {};
  }
}

/**
 * Accepts JSON and the JSON5 subset OpenClaw configs commonly use:
 * comments, unquoted keys, trailing commas. Not a full JSON5 implementation.
 */
export function parseOpenClawConfigText(raw) {
  if (typeof raw !== "string") {
    return { ok: false, code: "invalid_config", message: "config text required" };
  }
  const candidates = [raw, json5SubsetToJson(raw)];
  for (const text of candidates) {
    try {
      const parsed = JSON.parse(text);
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { ok: false, code: "invalid_config", message: "config must be a JSON object" };
      }
      return { ok: true, config: parsed };
    } catch {
      // try the next candidate
    }
  }
  return { ok: false, code: "invalid_config", message: "could not parse OpenClaw config as JSON/JSON5" };
}

function json5SubsetToJson(raw) {
  const withoutComments = stripJson5Comments(raw);
  let out = "";
  let i = 0;
  let inString = false;
  let quote = "";
  let escaped = false;
  while (i < withoutComments.length) {
    const ch = withoutComments[i];
    if (inString) {
      out += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        inString = false;
      }
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      out += '"';
      i += 1;
      continue;
    }
    if (ch === ",") {
      let j = i + 1;
      while (j < withoutComments.length && /\s/.test(withoutComments[j])) {
        j += 1;
      }
      if (withoutComments[j] === "}" || withoutComments[j] === "]") {
        i += 1;
        continue;
      }
    }
    if (lookAheadUnquotedKey(withoutComments, i)) {
      let key = "";
      while (i < withoutComments.length && /[\w$]/.test(withoutComments[i])) {
        key += withoutComments[i];
        i += 1;
      }
      out += `"${key}"`;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

function stripJson5Comments(raw) {
  let out = "";
  let i = 0;
  let inString = false;
  let quote = "";
  let escaped = false;
  while (i < raw.length) {
    const ch = raw[i];
    if (inString) {
      out += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        inString = false;
      }
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === "/" && raw[i + 1] === "/") {
      i += 2;
      while (i < raw.length && raw[i] !== "\n") {
        i += 1;
      }
      continue;
    }
    if (ch === "/" && raw[i + 1] === "*") {
      i += 2;
      while (i < raw.length && !(raw[i] === "*" && raw[i + 1] === "/")) {
        i += 1;
      }
      i += 2;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

function lookAheadUnquotedKey(raw, start) {
  if (!/[A-Za-z_$]/.test(raw[start] ?? "")) {
    return false;
  }
  let i = start;
  while (i < raw.length && /[\w$]/.test(raw[i])) {
    i += 1;
  }
  while (i < raw.length && /\s/.test(raw[i])) {
    i += 1;
  }
  return raw[i] === ":";
}

function allowed(classification, mode, reason) {
  return { ok: true, allowed: true, classification, mode, reason };
}

function denied(classification, mode, reason) {
  return { ok: false, allowed: false, classification, mode, reason };
}
