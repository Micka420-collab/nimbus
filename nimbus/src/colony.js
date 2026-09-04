import { randomUUID } from "node:crypto";
import { authorize, classifyAction } from "./permissions.js";
import { createJsonStore, storePath } from "./store.js";

const EMPTY = { version: 1, workers: [], tasks: [], steps: [] };

/**
 * Colony mode: lead + workers + shared task ledger.
 * Hive-inspired concepts only (clean-room). Risky steps need a human.
 */
export function createColony(rootDir, options = {}) {
  const store = createJsonStore(storePath(rootDir, "colony-ledger.json"), EMPTY);
  const now = options.now ?? (() => new Date().toISOString());
  const permissionMode = options.permissionMode ?? "deny";
  const trust = options.trust ?? null;
  const twin = options.twin ?? null;

  const persist = (mutate) => {
    const doc = store.read();
    const result = mutate(doc);
    if (result.ok !== false) {
      store.write(doc);
    }
    return result;
  };

  return {
    addWorker(input) {
      const id = normalizeId(input?.id);
      const role = input?.role === "lead" ? "lead" : "worker";
      if (!id) {
        return { ok: false, code: "invalid_worker", message: "worker id required" };
      }
      return persist((doc) => {
        if (doc.workers.some((worker) => worker.id === id)) {
          return { ok: false, code: "duplicate_worker", message: "worker already exists" };
        }
        const worker = {
          id,
          role,
          skills: Array.isArray(input?.skills) ? input.skills.map(String) : [],
          createdAt: now(),
        };
        doc.workers.push(worker);
        return { ok: true, worker };
      });
    },

    createTask(input) {
      const title = typeof input?.title === "string" ? input.title.trim() : "";
      if (!title) {
        return { ok: false, code: "invalid_task", message: "title required" };
      }
      return persist((doc) => {
        const task = {
          id: `task_${randomUUID()}`,
          title,
          status: "open",
          assignee: input?.assignee ?? null,
          createdAt: now(),
          updatedAt: now(),
        };
        doc.tasks.push(task);
        return { ok: true, task };
      });
    },

    assignTask(taskId, workerId) {
      return persist((doc) => {
        const task = doc.tasks.find((item) => item.id === taskId);
        const worker = doc.workers.find((item) => item.id === workerId);
        if (!task || !worker) {
          return { ok: false, code: "not_found", message: "task or worker missing" };
        }
        task.assignee = worker.id;
        task.updatedAt = now();
        return { ok: true, task: { ...task } };
      });
    },

    proposeStep(input) {
      const taskId = input?.taskId;
      const action = input?.action;
      const summary = typeof input?.summary === "string" ? input.summary.trim() : "";
      if (!taskId || !action || !summary) {
        return { ok: false, code: "invalid_step", message: "taskId, action, and summary required" };
      }
      return persist((doc) => {
        const task = doc.tasks.find((item) => item.id === taskId);
        if (!task || task.status === "cancelled") {
          return { ok: false, code: "task_unavailable", message: "task missing or cancelled" };
        }
        const classification = classifyAction(action);
        const impact =
          twin && input?.targetId
            ? twin.simulateImpact({ action, targetId: input.targetId })
            : null;
        const decision = authorize({
          action,
          mode: permissionMode,
          approved: false,
        });
        const trusted = Boolean(trust?.mayAutoRun?.(action));
        // High-risk + default-deny stays human-gated even with a hot trust score.
        const autoReady = decision.allowed || (trusted && classification.risk !== "high" && !impact?.blocked);
        const step = {
          id: `step_${randomUUID()}`,
          taskId,
          action,
          summary,
          risk: impact?.blocked ? "high" : classification.risk,
          targetId: input?.targetId ?? null,
          impact,
          trusted,
          status: autoReady && !impact?.blocked ? "ready" : "needs_approval",
          createdAt: now(),
          decidedAt: null,
          decidedBy: null,
        };
        doc.steps.push(step);
        return { ok: true, step, decision, impact };
      });
    },

    decideStep(stepId, verdict, actor = "human") {
      if (verdict !== "approve" && verdict !== "reject") {
        return { ok: false, code: "invalid_verdict", message: "approve or reject" };
      }
      return persist((doc) => {
        const step = doc.steps.find((item) => item.id === stepId);
        if (!step) {
          return { ok: false, code: "not_found", message: "step missing" };
        }
        if (step.status !== "needs_approval") {
          return { ok: false, code: "not_pending", message: "step is not waiting for approval" };
        }
        step.status = verdict === "approve" ? "ready" : "rejected";
        step.decidedAt = now();
        step.decidedBy = actor;
        trust?.record?.(step.action, verdict);
        return { ok: true, step: { ...step } };
      });
    },

    runStep(stepId) {
      return persist((doc) => {
        const step = doc.steps.find((item) => item.id === stepId);
        if (!step) {
          return { ok: false, code: "not_found", message: "step missing" };
        }
        if (step.status !== "ready") {
          return {
            ok: false,
            code: "blocked",
            message: "Étape bloquée : approbation humaine requise pour une action risquée.",
            step: { ...step },
          };
        }
        const decision = authorize({
          action: step.action,
          mode: permissionMode,
          approved: true,
        });
        if (!decision.allowed) {
          return { ok: false, code: "denied", decision, step: { ...step } };
        }
        step.status = "done";
        step.decidedAt = step.decidedAt ?? now();
        return { ok: true, step: { ...step } };
      });
    },

    ledger() {
      const doc = store.read();
      return {
        ok: true,
        workers: doc.workers.map((item) => ({ ...item })),
        tasks: doc.tasks.map((item) => ({ ...item })),
        steps: doc.steps.map((item) => ({ ...item })),
      };
    },
  };
}

function normalizeId(id) {
  if (typeof id !== "string") {
    return "";
  }
  return id.trim().toLowerCase().replace(/\s+/g, "-");
}
