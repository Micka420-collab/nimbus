import { randomUUID } from "node:crypto";
import { createJsonStore, storePath } from "./store.js";

const EMPTY = { version: 1, sessions: [], events: [] };

/** Rough public list prices used only for operator ballpark, not billing. */
export const ROUGH_RATES_USD = Object.freeze({
  inputPerMillion: 3,
  outputPerMillion: 15,
});

export function estimateCostUsd(tokensIn, tokensOut, rates = ROUGH_RATES_USD) {
  const input = Number.isFinite(tokensIn) ? Math.max(0, tokensIn) : 0;
  const output = Number.isFinite(tokensOut) ? Math.max(0, tokensOut) : 0;
  const usd = (input / 1_000_000) * rates.inputPerMillion + (output / 1_000_000) * rates.outputPerMillion;
  return Math.round(usd * 10_000) / 10_000;
}

export function createParkDesk(rootDir, options = {}) {
  const store = createJsonStore(storePath(rootDir, "park-timeline.json"), EMPTY);
  const now = options.now ?? (() => new Date().toISOString());

  const persist = (mutate) => {
    const doc = store.read();
    const result = mutate(doc);
    if (result.ok !== false) {
      store.write(doc);
    }
    return result;
  };

  const appendEvent = (doc, sessionId, type, extra = {}) => {
    const tokensIn = Number(extra.tokensIn) || 0;
    const tokensOut = Number(extra.tokensOut) || 0;
    const event = {
      id: `evt_${randomUUID()}`,
      sessionId,
      type,
      at: now(),
      detail: extra.detail ?? "",
      tokensIn,
      tokensOut,
      usdEstimate: extra.usdEstimate ?? estimateCostUsd(tokensIn, tokensOut),
    };
    doc.events.push(event);
    return event;
  };

  return {
    start(input) {
      const title = typeof input?.title === "string" ? input.title.trim() : "session";
      return persist((doc) => {
        const session = {
          id: `sess_${randomUUID()}`,
          title,
          status: "active",
          parkedAt: null,
          resumedAt: null,
          snapshot: input?.snapshot ?? {},
          createdAt: now(),
        };
        doc.sessions.push(session);
        appendEvent(doc, session.id, "start", { detail: title });
        return { ok: true, session };
      });
    },

    park(sessionId, reason = "") {
      return persist((doc) => {
        const session = doc.sessions.find((item) => item.id === sessionId);
        if (!session) {
          return { ok: false, code: "not_found", message: "session missing" };
        }
        if (session.status === "parked") {
          return { ok: false, code: "already_parked", session: { ...session } };
        }
        session.status = "parked";
        session.parkedAt = now();
        const event = appendEvent(doc, session.id, "park", { detail: reason });
        return { ok: true, session: { ...session }, event };
      });
    },

    resume(sessionId) {
      return persist((doc) => {
        const session = doc.sessions.find((item) => item.id === sessionId);
        if (!session) {
          return { ok: false, code: "not_found", message: "session missing" };
        }
        if (session.status !== "parked") {
          return { ok: false, code: "not_parked", session: { ...session } };
        }
        session.status = "active";
        session.resumedAt = now();
        const event = appendEvent(doc, session.id, "resume");
        return { ok: true, session: { ...session }, event };
      });
    },

    recordAction(sessionId, input) {
      return persist((doc) => {
        const session = doc.sessions.find((item) => item.id === sessionId);
        if (!session) {
          return { ok: false, code: "not_found", message: "session missing" };
        }
        const event = appendEvent(doc, session.id, input?.type ?? "action", {
          detail: input?.detail ?? "",
          tokensIn: input?.tokensIn,
          tokensOut: input?.tokensOut,
        });
        return { ok: true, event };
      });
    },

    timeline(sessionId) {
      const doc = store.read();
      const events = doc.events.filter((event) => !sessionId || event.sessionId === sessionId);
      return { ok: true, events };
    },

    cost(sessionId) {
      const events = this.timeline(sessionId).events;
      const tokensIn = events.reduce((sum, event) => sum + event.tokensIn, 0);
      const tokensOut = events.reduce((sum, event) => sum + event.tokensOut, 0);
      return {
        ok: true,
        tokensIn,
        tokensOut,
        usdEstimate: estimateCostUsd(tokensIn, tokensOut),
        rates: ROUGH_RATES_USD,
        note: "Estimation brute, pas une facture.",
      };
    },
  };
}
