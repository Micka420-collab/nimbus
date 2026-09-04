import { voiceHud } from "./labels.js";

const PHASES = new Set(["muted", "listening", "thinking", "speaking"]);

/**
 * Consent-first voice conversation controller.
 * Mic never starts hidden. HUD always exposes phase + micLive.
 * Barge-in is only armed after explicit consent, and stays visible.
 */
export function createVoiceSession(options = {}) {
  const now = options.now ?? (() => Date.now());
  let phase = "muted";
  let consentGranted = false;
  let bargeInEnabled = options.bargeInEnabled !== false;
  let pendingTranscript = "";
  let room = options.room ?? null;
  const events = [];

  const snapshot = () => {
    const micLive = consentGranted && (phase === "listening" || (phase === "speaking" && bargeInEnabled));
    const state = {
      phase,
      consentGranted,
      bargeInEnabled,
      bargeInArmed: micLive && phase === "speaking",
      micLive,
      pendingTranscript,
      room,
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
      phase = "muted";
      pendingTranscript = "";
      return emit("consent_revoked");
    },

    mute() {
      phase = "muted";
      pendingTranscript = "";
      return emit("muted");
    },

    startListening() {
      if (!consentGranted) {
        return {
          ok: false,
          code: "consent_required",
          message: "Le micro ne s'allume qu'après un consentement visible.",
          ...snapshot(),
        };
      }
      phase = "listening";
      return { ok: true, ...emit("listening") };
    },

    hearPartial(text) {
      if (!consentGranted || (phase !== "listening" && phase !== "speaking")) {
        return { ok: false, code: "mic_inactive", ...snapshot() };
      }
      pendingTranscript = String(text ?? "");
      if (phase === "speaking" && bargeInEnabled && pendingTranscript.trim()) {
        phase = "listening";
        return { ok: true, bargedIn: true, ...emit("barge_in", { text: pendingTranscript }) };
      }
      return { ok: true, bargedIn: false, ...snapshot() };
    },

    hearFinal(text) {
      if (!consentGranted || (phase !== "listening" && phase !== "speaking")) {
        return { ok: false, code: "mic_inactive", ...snapshot() };
      }
      if (phase === "speaking" && bargeInEnabled) {
        emit("barge_in", { text: String(text ?? "") });
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
      if (consentGranted) {
        phase = "listening";
        return { ok: true, ...emit("listening") };
      }
      phase = "muted";
      return { ok: true, ...emit("muted") };
    },

    setBargeIn(enabled) {
      bargeInEnabled = Boolean(enabled);
      return snapshot();
    },

    /**
     * Room change never grants consent and never starts the mic.
     */
    setRoom(nextRoom) {
      room = nextRoom ? { ...nextRoom } : null;
      return emit("room", { room });
    },
  };
}

export function isVoicePhase(value) {
  return PHASES.has(value);
}
