import { randomUUID } from "node:crypto";
import { createJsonStore, storePath } from "./store.js";

const EMPTY = { version: 1, online: true, queue: [] };

/**
 * Offline continuum: queue work while disconnected; reconnect returns
 * a summary plus anything still waiting for a human.
 */
export function createContinuum(rootDir, options = {}) {
  const store = createJsonStore(storePath(rootDir, "continuum.json"), EMPTY);
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
    setOnline(online) {
      return persist((doc) => {
        doc.online = Boolean(online);
        return { ok: true, online: doc.online };
      });
    },

    enqueue(input) {
      const action = input?.action;
      const summary = typeof input?.summary === "string" ? input.summary.trim() : "";
      if (!action || !summary) {
        return { ok: false, code: "invalid_item", message: "action and summary required" };
      }
      return persist((doc) => {
        const needsApproval = input?.needsApproval !== false && input?.risk !== "low";
        const item = {
          id: `q_${randomUUID()}`,
          action,
          summary,
          payload: input?.payload ?? {},
          needsApproval,
          status: "queued",
          createdAt: now(),
          deliveredAt: null,
        };
        doc.queue.push(item);
        if (doc.online) {
          item.status = needsApproval ? "pending_approval" : "delivered";
          item.deliveredAt = now();
        }
        return { ok: true, item: { ...item }, online: doc.online };
      });
    },

    reconnect() {
      return persist((doc) => {
        doc.online = true;
        const delivered = [];
        const pendingApprovals = [];
        for (const item of doc.queue) {
          if (item.status !== "queued") {
            if (item.status === "pending_approval") {
              pendingApprovals.push({ ...item });
            }
            continue;
          }
          item.deliveredAt = now();
          if (item.needsApproval) {
            item.status = "pending_approval";
            pendingApprovals.push({ ...item });
          } else {
            item.status = "delivered";
            delivered.push({ ...item });
          }
        }
        return {
          ok: true,
          online: true,
          summary: {
            delivered: delivered.length,
            pendingApprovals: pendingApprovals.length,
            text:
              pendingApprovals.length > 0
                ? `Reconnecté : ${delivered.length} action(s) livrée(s), ${pendingApprovals.length} en attente d'approbation.`
                : `Reconnecté : ${delivered.length} action(s) livrée(s), rien à approuver.`,
          },
          delivered,
          pendingApprovals,
        };
      });
    },

    decide(itemId, verdict) {
      if (verdict !== "approve" && verdict !== "reject") {
        return { ok: false, code: "invalid_verdict", message: "approve or reject" };
      }
      return persist((doc) => {
        const item = doc.queue.find((row) => row.id === itemId);
        if (!item) {
          return { ok: false, code: "not_found", message: "queue item missing" };
        }
        if (item.status !== "pending_approval") {
          return { ok: false, code: "not_pending", item: { ...item } };
        }
        item.status = verdict === "approve" ? "approved" : "rejected";
        item.decidedAt = now();
        return { ok: true, item: { ...item } };
      });
    },

    status() {
      const doc = store.read();
      return {
        ok: true,
        online: doc.online,
        queued: doc.queue.filter((item) => item.status === "queued").length,
        pendingApprovals: doc.queue.filter((item) => item.status === "pending_approval").length,
        items: doc.queue.map((item) => ({ ...item })),
      };
    },
  };
}
