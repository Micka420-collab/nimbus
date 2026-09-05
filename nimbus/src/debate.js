import { randomUUID } from "node:crypto";
import { createJsonStore, storePath } from "./store.js";

const SIDES = new Set(["security", "speed"]);

const EMPTY = { version: 1, debates: [] };

/**
 * Two workers argue security vs speed. Queen recommends; human decides.
 * Both briefs stay on the ledger.
 */
export function createDebate(rootDir, options = {}) {
  const store = createJsonStore(storePath(rootDir, "debates.json"), EMPTY);
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
    open(input) {
      const question = typeof input?.question === "string" ? input.question.trim() : "";
      if (!question) {
        return { ok: false, code: "invalid_debate", message: "question required" };
      }
      return persist((doc) => {
        const debate = {
          id: `deb_${randomUUID()}`,
          question,
          taskId: input?.taskId ?? null,
          status: "open",
          briefs: { security: null, speed: null },
          queenPick: null,
          queenNote: null,
          decision: null,
          decidedBy: null,
          createdAt: now(),
        };
        doc.debates.push(debate);
        return { ok: true, debate };
      });
    },

    argue(debateId, side, argument, workerId = side) {
      if (!SIDES.has(side)) {
        return { ok: false, code: "invalid_side", message: "security or speed" };
      }
      const text = typeof argument === "string" ? argument.trim() : "";
      if (!text) {
        return { ok: false, code: "invalid_argument", message: "argument required" };
      }
      return persist((doc) => {
        const debate = doc.debates.find((item) => item.id === debateId);
        if (!debate || debate.status === "closed") {
          return { ok: false, code: "unavailable", message: "debate missing or closed" };
        }
        debate.briefs[side] = { workerId, argument: text, at: now() };
        return { ok: true, debate: cloneDebate(debate) };
      });
    },

    queenRecommend(debateId, pick, note = "") {
      if (!SIDES.has(pick)) {
        return { ok: false, code: "invalid_pick", message: "security or speed" };
      }
      return persist((doc) => {
        const debate = doc.debates.find((item) => item.id === debateId);
        if (!debate) {
          return { ok: false, code: "not_found", message: "debate missing" };
        }
        if (!debate.briefs.security || !debate.briefs.speed) {
          return { ok: false, code: "incomplete", message: "both sides must speak first" };
        }
        debate.queenPick = pick;
        debate.queenNote = note;
        debate.status = "awaiting_human";
        return { ok: true, debate: cloneDebate(debate) };
      });
    },

    decide(debateId, pick, actor = "human") {
      if (!SIDES.has(pick)) {
        return { ok: false, code: "invalid_pick", message: "security or speed" };
      }
      return persist((doc) => {
        const debate = doc.debates.find((item) => item.id === debateId);
        if (!debate) {
          return { ok: false, code: "not_found", message: "debate missing" };
        }
        if (debate.status !== "awaiting_human") {
          return { ok: false, code: "not_ready", message: "Queen + both briefs required before a human pick" };
        }
        debate.decision = pick;
        debate.decidedBy = actor;
        debate.status = "closed";
        debate.closedAt = now();
        return { ok: true, debate: cloneDebate(debate) };
      });
    },

    ledger() {
      return { ok: true, debates: store.read().debates.map(cloneDebate) };
    },
  };
}

function cloneDebate(debate) {
  return {
    ...debate,
    briefs: {
      security: debate.briefs.security ? { ...debate.briefs.security } : null,
      speed: debate.briefs.speed ? { ...debate.briefs.speed } : null,
    },
  };
}
