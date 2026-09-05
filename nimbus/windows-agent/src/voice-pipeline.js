/**
 * STT → Gateway chat.send → streaming TTS, with barge-in.
 * Orchestrates the same computer-use agent. Does not claim Astra audio.
 *
 * Failure modes: missing_speech_key, missing_audio, empty_transcript, offline,
 * chat_failed, empty_reply, aborted. TTS failure still returns the reply text.
 */

import { extractAssistantText } from "./speech-transport.js";
import { speechReadiness, synthesizeSpeech, transcribeAudio } from "./speech.js";

/**
 * @param {{
 *   voice: import("./voice.js").createVoiceSession extends Function ? ReturnType<import("./voice.js").createVoiceSession> : any,
 *   fetchImpl: Function,
 *   sendChat: (text: string) => Promise<any>,
 *   env?: NodeJS.ProcessEnv,
 *   language?: string,
 * }} options
 */
export function createVoicePipeline(options) {
  const voice = options.voice;
  const env = options.env ?? process.env;
  const language = options.language ?? "fr";
  let turnAbort = null;

  function abortTurn() {
    turnAbort?.abort();
    turnAbort = null;
  }

  return {
    voice,

    /**
     * Interrupt TTS immediately. Conversation returns to listening.
     */
    bargeIn() {
      abortTurn();
      return voice.bargeIn();
    },

    mute() {
      abortTurn();
      return voice.mute();
    },

    /**
     * @param {{ audio?: Buffer, transcript?: string }} params
     */
    async runTurn(params = {}) {
      const ready = speechReadiness(env);
      if (!ready.ok) {
        return voice.failClosed(ready.code, ready.message);
      }
      turnAbort = new AbortController();
      const signal = turnAbort.signal;

      let transcript = String(params.transcript ?? "").trim();
      if (!transcript) {
        if (!params.audio) {
          abortTurn();
          return voice.failClosed("missing_audio", "Aucun audio. Relâche le bouton après avoir parlé.");
        }
        const stt = await transcribeAudio({
          env,
          audio: params.audio,
          language,
          fetchImpl: options.fetchImpl,
          signal,
          onPartial: (text) => voice.hearPartial(text),
        });
        if (!stt.ok) {
          abortTurn();
          return voice.failClosed(stt.code, stt.message);
        }
        transcript = stt.text;
      }
      if (!transcript) {
        abortTurn();
        return voice.failClosed("empty_transcript", "La transcription est vide. Réessaie.");
      }
      if (voice.snapshot().phase === "listening") {
        voice.hearFinal(transcript);
      } else if (voice.snapshot().phase !== "thinking") {
        voice.startPtt();
        voice.hearFinal(transcript);
      }

      if (typeof options.sendChat !== "function") {
        abortTurn();
        return voice.failClosed("offline", "Pas de session Gateway pour envoyer le tour vocal.");
      }
      const sent = await options.sendChat(transcript);
      if (signal.aborted) {
        return voice.failClosed("aborted", "Tour vocal interrompu.");
      }
      if (!sent?.ok) {
        abortTurn();
        const code = sent?.error?.code ?? sent?.code ?? "chat_failed";
        return voice.failClosed(code, chatFailureMessage(code, sent));
      }
      const reply = extractAssistantText(sent.payload);
      if (!reply) {
        abortTurn();
        return voice.failClosed(
          "empty_reply",
          "Le Gateway n'a pas renvoyé de texte. Vérifie l'agent et réessaie.",
        );
      }
      voice.agentReady(reply);
      const chunks = [];
      const tts = await synthesizeSpeech({
        env,
        text: reply,
        language,
        fetchImpl: options.fetchImpl,
        signal,
        onChunk: (chunk) => {
          chunks.push(chunk);
          options.onTtsChunk?.(chunk);
        },
      });
      if (signal.aborted || tts.code === "aborted") {
        const barged = voice.snapshot().phase === "speaking" ? voice.bargeIn() : voice.snapshot();
        return { ok: false, code: "aborted", message: "Tour vocal interrompu.", transcript, reply, ...barged };
      }
      if (voice.snapshot().phase === "speaking") {
        voice.speakEnd();
      }
      abortTurn();
      return {
        ok: true,
        transcript,
        reply,
        audio: tts.ok ? tts.audio : null,
        tts,
        chunks,
      };
    },
  };
}

/**
 * Compatibility wrapper used by Electron and existing tests.
 * @param {object} params
 */
function chatFailureMessage(code, sent) {
  if (
    code === "not_authorized" ||
    code === "forbidden" ||
    code === "scope_denied" ||
    code === "missing_scope"
  ) {
    return "Le jeton nœud n'autorise pas chat.send. Réappaire avec un jeton opérateur.";
  }
  return sent?.error?.message ?? sent?.message ?? "Le Gateway n'a pas accepté le message.";
}

export async function runVoiceTurn(params = {}) {
  const pipeline = createVoicePipeline({
    voice: params.voice,
    fetchImpl: params.fetchImpl,
    sendChat: params.sendChat,
    env: params.env,
    language: params.language,
    onTtsChunk: params.onTtsChunk,
  });
  return pipeline.runTurn({ audio: params.audio, transcript: params.transcript });
}
