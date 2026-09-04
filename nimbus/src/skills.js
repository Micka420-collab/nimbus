import { randomUUID } from "node:crypto";
import { assertNoSecret } from "./secrets.js";
import { classifyAction } from "./permissions.js";
import { createJsonStore, storePath } from "./store.js";

const EMPTY = { version: 1, patterns: {}, drafts: [] };

/**
 * After N identical successful patterns, propose a local skill draft.
 * Drafts stay in sandbox / deny-exec until a human approves.
 */
export function createSkillForge(rootDir, options = {}) {
  const store = createJsonStore(storePath(rootDir, "skills.json"), EMPTY);
  const now = options.now ?? (() => new Date().toISOString());
  const threshold = Number.isFinite(options.threshold) ? options.threshold : 3;

  const persist = (mutate) => {
    const doc = store.read();
    const result = mutate(doc);
    if (result.ok !== false) {
      store.write(doc);
    }
    return result;
  };

  return {
    recordSuccess(input) {
      const pattern = normalizePattern(input?.pattern ?? input?.summary);
      const summary = typeof input?.summary === "string" ? input.summary.trim() : pattern;
      const action = input?.action ?? "workspace.read";
      if (!pattern) {
        return { ok: false, code: "invalid_pattern", message: "pattern required" };
      }
      const secret = assertNoSecret(`${pattern}\n${summary}`, "skill");
      if (!secret.ok) {
        return secret;
      }
      return persist((doc) => {
        const row = doc.patterns[pattern] ?? { count: 0, action, summary };
        row.count += 1;
        row.action = action;
        row.summary = summary;
        row.updatedAt = now();
        doc.patterns[pattern] = row;
        let draft = doc.drafts.find((item) => item.pattern === pattern);
        if (!draft && row.count >= threshold) {
          draft = {
            id: `skill_${randomUUID()}`,
            pattern,
            title: summary,
            action,
            status: "sandbox",
            execMode: "deny",
            hits: row.count,
            createdAt: now(),
            approvedAt: null,
            runs: [],
          };
          doc.drafts.push(draft);
        } else if (draft) {
          draft.hits = row.count;
        }
        return { ok: true, pattern: row, draft: draft ? { ...draft } : null, proposed: Boolean(draft) };
      });
    },

    approve(skillId) {
      return persist((doc) => {
        const draft = doc.drafts.find((item) => item.id === skillId);
        if (!draft) {
          return { ok: false, code: "not_found", message: "skill missing" };
        }
        if (draft.status === "approved") {
          return { ok: false, code: "already_approved", skill: { ...draft } };
        }
        draft.status = "approved";
        draft.approvedAt = now();
        return { ok: true, skill: { ...draft } };
      });
    },

    reject(skillId) {
      return persist((doc) => {
        const draft = doc.drafts.find((item) => item.id === skillId);
        if (!draft) {
          return { ok: false, code: "not_found", message: "skill missing" };
        }
        draft.status = "rejected";
        return { ok: true, skill: { ...draft } };
      });
    },

    sandboxRun(skillId) {
      return persist((doc) => {
        const draft = doc.drafts.find((item) => item.id === skillId);
        if (!draft) {
          return { ok: false, code: "not_found", message: "skill missing" };
        }
        if (draft.status === "rejected") {
          return { ok: false, code: "rejected", skill: { ...draft } };
        }
        const run = {
          id: `run_${randomUUID()}`,
          at: now(),
          mode: "sandbox",
          action: draft.action,
          execMode: "deny",
          dryRun: true,
        };
        draft.runs.push(run);
        return {
          ok: true,
          run,
          skill: { ...draft },
          message: "Exécution bac à sable — aucun exec hôte.",
        };
      });
    },

    run(skillId) {
      return persist((doc) => {
        const draft = doc.drafts.find((item) => item.id === skillId);
        if (!draft) {
          return { ok: false, code: "not_found", message: "skill missing" };
        }
        if (draft.status !== "approved") {
          return {
            ok: false,
            code: "sandbox_only",
            message: "Skill en bac à sable — approbation humaine requise.",
            skill: { ...draft },
          };
        }
        const classification = classifyAction(draft.action);
        if (classification.risk === "high") {
          return {
            ok: false,
            code: "deny_exec",
            message: "Même approuvée, une skill à risque haut reste en deny-exec. Passe par la colonie.",
            skill: { ...draft },
          };
        }
        const run = { id: `run_${randomUUID()}`, at: now(), mode: "approved", action: draft.action, dryRun: false };
        draft.runs.push(run);
        return { ok: true, run, skill: { ...draft } };
      });
    },

    list() {
      const doc = store.read();
      return { ok: true, drafts: doc.drafts.map((item) => ({ ...item })), patterns: { ...doc.patterns } };
    },
  };
}

function normalizePattern(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
