import { astraHud } from "./labels.js";
import { authorizeComputerAction, intentAligned } from "./approvals.js";
import { createActionExecutor } from "./computer-actions.js";
import { parseHarnessProgram } from "./harness.js";
import { compileDesktopPhrase, planWithGatewayModel } from "./planner.js";
import { expectsVisualChange, hashObservationBytes, observationChanged } from "./observation.js";

/**
 * Observe → decide → validate → execute → re-observe.
 * Hashes screenshots and retries once on stale UI.
 *
 * Failure modes: aborted, needs_human, stale_ui, hud_required, exploit_blocked.
 */
export function createComputerLoop(options = {}) {
  const executor = createActionExecutor(options.adapter ?? recordingAdapter());
  const trustGate = options.trustGate;
  let status = "idle";
  let brief = "";
  let frameId = null;
  let aborted = false;
  let lastObservation = null;
  let pendingAction = null;
  const log = [];

  const snapshot = () => {
    const state = { status, brief, frameId, aborted, lastObservation, pendingAction };
    return { ...state, hud: astraHud(state) };
  };

  function authorize(action, extras) {
    const alignment = intentAligned(brief, action);
    const gateInput = {
      action,
      approved: extras.approved === true,
      computerControlEnabled: extras.computerControlEnabled !== false,
      hudVisible: extras.hudVisible === true || status === "running" || status === "waiting_approval",
    };
    const gate = trustGate?.authorize(gateInput) ?? authorizeComputerAction(gateInput);
    return { alignment, gate };
  }

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
      pendingAction = null;
      log.push({ phase: "aborted", brief });
      return snapshot();
    },

    reset() {
      status = "idle";
      aborted = false;
      frameId = null;
      lastObservation = null;
      pendingAction = null;
      return snapshot();
    },

    async observe(observation) {
      if (aborted) {
        return fail("aborted", "Human aborted desktop control.");
      }
      status = "running";
      const bytes = observation?.imageBase64 ?? observation?.bytes;
      const hash = observation?.hash ?? hashObservationBytes(bytes);
      const nextFrame =
        observation?.frameId ?? observation?.displayFrameId ?? `frame-${log.length + 1}`;
      frameId = nextFrame;
      lastObservation = {
        frameId,
        hash,
        width: observation?.width ?? null,
        height: observation?.height ?? null,
        note: observation?.note ?? "screenshot",
      };
      log.push({ phase: "observe", frameId, hash });
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
      const { alignment, gate } = authorize(action, extras);
      if (!alignment.aligned && extras.approved !== true) {
        status = "waiting_approval";
        pendingAction = action;
        log.push({ phase: "validate", ok: false, reason: alignment.reason });
        return { ok: false, phase: "validate", reason: alignment.reason, pendingAction, ...snapshot() };
      }
      if (!gate.allowed) {
        if (gate.reason === "needs_human") {
          status = "waiting_approval";
          pendingAction = action;
        }
        log.push({ phase: "validate", ok: false, reason: gate.reason });
        return {
          ok: false,
          phase: "validate",
          reason: gate.reason,
          classification: gate.classification,
          trust: gate.trust,
          pendingAction,
          ...snapshot(),
        };
      }
      log.push({ phase: "validate", ok: true, reason: gate.reason });
      return { ok: true, phase: "validate", trust: gate.trust, ...snapshot() };
    },

    async execute(action, extras = {}) {
      const validated = this.validate(action, extras);
      if (!validated.ok) {
        return validated;
      }
      status = "running";
      pendingAction = null;
      log.push({ phase: "execute", action: action.action ?? action.op });
      const before = lastObservation;
      const result = await executor.run(action, {
        frameId,
        aborted,
        browser: extras.browser ?? options.browser,
      });
      if (!result.ok) {
        return { ...result, phase: "execute", ...snapshot() };
      }
      if (typeof extras.capture === "function" && expectsVisualChange(action)) {
        const seen = await extras.capture();
        await this.reobserve({ ...seen, bytes: seen.imageBase64 ?? seen.bytes });
        if (!observationChanged(before, lastObservation) && extras.retryStale !== false) {
          if (!extras._retried) {
            log.push({ phase: "stale_retry", hash: lastObservation?.hash });
            return this.execute(action, { ...extras, _retried: true });
          }
          return {
            ok: false,
            code: "stale_ui",
            message: "L'interface n'a pas changé après l'action. Contrôle interrompu.",
            phase: "execute",
            ...snapshot(),
          };
        }
      }
      if (extras.approved === true) {
        trustGate?.record(action, "approve");
      }
      return { ok: true, phase: "execute", result, ...snapshot() };
    },

    async approvePending(extras = {}) {
      if (!pendingAction) {
        return fail("no_pending", "Aucune étape en attente.");
      }
      return this.execute(pendingAction, { ...extras, approved: true, hudVisible: true });
    },

    denyPending() {
      pendingAction = null;
      status = "idle";
      trustGate?.record({ action: "computer" }, "reject");
      return snapshot();
    },

    async reobserve(observation) {
      const seen = await this.observe(observation);
      if (seen.ok) {
        log.push({ phase: "reobserve", frameId, hash: lastObservation?.hash });
      }
      return { ...seen, phase: seen.ok ? "reobserve" : seen.phase };
    },

    compileBrief(text) {
      return compileDesktopPhrase(text ?? brief);
    },

    async plan(text, extras = {}) {
      const local = compileDesktopPhrase(text ?? brief);
      if (local.ok) {
        return local;
      }
      if (typeof extras.sendChat === "function") {
        return planWithGatewayModel({
          brief: text ?? brief,
          sendChat: extras.sendChat,
          observation: lastObservation,
        });
      }
      return local;
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
