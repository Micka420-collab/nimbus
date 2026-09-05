/**
 * Overlay trust scores gate medium computer.act after enough human approvals.
 * High-impact families never auto-run. Reads nimbus/src/trust.js (overlay, not OpenClaw).
 */

import { createTrust } from "../../src/trust.js";
import { authorizeComputerAction, classifyDesktopIntent } from "./approvals.js";

/**
 * @param {string} stateDir
 * @param {{ trust?: ReturnType<typeof createTrust> }} [options]
 */
export function createComputerTrustGate(stateDir, options = {}) {
  const trust = options.trust ?? createTrust(stateDir);

  return {
    trust,

    /**
     * @param {object} input
     */
    authorize(input = {}) {
      const action = input.action ?? {};
      const intent = classifyDesktopIntent(action);
      const family = trustFamily(intent);
      const score = trust.score(family);
      if (intent.confirm && input.approved !== true) {
        return {
          ...authorizeComputerAction(input),
          trust: score,
        };
      }
      if (intent.risk === "medium" && input.approved !== true && score.mayAutoRun) {
        return {
          ok: true,
          allowed: true,
          reason: "trust_auto",
          classification: intent,
          trust: score,
        };
      }
      return { ...authorizeComputerAction(input), trust: score };
    },

    record(action, verdict) {
      const family = trustFamily(classifyDesktopIntent(action));
      return trust.record(family, verdict);
    },
  };
}

function trustFamily(intent) {
  if (intent.family === "exploit" || intent.family === "camera" || intent.family === "screen.record") {
    return intent.family;
  }
  return intent.family === "computer" ? "computer" : intent.family;
}
