import { randomUUID } from "node:crypto";
import { assertNoSecret } from "./secrets.js";
import { createJsonStore, storePath } from "./store.js";

const EMPTY = { version: 1, entries: [] };
const KINDS = new Set(["preference", "correction", "fact"]);

export function createMemory(rootDir, options = {}) {
  const store = createJsonStore(storePath(rootDir, "memory.json"), EMPTY);
  const now = options.now ?? (() => new Date().toISOString());

  const persist = (mutate) => {
    const doc = store.read();
    const result = mutate(doc);
    if (result.ok !== false) {
      store.write(doc);
    }
    return result;
  };

  return {
    learn(input) {
      const key = normalizeKey(input?.key);
      const value = typeof input?.value === "string" ? input.value.trim() : "";
      const kind = KINDS.has(input?.kind) ? input.kind : "preference";
      if (!key || !value) {
        return { ok: false, code: "invalid_entry", message: "key and value are required." };
      }
      const secret = assertNoSecret(`${key}\n${value}`, "memory");
      if (!secret.ok) {
        return secret;
      }
      return persist((doc) => {
        const existing = doc.entries.find((entry) => entry.key === key && !entry.forgotten);
        const stamp = now();
        if (existing) {
          existing.value = value;
          existing.kind = kind;
          existing.updatedAt = stamp;
          existing.source = input?.source ?? existing.source ?? "operator";
          return { ok: true, entry: { ...existing }, updated: true };
        }
        const entry = {
          id: `mem_${randomUUID()}`,
          key,
          value,
          kind,
          source: input?.source ?? "operator",
          createdAt: stamp,
          updatedAt: stamp,
          forgotten: false,
        };
        doc.entries.push(entry);
        return { ok: true, entry: { ...entry }, updated: false };
      });
    },

    forget(input) {
      return persist((doc) => {
        const matches = doc.entries.filter((entry) => matchesForget(entry, input));
        if (matches.length === 0) {
          return { ok: false, code: "not_found", message: "Aucun souvenir correspondant." };
        }
        const stamp = now();
        for (const entry of matches) {
          entry.forgotten = true;
          entry.forgottenAt = stamp;
        }
        return { ok: true, forgotten: matches.map((entry) => entry.id) };
      });
    },

    recall(input = {}) {
      const query = typeof input.query === "string" ? input.query.trim().toLowerCase() : "";
      const limit = clampLimit(input.limit);
      const entries = store
        .read()
        .entries.filter((entry) => !entry.forgotten)
        .filter((entry) => {
          if (!query) {
            return true;
          }
          return `${entry.key} ${entry.value}`.toLowerCase().includes(query);
        })
        .slice(-limit)
        .map((entry) => ({ ...entry }));
      return { ok: true, entries };
    },

    list() {
      return this.recall({ limit: 500 });
    },
  };
}

function normalizeKey(key) {
  if (typeof key !== "string") {
    return "";
  }
  return key.trim().toLowerCase().replace(/\s+/g, "-");
}

function matchesForget(entry, input) {
  if (entry.forgotten) {
    return false;
  }
  if (input?.id) {
    return entry.id === input.id;
  }
  if (input?.key) {
    return entry.key === normalizeKey(input.key);
  }
  if (input?.query) {
    const query = String(input.query).toLowerCase();
    return `${entry.key} ${entry.value}`.toLowerCase().includes(query);
  }
  return false;
}

function clampLimit(limit) {
  if (!Number.isFinite(limit) || limit <= 0) {
    return 50;
  }
  return Math.min(500, Math.floor(limit));
}
