import { voiceHud } from "./labels.js";

const PHASES = new Set(["muted", "listening", "thinking", "speaking"]);

/**
 * Consent-first PTT / conversation. Mic never starts hidden.
 * This is a Nimbus voice path that *orchestrates* the computer-use agent.
 * It does not claim native Astra audio (Astra is text+image).
 */
export function createVoiceSession(options = {}) {
  const now = options.now ?? (() => Date.now());
  let phase = "muted";
  let consentGranted = false;
  let conversation = false;
  let pendingTranscript = "";
  const events = [];

  const snapshot = () => {
    const micLive = consentGranted && (phase === "listening" || (conversation && phase === "speaking"));
    const state = {
      phase,
      consentGranted,
      conversation,
      micLive,
      pendingTranscript,
      astraAudio: false,
    };
    return { ...state, hud: voiceHud(state) };
  };

  const emit = (type, extra = {}) => {
    const event = { at: now(), type, ...snapshot(), ...extra };
    events.push(event);
    return event;
  };

  emit("init");

  return {
    snapshot,
    events: () => events.slice(),

    grantConsent() {
      consentGranted = true;
      return emit("consent_granted");
    },

    revokeConsent() {
      consentGranted = false;
      conversation = false;
      phase = "muted";
      pendingTranscript = "";
      return emit("consent_revoked");
    },

    startPtt() {
      if (!consentGranted) {
        return {
          ok: false,
          code: "consent_required",
          message: "Le micro ne s'allume qu'après un consentement visible.",
          ...snapshot(),
        };
      }
      phase = "listening";
      return { ok: true, ...emit("ptt_start") };
    },

    stopPtt(finalText = "") {
      if (!consentGranted || phase !== "listening") {
        return { ok: false, code: "mic_inactive", ...snapshot() };
      }
      pendingTranscript = String(finalText ?? "").trim();
      phase = pendingTranscript ? "thinking" : "muted";
      return { ok: true, ...emit(pendingTranscript ? "thinking" : "muted") };
    },

    startConversation() {
      if (!consentGranted) {
        return { ok: false, code: "consent_required", ...snapshot() };
      }
      conversation = true;
      phase = "listening";
      return { ok: true, ...emit("conversation_start") };
    },

    stopConversation() {
      conversation = false;
      phase = "muted";
      pendingTranscript = "";
      return { ok: true, ...emit("conversation_stop") };
    },

    hearFinal(text) {
      if (!consentGranted || phase !== "listening") {
        return { ok: false, code: "mic_inactive", ...snapshot() };
      }
      pendingTranscript = String(text ?? "").trim();
      phase = "thinking";
      return { ok: true, ...emit("thinking", { text: pendingTranscript }) };
    },

    agentReady(replyText = "") {
      if (phase !== "thinking") {
        return { ok: false, code: "not_thinking", ...snapshot() };
      }
      phase = "speaking";
      return { ok: true, replyText, ...emit("speaking") };
    },

    speakEnd() {
      if (phase !== "speaking") {
        return { ok: false, code: "not_speaking", ...snapshot() };
      }
      phase = conversation && consentGranted ? "listening" : "muted";
      return { ok: true, ...emit(phase) };
    },
  };
}

export function isVoicePhase(value) {
  return PHASES.has(value);
}
