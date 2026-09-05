/**
 * Real STT/TTS HTTP transport. Keys stay in the Authorization header only.
 */

export function createSpeechFetch(fetchFn = globalThis.fetch) {
  return async (params = {}) => {
    const config = params.config ?? {};
    if (typeof fetchFn !== "function") {
      return { ok: false, code: "missing_transport", message: "fetch is not available." };
    }
    if (params.kind === "stt") {
      if (config.sttUrl) {
        return postCustomStt(fetchFn, config.sttUrl, params);
      }
      if (config.openaiKey) {
        return openaiTranscribe(fetchFn, config.openaiKey, params);
      }
      return { ok: false, code: "no_stt", message: "No STT provider configured." };
    }
    if (params.kind === "tts") {
      if (config.ttsUrl) {
        return postCustomTts(fetchFn, config.ttsUrl, params);
      }
      if (config.openaiKey) {
        return openaiSpeech(fetchFn, config.openaiKey, params);
      }
      if (config.talkSpeak) {
        return {
          ok: false,
          code: "use_talk_speak",
          message: "No local TTS. Configure OPENAI_API_KEY or NIMBUS_TTS_URL.",
        };
      }
      return { ok: false, code: "no_tts", message: "No TTS provider configured." };
    }
    return { ok: false, code: "unknown_kind", message: "kind must be stt or tts." };
  };
}

export function extractAssistantText(payload) {
  if (typeof payload === "string") {
    return payload.trim();
  }
  if (!payload || typeof payload !== "object") {
    return "";
  }
  for (const key of ["text", "message", "reply", "content"]) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  if (Array.isArray(payload.messages)) {
    const last = payload.messages.filter((item) => item?.role === "assistant").at(-1);
    if (last) {
      return extractAssistantText(last);
    }
  }
  for (const nested of [payload.result, payload.payload, payload.data]) {
    const text = extractAssistantText(nested);
    if (text) {
      return text;
    }
  }
  return "";
}

async function openaiTranscribe(fetchFn, apiKey, params) {
  const audio = toBuffer(params.audio);
  if (!audio) {
    return { ok: false, code: "missing_audio", message: "Audio buffer required." };
  }
  const boundary = `----nimbus${Date.now()}`;
  const prelude = Buffer.from(
    [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="ptt.webm"',
      "Content-Type: audio/webm",
      "",
      "",
    ].join("\r\n"),
  );
  const mid = Buffer.from(
    [
      "",
      `--${boundary}`,
      'Content-Disposition: form-data; name="model"',
      "",
      "whisper-1",
      `--${boundary}`,
      'Content-Disposition: form-data; name="language"',
      "",
      params.language ?? "fr",
      `--${boundary}--`,
      "",
    ].join("\r\n"),
  );
  const body = Buffer.concat([prelude, audio, mid]);
  const response = await fetchFn("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });
  return readJsonResult(response, "stt", (json) => ({
    ok: true,
    text: String(json.text ?? "").trim(),
    provider: "openai",
  }));
}

async function openaiSpeech(fetchFn, apiKey, params) {
  const response = await fetchFn("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: params.text,
      format: "mp3",
    }),
  });
  if (!response.ok) {
    return { ok: false, code: "tts_failed", message: `TTS HTTP ${response.status}.` };
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return { ok: true, audio: buffer, provider: "openai" };
}

async function postCustomStt(fetchFn, url, params) {
  const audio = toBuffer(params.audio);
  const response = await fetchFn(url, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: audio,
  });
  return readJsonResult(response, "stt", (json) => ({
    ok: true,
    text: String(json.text ?? json.transcript ?? "").trim(),
    provider: "custom",
  }));
}

async function postCustomTts(fetchFn, url, params) {
  const response = await fetchFn(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: params.text, language: params.language ?? "fr" }),
  });
  if (!response.ok) {
    return { ok: false, code: "tts_failed", message: `TTS HTTP ${response.status}.` };
  }
  const type = response.headers?.get?.("content-type") ?? "";
  if (type.includes("application/json")) {
    return readJsonResult(response, "tts", (json) => ({
      ok: true,
      audio: json.audio,
      provider: "custom",
    }));
  }
  return { ok: true, audio: Buffer.from(await response.arrayBuffer()), provider: "custom" };
}

async function readJsonResult(response, kind, map) {
  if (!response.ok) {
    return {
      ok: false,
      code: `${kind}_failed`,
      message: `${kind.toUpperCase()} HTTP ${response.status}.`,
    };
  }
  const json = await response.json();
  return map(json);
}

function toBuffer(audio) {
  if (Buffer.isBuffer(audio)) {
    return audio;
  }
  if (audio instanceof Uint8Array) {
    return Buffer.from(audio);
  }
  if (typeof audio === "string" && audio) {
    return Buffer.from(audio, "base64");
  }
  return null;
}
