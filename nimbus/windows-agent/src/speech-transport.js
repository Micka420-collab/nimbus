/**
 * OpenAI-compatible STT/TTS HTTP transport.
 * Authorization header only — never log keys.
 *
 * Failure modes: missing_transport, missing_audio, no_stt, no_tts, stt_failed, tts_failed, aborted.
 */

/**
 * @param {typeof fetch} [fetchFn]
 */
export function createSpeechFetch(fetchFn = globalThis.fetch) {
  return async (params = {}) => {
    const config = params.config ?? {};
    if (typeof fetchFn !== "function") {
      return { ok: false, code: "missing_transport", message: "fetch n'est pas disponible." };
    }
    if (params.signal?.aborted) {
      return { ok: false, code: "aborted", message: "Tour vocal interrompu." };
    }
    if (params.kind === "stt") {
      if (config.customStt) {
        return postCustomStt(fetchFn, config.sttUrl, params);
      }
      if (config.openaiKey) {
        return openaiTranscribe(fetchFn, config, params);
      }
      return { ok: false, code: "no_stt", message: "Aucun fournisseur STT configuré." };
    }
    if (params.kind === "tts") {
      if (config.customTts) {
        return postCustomTts(fetchFn, config.ttsUrl, params);
      }
      if (config.openaiKey) {
        return openaiSpeech(fetchFn, config, params);
      }
      if (config.talkSpeak) {
        return {
          ok: false,
          code: "use_talk_speak",
          message: "Pas de TTS local. Configure OPENAI_API_KEY ou NIMBUS_TTS_URL.",
        };
      }
      return { ok: false, code: "no_tts", message: "Aucun fournisseur TTS configuré." };
    }
    return { ok: false, code: "unknown_kind", message: "kind must be stt or tts." };
  };
}

/**
 * @param {unknown} payload
 * @returns {string}
 */
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

async function openaiTranscribe(fetchFn, config, params) {
  const audio = toBuffer(params.audio);
  if (!audio) {
    return { ok: false, code: "missing_audio", message: "Tampon audio requis." };
  }
  const boundary = `----nimbus${Date.now()}`;
  const model = config.sttModel ?? "whisper-1";
  const language = params.language ?? "fr";
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
      model,
      `--${boundary}`,
      'Content-Disposition: form-data; name="language"',
      "",
      language,
      `--${boundary}--`,
      "",
    ].join("\r\n"),
  );
  const body = Buffer.concat([prelude, audio, mid]);
  let response;
  try {
    response = await fetchFn(config.sttUrl ?? `${config.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openaiKey}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body,
      signal: params.signal,
    });
  } catch (error) {
    return fetchError("stt", error);
  }
  const mapped = await readJsonResult(response, "stt", (json) => {
    const text = String(json.text ?? "").trim();
    params.onPartial?.(text);
    return { ok: true, text, provider: "openai-compatible" };
  });
  return mapped;
}

async function openaiSpeech(fetchFn, config, params) {
  let response;
  try {
    response = await fetchFn(config.ttsUrl ?? `${config.baseUrl}/audio/speech`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.ttsModel ?? "gpt-4o-mini-tts",
        voice: config.ttsVoice ?? "alloy",
        input: params.text,
        format: "mp3",
      }),
      signal: params.signal,
    });
  } catch (error) {
    return fetchError("tts", error);
  }
  if (!response.ok) {
    return { ok: false, code: "tts_failed", message: `TTS HTTP ${response.status}.` };
  }
  const streamed = await readBinaryBody(response, params);
  if (!streamed.ok) {
    return streamed;
  }
  return { ok: true, audio: streamed.audio, chunks: streamed.chunks, provider: "openai-compatible" };
}

async function postCustomStt(fetchFn, url, params) {
  const audio = toBuffer(params.audio);
  let response;
  try {
    response = await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: audio,
      signal: params.signal,
    });
  } catch (error) {
    return fetchError("stt", error);
  }
  return readJsonResult(response, "stt", (json) => {
    const text = String(json.text ?? json.transcript ?? "").trim();
    params.onPartial?.(text);
    return { ok: true, text, provider: "custom" };
  });
}

async function postCustomTts(fetchFn, url, params) {
  let response;
  try {
    response = await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: params.text, language: params.language ?? "fr" }),
      signal: params.signal,
    });
  } catch (error) {
    return fetchError("tts", error);
  }
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
  const streamed = await readBinaryBody(response, params);
  if (!streamed.ok) {
    return streamed;
  }
  return { ok: true, audio: streamed.audio, chunks: streamed.chunks, provider: "custom" };
}

async function readBinaryBody(response, params) {
  if (response.body && typeof response.body.getReader === "function") {
    const reader = response.body.getReader();
    const chunks = [];
    while (true) {
      if (params.signal?.aborted) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, code: "aborted", message: "Tour vocal interrompu." };
      }
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const chunk = Buffer.from(value);
      chunks.push(chunk);
      params.onChunk?.(chunk);
    }
    return { ok: true, audio: Buffer.concat(chunks), chunks };
  }
  const audio = Buffer.from(await response.arrayBuffer());
  params.onChunk?.(audio);
  return { ok: true, audio, chunks: [audio] };
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

function fetchError(kind, error) {
  if (error?.name === "AbortError" || error?.code === "ABORT_ERR") {
    return { ok: false, code: "aborted", message: "Tour vocal interrompu." };
  }
  return {
    ok: false,
    code: `${kind}_failed`,
    message: `${kind.toUpperCase()} réseau indisponible.`,
  };
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
