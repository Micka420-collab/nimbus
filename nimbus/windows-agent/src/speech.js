/**
 * Real STT/TTS wiring. Missing keys fail visibly — no fake transcripts.
 */

export function resolveSpeechConfig(env = process.env) {
  const openaiKey = trimEnv(env.OPENAI_API_KEY ?? env.NIMBUS_OPENAI_API_KEY);
  const sttUrl = trimEnv(env.NIMBUS_STT_URL);
  const ttsUrl = trimEnv(env.NIMBUS_TTS_URL);
  const talkSpeak = env.NIMBUS_TALK_SPEAK === "1" || env.NIMBUS_TALK_SPEAK === "true";
  return {
    openaiKey: openaiKey || null,
    sttUrl,
    ttsUrl,
    talkSpeak,
    sttReady: Boolean(openaiKey || sttUrl),
    ttsReady: Boolean(openaiKey || ttsUrl || talkSpeak),
  };
}

export function speechReadiness(env = process.env) {
  const config = resolveSpeechConfig(env);
  if (config.sttReady && config.ttsReady) {
    return { ok: true, config };
  }
  return {
    ok: false,
    code: "missing_speech_key",
    message:
      "STT/TTS keys missing. Set OPENAI_API_KEY, or NIMBUS_STT_URL / NIMBUS_TTS_URL, or NIMBUS_TALK_SPEAK=1 after pairing.",
    config,
  };
}

export async function transcribeAudio(params = {}) {
  const ready = speechReadiness(params.env ?? process.env);
  if (!ready.ok) {
    return ready;
  }
  if (typeof params.fetchImpl !== "function") {
    return { ok: false, code: "missing_transport", message: "STT transport not provided." };
  }
  if (!params.audio) {
    return { ok: false, code: "missing_audio", message: "Audio buffer required." };
  }
  const result = await params.fetchImpl({
    kind: "stt",
    config: ready.config,
    audio: params.audio,
    language: params.language ?? "fr",
  });
  if (!result?.ok) {
    return {
      ok: false,
      code: result?.code ?? "stt_failed",
      message: result?.message ?? "Speech-to-text failed. Check the provider key and retry.",
    };
  }
  return { ok: true, text: String(result.text ?? "").trim(), provider: result.provider ?? "stt" };
}

export async function synthesizeSpeech(params = {}) {
  const ready = speechReadiness(params.env ?? process.env);
  if (!ready.ok) {
    return ready;
  }
  if (typeof params.fetchImpl !== "function") {
    return { ok: false, code: "missing_transport", message: "TTS transport not provided." };
  }
  const text = String(params.text ?? "").trim();
  if (!text) {
    return { ok: false, code: "empty_text", message: "TTS text required." };
  }
  const result = await params.fetchImpl({
    kind: "tts",
    config: ready.config,
    text,
    language: params.language ?? "fr",
  });
  if (!result?.ok) {
    return {
      ok: false,
      code: result?.code ?? "tts_failed",
      message: result?.message ?? "Text-to-speech failed. Check the provider key and retry.",
    };
  }
  return { ok: true, audio: result.audio, provider: result.provider ?? "tts" };
}

function trimEnv(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}
