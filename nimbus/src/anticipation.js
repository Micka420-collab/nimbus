import { randomUUID } from "node:crypto";
import { createJsonStore, storePath } from "./store.js";

const EMPTY = { version: 1, hints: [], weights: {}, lastShown: {} };

const DEFAULTS = {
  windowMs: 4 * 3600_000,
  maxPerWindow: 1,
  suppressBelow: 0.35,
  startWeight: 0.55,
  usefulDelta: 0.15,
  notUsefulDelta: 0.2,
};

/**
 * Calibrated anticipation: local hints, operator ratings, anti-spam.
 * Calendar/heartbeat payloads are stubs the operator (or a later adapter) feeds in.
 */
export function createAnticipation(rootDir, options = {}) {
  const store = createJsonStore(storePath(rootDir, "anticipation.json"), EMPTY);
  const now = options.now ?? (() => new Date().toISOString());
  const nowMs = () => Date.parse(now());
  const cfg = { ...DEFAULTS, ...options };

  const persist = (mutate) => {
    const doc = store.read();
    const result = mutate(doc);
    if (result.ok !== false) {
      store.write(doc);
    }
    return result;
  };

  const weightFor = (doc, context) => {
    const value = doc.weights[context];
    return Number.isFinite(value) ? value : cfg.startWeight;
  };

  return {
    scheduleHint(input) {
      const context = String(input?.context ?? "general").trim().toLowerCase() || "general";
      const text = typeof input?.text === "string" ? input.text.trim() : "";
      if (!text) {
        return { ok: false, code: "invalid_hint", message: "text required" };
      }
      const at = input?.at ?? now();
      return persist((doc) => {
        const hint = {
          id: `hint_${randomUUID()}`,
          context,
          text,
          source: input?.source ?? "heartbeat",
          at,
          shown: false,
          rating: null,
          createdAt: now(),
        };
        doc.hints.push(hint);
        return { ok: true, hint };
      });
    },

    dueHints() {
      const doc = store.read();
      const instant = now();
      const instantMs = nowMs();
      const selected = [];
      const blocked = [];
      const byContext = new Map();
      for (const hint of doc.hints) {
        if (hint.shown || hint.rating || Date.parse(hint.at) > instantMs) {
          continue;
        }
        const list = byContext.get(hint.context) ?? [];
        list.push(hint);
        byContext.set(hint.context, list);
      }
      for (const [context, hints] of byContext) {
        const weight = weightFor(doc, context);
        if (weight < cfg.suppressBelow) {
          blocked.push({ context, reason: "calibrated_quiet", weight });
          continue;
        }
        const last = Date.parse(doc.lastShown[context] ?? 0);
        const shownInWindow = Number.isFinite(last) && instantMs - last < cfg.windowMs;
        if (shownInWindow) {
          blocked.push({ context, reason: "cooldown", weight });
          continue;
        }
        selected.push({ ...hints[0], weight });
        if (selected.length >= cfg.maxPerWindow) {
          break;
        }
      }
      return persist((doc) => {
        for (const hint of selected) {
          const live = doc.hints.find((item) => item.id === hint.id);
          if (live) {
            live.shown = true;
            live.shownAt = instant;
          }
          doc.lastShown[hint.context] = instant;
        }
        return {
          ok: true,
          hints: selected,
          suppressed: blocked,
          note: selected.length === 0 ? "Aucun indice — anti-spam ou rien de dû." : null,
        };
      });
    },

    rate(hintId, verdict) {
      if (verdict !== "useful" && verdict !== "not_useful") {
        return { ok: false, code: "invalid_rating", message: "useful or not_useful" };
      }
      return persist((doc) => {
        const hint = doc.hints.find((item) => item.id === hintId);
        if (!hint) {
          return { ok: false, code: "not_found", message: "hint missing" };
        }
        hint.rating = verdict;
        hint.ratedAt = now();
        const current = weightFor(doc, hint.context);
        const next =
          verdict === "useful"
            ? Math.min(1, current + cfg.usefulDelta)
            : Math.max(0, current - cfg.notUsefulDelta);
        doc.weights[hint.context] = Math.round(next * 1000) / 1000;
        return { ok: true, hint: { ...hint }, weight: doc.weights[hint.context] };
      });
    },

    weights() {
      return { ok: true, weights: { ...store.read().weights } };
    },
  };
}
