import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Durable local JSON document store.
 * Named product artifact (operator memory / ledger), not OpenClaw runtime state.
 */
export function createJsonStore(filePath, emptyDoc) {
  const resolved = filePath;

  const read = () => {
    try {
      const raw = readFileSync(resolved, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        return structuredClone(emptyDoc);
      }
      return parsed;
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        return structuredClone(emptyDoc);
      }
      throw error;
    }
  };

  const write = (doc) => {
    mkdirSync(dirname(resolved), { recursive: true });
    const tmp = `${resolved}.${process.pid}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
    renameSync(tmp, resolved);
  };

  return { path: resolved, read, write };
}

export function storePath(rootDir, name) {
  return join(rootDir, name);
}
