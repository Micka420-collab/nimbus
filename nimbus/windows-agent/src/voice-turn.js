/**
 * PTT → STT → Gateway chat.send → TTS.
 * Orchestrates the computer-use agent; does not claim Astra audio.
 */

import { extractAssistantText } from "./speech-transport.js";
import { speechReadiness, synthesizeSpeech, transcribeAudio } from "./speech.js";

export async function runVoiceTurn(params = {}) {
  const voice = params.voice;
  const ready = speechReadiness(params.env ?? process.env);
  if (!ready.ok) {
    return ready;
  }
  const audio = params.audio;
  let transcript = String(params.transcript ?? "").trim();
  if (!transcript) {
    if (!audio) {
      voice?.stopPtt?.();
      return {
        ok: false,
        code: "missing_audio",
        message: "Aucun audio. Relâche le bouton après avoir parlé.",
      };
    }
    const stt = await transcribeAudio({
      env: params.env ?? process.env,
      audio,
      language: params.language ?? "fr",
      fetchImpl: params.fetchImpl,
    });
    if (!stt.ok) {
      voice?.stopPtt?.();
      return stt;
    }
    transcript = stt.text;
  }
  if (!transcript) {
    return { ok: false, code: "empty_transcript", message: "La transcription est vide. Réessaie." };
  }
  voice?.hearFinal?.(transcript);
  if (typeof params.sendChat !== "function") {
    return { ok: false, code: "offline", message: "Pas de session Gateway pour envoyer le tour vocal." };
  }
  const sent = await params.sendChat(transcript);
  if (!sent?.ok) {
    voice?.stopConversation?.();
    return {
      ok: false,
      code: sent?.error?.code ?? sent?.code ?? "chat_failed",
      message: sent?.error?.message ?? sent?.message ?? "Le Gateway n'a pas accepté le message.",
    };
  }
  const reply = extractAssistantText(sent.payload);
  if (!reply) {
    return {
      ok: false,
      code: "empty_reply",
      message: "Le Gateway n'a pas renvoyé de texte. Vérifie l'agent et réessaie.",
    };
  }
  voice?.agentReady?.(reply);
  const tts = await synthesizeSpeech({
    env: params.env ?? process.env,
    text: reply,
    language: params.language ?? "fr",
    fetchImpl: params.fetchImpl,
  });
  voice?.speakEnd?.();
  return {
    ok: true,
    transcript,
    reply,
    audio: tts.ok ? tts.audio : null,
    tts,
  };
}
