/**
 * Speech provider config. Missing keys fail in French — no fake transcripts.
 *
 * Env:
 * - OPENAI_API_KEY or NIMBUS_OPENAI_API_KEY
 * - OPENAI_BASE_URL or NIMBUS_OPENAI_BASE_URL (default https://api.openai.com/v1)
 * - NIMBUS_STT_URL / NIMBUS_TTS_URL — full URL overrides
 * - NIMBUS_STT_MODEL / NIMBUS_TTS_MODEL / NIMBUS_TTS_VOICE
 * - NIMBUS_LIVE_SPEECH=1 — optional live smoke (never on by default)
 *
 * Failure modes: missing_speech_key, missing_transport, missing_audio, empty_text, aborted.
 */

export const DEFAULT_OPENAI_BASE = "https://api.openai.com/v1";

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveSpeechConfig(env = process.env) {
  const openaiKey = trimEnv(env.OPENAI_API_KEY ?? env.NIMBUS_OPENAI_API_KEY);
  const baseUrl = trimTrailingSlash(
    trimEnv(env.NIMBUS_OPENAI_BASE_URL ?? env.OPENAI_BASE_URL) || DEFAULT_OPENAI_BASE,
  );
  const sttUrl = trimEnv(env.NIMBUS_STT_URL) || `${baseUrl}/audio/transcriptions`;
  const ttsUrl = trimEnv(env.NIMBUS_TTS_URL) || `${baseUrl}/audio/speech`;
  const customStt = Boolean(trimEnv(env.NIMBUS_STT_URL));
  const customTts = Boolean(trimEnv(env.NIMBUS_TTS_URL));
  const talkSpeak = env.NIMBUS_TALK_SPEAK === "1" || env.NIMBUS_TALK_SPEAK === "true";
  return {
    openaiKey: openaiKey || null,
    baseUrl,
    sttUrl,
    ttsUrl,
    customStt,
    customTts,
    sttModel: trimEnv(env.NIMBUS_STT_MODEL) || "whisper-1",
    ttsModel: trimEnv(env.NIMBUS_TTS_MODEL) || "gpt-4o-mini-tts",
    ttsVoice: trimEnv(env.NIMBUS_TTS_VOICE) || "alloy",
    talkSpeak,
    liveSmoke: env.NIMBUS_LIVE_SPEECH === "1" || env.NIMBUS_LIVE_SPEECH === "true",
    sttReady: Boolean(openaiKey || customStt),
    ttsReady: Boolean(openaiKey || customTts || talkSpeak),
  };
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ ok: true, config: ReturnType<typeof resolveSpeechConfig> } | { ok: false, code: string, message: string, config: ReturnType<typeof resolveSpeechConfig> }}
 */
export function speechReadiness(env = process.env) {
  const config = resolveSpeechConfig(env);
  if (config.sttReady && config.ttsReady) {
    return { ok: true, config };
  }
  return {
    ok: false,
    code: "missing_speech_key",
    message:
      "Clé STT/TTS absente. Définis OPENAI_API_KEY, ou NIMBUS_STT_URL / NIMBUS_TTS_URL.",
    config,
  };
}

/**
 * @param {{ env?: NodeJS.ProcessEnv, audio?: unknown, language?: string, fetchImpl?: Function, signal?: AbortSignal }} params
 */
export async function transcribeAudio(params = {}) {
  const ready = speechReadiness(params.env ?? process.env);
  if (!ready.ok) {
    return ready;
  }
  if (params.signal?.aborted) {
    return aborted();
  }
  if (typeof params.fetchImpl !== "function") {
    return { ok: false, code: "missing_transport", message: "Transport STT absent." };
  }
  if (!params.audio) {
    return { ok: false, code: "missing_audio", message: "Tampon audio requis." };
  }
  const result = await params.fetchImpl({
    kind: "stt",
    config: ready.config,
    audio: params.audio,
    language: params.language ?? "fr",
    signal: params.signal,
    onPartial: params.onPartial,
  });
  if (params.signal?.aborted) {
    return aborted();
  }
  if (!result?.ok) {
    return {
      ok: false,
      code: result?.code ?? "stt_failed",
      message: result?.message ?? "La transcription a échoué. Vérifie la clé et réessaie.",
    };
  }
  return { ok: true, text: String(result.text ?? "").trim(), provider: result.provider ?? "stt" };
}

/**
 * @param {{ env?: NodeJS.ProcessEnv, text?: string, language?: string, fetchImpl?: Function, signal?: AbortSignal, onChunk?: Function }} params
 */
export async function synthesizeSpeech(params = {}) {
  const ready = speechReadiness(params.env ?? process.env);
  if (!ready.ok) {
    return ready;
  }
  if (params.signal?.aborted) {
    return aborted();
  }
  if (typeof params.fetchImpl !== "function") {
    return { ok: false, code: "missing_transport", message: "Transport TTS absent." };
  }
  const text = String(params.text ?? "").trim();
  if (!text) {
    return { ok: false, code: "empty_text", message: "Texte TTS requis." };
  }
  const result = await params.fetchImpl({
    kind: "tts",
    config: ready.config,
    text,
    language: params.language ?? "fr",
    signal: params.signal,
    onChunk: params.onChunk,
  });
  if (params.signal?.aborted) {
    return aborted();
  }
  if (!result?.ok) {
    return {
      ok: false,
      code: result?.code ?? "tts_failed",
      message: result?.message ?? "La synthèse vocale a échoué. Vérifie la clé et réessaie.",
    };
  }
  return { ok: true, audio: result.audio, provider: result.provider ?? "tts", chunks: result.chunks };
}

function aborted() {
  return { ok: false, code: "aborted", message: "Tour vocal interrompu." };
}

function trimEnv(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function trimTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
