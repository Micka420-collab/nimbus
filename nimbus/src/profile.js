import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PROFILE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "profiles", "nimbus");

const PROFILE_FILES = ["SOUL.md", "IDENTITY.md", "USER.md", "AGENTS.md", "MEMORY.md"];

export function profileRoot() {
  return PROFILE_DIR;
}

export function readNimbusProfile() {
  const files = {};
  for (const name of PROFILE_FILES) {
    const path = join(PROFILE_DIR, name);
    files[name] = existsSync(path) ? readFileSync(path, "utf8") : "";
  }
  return {
    id: "nimbus",
    locale: "fr",
    tone: "jarvis",
    files,
  };
}

/**
 * Copy the Nimbus persona into an OpenClaw workspace.
 * Never overwrites an existing file unless force is set.
 */
export function installNimbusProfile(workspaceDir, options = {}) {
  if (typeof workspaceDir !== "string" || workspaceDir.trim() === "") {
    return { ok: false, code: "invalid_workspace", message: "workspace directory required" };
  }
  mkdirSync(workspaceDir, { recursive: true });
  const copied = [];
  const skipped = [];
  for (const name of PROFILE_FILES) {
    const from = join(PROFILE_DIR, name);
    const to = join(workspaceDir, name);
    if (!existsSync(from)) {
      continue;
    }
    if (existsSync(to) && !options.force) {
      skipped.push(name);
      continue;
    }
    copyFileSync(from, to);
    copied.push(name);
  }
  return { ok: true, workspace: workspaceDir, copied, skipped };
}

export function listProfileFiles() {
  if (!existsSync(PROFILE_DIR)) {
    return [];
  }
  return readdirSync(PROFILE_DIR).filter((name) => statSync(join(PROFILE_DIR, name)).isFile());
}
