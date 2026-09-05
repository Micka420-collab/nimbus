import { astraHud } from "./labels.js";
import { authorizeComputerAction, intentAligned } from "./approvals.js";
import { createActionExecutor } from "./computer-actions.js";
import { compileDesktopPhrase, parseHarnessProgram } from "./harness.js";

const STATUSES = new Set(["idle", "running", "waiting_approval", "aborted"]);

/**
 * Observe → decide → validate → execute → re-observe.
 * Decision is supplied by the caller (gateway / model). This owner validates
 * and executes; it never invents a silent desktop action.
 */
export function createComputerLoop(options = {}) {
  const executor = createActionExecutor(options.adapter ?? recordingAdapter());
  let status = "idle";
  let brief = "";
  let frameId = null;
  let aborted = false;
  let lastObservation = null;
  const log = [];

  const snapshot = () => {
    const state = { status, brief, frameId, aborted, lastObservation };
    return { ...state, hud: astraHud(state) };
  };

  return {
    snapshot,
    log: () => log.slice(),

    setBrief(text) {
      brief = String(text ?? "").trim();
      return snapshot();
    },

    abort() {
      aborted = true;
      status = "aborted";
      log.push({ phase: "aborted", brief });
      return snapshot();
    },

    reset() {
      status = "idle";
      aborted = false;
      frameId = null;
      lastObservation = null;
      return snapshot();
    },

    async observe(observation) {
      if (aborted) {
        return fail("aborted", "Human aborted desktop control.");
      }
      status = "running";
      const nextFrame =
        observation?.frameId ?? observation?.displayFrameId ?? `frame-${log.length + 1}`;
      frameId = nextFrame;
      lastObservation = {
        frameId,
        width: observation?.width ?? null,
        height: observation?.height ?? null,
        note: observation?.note ?? "screenshot",
      };
      log.push({ phase: "observe", frameId });
      return { ok: true, phase: "observe", ...snapshot() };
    },

    decide(decision) {
      if (aborted) {
        return fail("aborted", "Human aborted desktop control.");
      }
      status = "running";
      const resolved = resolveDecision(decision, brief);
      log.push({ phase: "decide", kind: resolved.kind });
      return { ok: true, phase: "decide", decision: resolved, ...snapshot() };
    },

    validate(action, extras = {}) {
      if (aborted) {
        return fail("aborted", "Human aborted desktop control.");
      }
      const alignment = intentAligned(brief, action);
      const gate = authorizeComputerAction({
        action,
        approved: extras.approved === true,
        computerControlEnabled: extras.computerControlEnabled !== false,
        hudVisible: extras.hudVisible === true || status === "running",
      });
      if (!alignment.aligned && extras.approved !== true) {
        status = "waiting_approval";
        log.push({ phase: "validate", ok: false, reason: alignment.reason });
        return { ok: false, phase: "validate", reason: alignment.reason, ...snapshot() };
      }
      if (!gate.allowed) {
        if (gate.reason === "needs_human") {
          status = "waiting_approval";
        }
        log.push({ phase: "validate", ok: false, reason: gate.reason });
        return { ok: false, phase: "validate", reason: gate.reason, classification: gate.classification, ...snapshot() };
      }
      log.push({ phase: "validate", ok: true });
      return { ok: true, phase: "validate", ...snapshot() };
    },

    async execute(action, extras = {}) {
      const validated = this.validate(action, extras);
      if (!validated.ok) {
        return validated;
      }
      status = "running";
      log.push({ phase: "execute", action: action.action ?? action.op });
      const result = await executor.run(action, { frameId, aborted });
      if (!result.ok) {
        return { ...result, phase: "execute", ...snapshot() };
      }
      return { ok: true, phase: "execute", result, ...snapshot() };
    },

    async reobserve(observation) {
      const seen = await this.observe(observation);
      if (seen.ok) {
        log.push({ phase: "reobserve", frameId });
      }
      return { ...seen, phase: seen.ok ? "reobserve" : seen.phase };
    },

    compileBrief(text) {
      return compileDesktopPhrase(text ?? brief);
    },
  };
}

function resolveDecision(decision, brief) {
  if (decision?.kind === "harness" || decision?.steps) {
    return { kind: "harness", ...parseHarnessProgram(decision) };
  }
  if (decision?.kind === "phrase" || typeof decision === "string") {
    return { kind: "phrase", ...compileDesktopPhrase(typeof decision === "string" ? decision : decision.text) };
  }
  if (decision?.action || decision?.kind === "computer.act") {
    return { kind: "computer.act", action: decision.action ?? decision };
  }
  if (brief) {
    return { kind: "phrase", ...compileDesktopPhrase(brief) };
  }
  return { kind: "none", ok: false, message: "No decision supplied." };
}

function fail(code, message) {
  return { ok: false, code, message };
}

function recordingAdapter() {
  const calls = [];
  return {
    calls,
    async execute(action) {
      calls.push(action);
      return { ok: true, executed: action.action, platform: "record" };
    },
  };
}
