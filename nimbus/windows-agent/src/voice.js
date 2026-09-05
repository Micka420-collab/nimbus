import { voiceHud } from "./labels.js";

/** @typedef {"idle"|"muted"|"listening"|"thinking"|"speaking"} VoicePhase */

export const VOICE_PHASES = Object.freeze(["idle", "muted", "listening", "thinking", "speaking"]);

const PHASES = new Set(VOICE_PHASES);

/**
 * Consent-first PTT / conversation state machine.
 *
 * Failure modes:
 * - startPtt / startConversation without consent → `consent_required` (mic stays off).
 * - hearFinal / stopPtt when not listening → `mic_inactive`.
 * - bargeIn when not speaking → `not_speaking` (no phase change).
 * Never claims Astra audio. Mic is live only in `listening` (or conversation `speaking` for barge-in).
 *
 * @param {{ now?: () => number, settings?: VoiceSettings }} [options]
 */
export function createVoiceSession(options = {}) {
  const now = options.now ?? (() => Date.now());
  /** @type {VoicePhase} */
  let phase = "idle";
  let consentGranted = false;
  let conversation = false;
  let operatorMuted = false;
  let pendingTranscript = "";
  let lastReply = "";
  let settings = normalizeVoiceSettings(options.settings);
  const events = [];

  const snapshot = () => {
    const micLive =
      consentGranted &&
      !operatorMuted &&
      (phase === "listening" || (conversation && phase === "speaking"));
    const state = {
      phase,
      consentGranted,
      conversation,
      operatorMuted,
      micLive,
      pendingTranscript,
      lastReply,
      settings,
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

    /**
     * @param {Partial<VoiceSettings>} next
     * @returns {ReturnType<typeof snapshot>}
     */
    setSettings(next) {
      settings = normalizeVoiceSettings({ ...settings, ...next });
      return emit("settings");
    },

    grantConsent() {
      consentGranted = true;
      if (phase === "idle") {
        phase = "muted";
      }
      return emit("consent_granted");
    },

    revokeConsent() {
      consentGranted = false;
      conversation = false;
      operatorMuted = false;
      phase = "idle";
      pendingTranscript = "";
      lastReply = "";
      return emit("consent_revoked");
    },

    mute() {
      operatorMuted = true;
      if (phase === "listening" || phase === "speaking") {
        phase = conversation ? "muted" : "muted";
        conversation = false;
      }
      return { ok: true, ...emit("muted") };
    },

    unmute() {
      if (!consentGranted) {
        return { ok: false, code: "consent_required", message: FR.consent, ...snapshot() };
      }
      operatorMuted = false;
      return { ok: true, ...emit("unmuted") };
    },

    startPtt() {
      if (!consentGranted) {
        return { ok: false, code: "consent_required", message: FR.consent, ...snapshot() };
      }
      if (operatorMuted) {
        return { ok: false, code: "operator_muted", message: FR.muted, ...snapshot() };
      }
      phase = "listening";
      return { ok: true, ...emit("ptt_start") };
    },

    stopPtt(finalText = "") {
      if (!consentGranted || phase !== "listening") {
        return { ok: false, code: "mic_inactive", message: FR.inactive, ...snapshot() };
      }
      pendingTranscript = String(finalText ?? "").trim();
      phase = pendingTranscript ? "thinking" : conversation ? "listening" : "muted";
      return { ok: true, ...emit(pendingTranscript ? "thinking" : phase) };
    },

    startConversation() {
      if (!consentGranted) {
        return { ok: false, code: "consent_required", message: FR.consent, ...snapshot() };
      }
      if (operatorMuted) {
        return { ok: false, code: "operator_muted", message: FR.muted, ...snapshot() };
      }
      conversation = true;
      phase = "listening";
      return { ok: true, ...emit("conversation_start") };
    },

    stopConversation() {
      conversation = false;
      phase = consentGranted ? "muted" : "idle";
      pendingTranscript = "";
      return { ok: true, ...emit("conversation_stop") };
    },

    hearPartial(text) {
      if (!consentGranted || phase !== "listening") {
        return { ok: false, code: "mic_inactive", message: FR.inactive, ...snapshot() };
      }
      pendingTranscript = String(text ?? "").trim();
      return { ok: true, ...emit("partial") };
    },

    hearFinal(text) {
      if (!consentGranted || phase !== "listening") {
        return { ok: false, code: "mic_inactive", message: FR.inactive, ...snapshot() };
      }
      pendingTranscript = String(text ?? "").trim();
      phase = "thinking";
      return { ok: true, ...emit("thinking", { text: pendingTranscript }) };
    },

    agentReady(replyText = "") {
      if (phase !== "thinking") {
        return { ok: false, code: "not_thinking", message: FR.notThinking, ...snapshot() };
      }
      lastReply = String(replyText ?? "");
      phase = "speaking";
      return { ok: true, replyText: lastReply, ...emit("speaking") };
    },

    speakEnd() {
      if (phase !== "speaking") {
        return { ok: false, code: "not_speaking", message: FR.notSpeaking, ...snapshot() };
      }
      phase = conversation && consentGranted && !operatorMuted ? "listening" : consentGranted ? "muted" : "idle";
      return { ok: true, ...emit(phase) };
    },

    /**
     * Stop TTS immediately. Conversation returns to listening; PTT returns to muted.
     * @returns {{ ok: boolean, code?: string } & ReturnType<typeof snapshot>}
     */
    bargeIn() {
      if (phase !== "speaking") {
        return { ok: false, code: "not_speaking", message: FR.notSpeaking, ...snapshot() };
      }
      phase = conversation && consentGranted && !operatorMuted ? "listening" : "muted";
      return { ok: true, ...emit("barge_in") };
    },

    failClosed(code, message) {
      phase = consentGranted ? "muted" : "idle";
      conversation = conversation && consentGranted;
      return { ok: false, code, message, ...emit("fail_closed") };
    },
  };
}

/**
 * @param {unknown} value
 * @returns {value is VoicePhase}
 */
export function isVoicePhase(value) {
  return PHASES.has(value);
}

/**
 * @typedef {{ inputDeviceId: string, outputDeviceId: string, pttHotkey: string }} VoiceSettings
 */

/**
 * @param {Partial<VoiceSettings>} [raw]
 * @returns {VoiceSettings}
 */
export function normalizeVoiceSettings(raw = {}) {
  return {
    inputDeviceId: typeof raw.inputDeviceId === "string" ? raw.inputDeviceId : "",
    outputDeviceId: typeof raw.outputDeviceId === "string" ? raw.outputDeviceId : "",
    pttHotkey: typeof raw.pttHotkey === "string" && raw.pttHotkey.trim() ? raw.pttHotkey.trim() : "Alt+Space",
  };
}

const FR = Object.freeze({
  consent: "Le micro ne s'allume qu'après un consentement visible.",
  muted: "Micro coupé par l'opérateur.",
  inactive: "Le micro n'écoute pas.",
  notThinking: "Pas de tour en cours.",
  notSpeaking: "Aucune lecture à interrompre.",
});
