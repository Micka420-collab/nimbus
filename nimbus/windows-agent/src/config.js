import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pairingConfigRecord, parsePairingInput } from "./pairing.js";

export const CONFIG_FILE = "windows-agent.json";

export function configPath(stateDir) {
  return join(stateDir, CONFIG_FILE);
}

export function loadAgentConfig(stateDir) {
  const path = configPath(stateDir);
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, code: "invalid_config", message: "windows-agent.json must be an object." };
    }
    return { ok: true, path, config: parsed };
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return { ok: false, code: "missing_config", message: "No pairing config yet.", path };
    }
    return { ok: false, code: "invalid_config", message: "Could not read windows-agent.json." };
  }
}

export function savePairingConfig(stateDir, input, extras = {}) {
  const parsed = parsePairingInput(input, extras);
  if (!parsed.ok) {
    return parsed;
  }
  const record = pairingConfigRecord(parsed, {
    ...extras,
    pairedAt: extras.pairedAt ?? new Date().toISOString(),
  });
  const path = configPath(stateDir);
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
  return { ok: true, path, config: record };
}

export function mergeAgentConfig(stateDir, patch) {
  const loaded = loadAgentConfig(stateDir);
  if (!loaded.ok) {
    return loaded;
  }
  const next = {
    ...loaded.config,
    ...patch,
    auth: patch.auth
      ? { ...loaded.config.auth, ...patch.auth }
      : loaded.config.auth,
  };
  const path = configPath(stateDir);
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
  return { ok: true, path, config: next };
}

/**
 * Writes an operator-chosen vision/tool model onto an OpenClaw config object.
 * Does not invent credentials. Existing model is kept unless force=true.
 */
export function applyVisionModel(config, modelRef, options = {}) {
  if (config === null || typeof config !== "object" || Array.isArray(config)) {
    return { ok: false, code: "invalid_config", message: "config must be an object." };
  }
  const model = String(modelRef ?? "").trim();
  if (!model || model.includes(" ")) {
    return { ok: false, code: "invalid_model", message: "Model ref must be like openai/<id>." };
  }
  const next = structuredClone(config);
  next.agents = next.agents && typeof next.agents === "object" ? next.agents : {};
  next.agents.defaults = next.agents.defaults && typeof next.agents.defaults === "object" ? next.agents.defaults : {};
  const current = next.agents.defaults.model;
  if (current && options.force !== true) {
    return { ok: true, written: false, kept: current, requested: model };
  }
  next.agents.defaults.model = model;
  next.agents.defaults.models = next.agents.defaults.models && typeof next.agents.defaults.models === "object"
    ? next.agents.defaults.models
    : {};
  const [provider, id] = model.split("/");
  if (provider && id) {
    next.agents.defaults.models[model] = { alias: id };
  }
  return { ok: true, written: true, config: next, model };
}
