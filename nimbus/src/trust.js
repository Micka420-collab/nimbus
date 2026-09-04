import { createJsonStore, storePath } from "./store.js";
import { classifyAction } from "./permissions.js";

const EMPTY = { version: 1, tools: {} };

/**
 * Per-tool trust from human approvals/rejects.
 * Never auto-runs high-risk actions under default-deny.
 */
export function createTrust(rootDir, options = {}) {
  const store = createJsonStore(storePath(rootDir, "trust.json"), EMPTY);
  const threshold = Number.isFinite(options.threshold) ? options.threshold : 0.8;
  const minSamples = Number.isFinite(options.minSamples) ? options.minSamples : 3;

  const persist = (mutate) => {
    const doc = store.read();
    const result = mutate(doc);
    if (result.ok !== false) {
      store.write(doc);
    }
    return result;
  };

  const snapshot = (action) => {
    const row = store.read().tools[action] ?? { approvals: 0, rejects: 0 };
    const samples = row.approvals + row.rejects;
    const score = samples === 0 ? 0 : Math.round((row.approvals / samples) * 1000) / 1000;
    const classification = classifyAction(action);
    const above = samples >= minSamples && score >= threshold;
    const mayAutoRun = above && classification.risk !== "high";
    return {
      action,
      approvals: row.approvals,
      rejects: row.rejects,
      samples,
      score,
      threshold,
      minSamples,
      risk: classification.risk,
      mayAutoRun,
    };
  };

  return {
    record(action, verdict) {
      if (verdict !== "approve" && verdict !== "reject") {
        return { ok: false, code: "invalid_verdict", message: "approve or reject" };
      }
      if (!action) {
        return { ok: false, code: "invalid_action", message: "action required" };
      }
      return persist((doc) => {
        const row = doc.tools[action] ?? { approvals: 0, rejects: 0 };
        if (verdict === "approve") {
          row.approvals += 1;
        } else {
          row.rejects += 1;
        }
        doc.tools[action] = row;
        return { ok: true, ...snapshot(action) };
      });
    },

    score(action) {
      return { ok: true, ...snapshot(action) };
    },

    mayAutoRun(action) {
      return snapshot(action).mayAutoRun;
    },

    list() {
      const doc = store.read();
      return { ok: true, tools: Object.keys(doc.tools).sort().map((action) => snapshot(action)) };
    },
  };
}
