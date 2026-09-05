import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveSpeechConfig, speechReadiness, synthesizeSpeech, transcribeAudio } from "../src/speech.js";
import { createSpeechFetch } from "../src/speech-transport.js";

test("OpenAI-compatible URLs come from base URL plus optional overrides", () => {
  const config = resolveSpeechConfig({
    OPENAI_API_KEY: "sk-test",
    OPENAI_BASE_URL: "https://relay.example/v1/",
  });
  assert.equal(config.sttUrl, "https://relay.example/v1/audio/transcriptions");
  assert.equal(config.ttsUrl, "https://relay.example/v1/audio/speech");
  const custom = resolveSpeechConfig({
    NIMBUS_STT_URL: "https://stt.local/transcribe",
    NIMBUS_TTS_URL: "https://tts.local/speak",
  });
  assert.equal(custom.sttReady, true);
  assert.equal(custom.ttsReady, true);
  assert.equal(custom.customStt, true);
});

test("readiness is French and refuse to invent a transcript without keys", async () => {
  const missing = speechReadiness({});
  assert.equal(missing.ok, false);
  assert.match(missing.message, /OPENAI_API_KEY/);
  const transcribed = await transcribeAudio({
    env: {},
    audio: Buffer.from("x"),
    fetchImpl: async () => ({ ok: true, text: "should not run" }),
  });
  assert.equal(transcribed.ok, false);
});

test("STT/TTS adapters post to the configured URLs and honor abort", async () => {
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push({ url, hasAuth: Boolean(init.headers?.Authorization), aborted: init.signal?.aborted });
    if (init.signal?.aborted) {
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    }
    if (String(url).includes("transcriptions")) {
      return {
        ok: true,
        json: async () => ({ text: "bonjour" }),
      };
    }
    return {
      ok: true,
      headers: { get: () => "audio/mpeg" },
      arrayBuffer: async () => Buffer.from("mp3"),
    };
  };
  const fetchImpl = createSpeechFetch(fetchFn);
  const env = { OPENAI_API_KEY: "sk-test", OPENAI_BASE_URL: "https://api.example/v1" };
  const stt = await transcribeAudio({
    env,
    audio: Buffer.from("wav"),
    fetchImpl,
  });
  assert.equal(stt.ok, true);
  assert.equal(stt.text, "bonjour");
  assert.equal(calls[0].url, "https://api.example/v1/audio/transcriptions");
  assert.equal(calls[0].hasAuth, true);

  const tts = await synthesizeSpeech({ env, text: "salut", fetchImpl });
  assert.equal(tts.ok, true);
  assert.equal(calls[1].url, "https://api.example/v1/audio/speech");

  const controller = new AbortController();
  controller.abort();
  const stopped = await synthesizeSpeech({
    env,
    text: "stop",
    fetchImpl,
    signal: controller.signal,
  });
  assert.equal(stopped.code, "aborted");
});

test("streaming TTS delivers chunks and cancels the reader on barge-in", async () => {
  const chunks = [Buffer.from("aa"), Buffer.from("bb")];
  let index = 0;
  let cancelled = false;
  const fetchFn = async () => ({
    ok: true,
    headers: { get: () => "audio/mpeg" },
    body: {
      getReader() {
        return {
          async read() {
            if (index >= chunks.length) {
              return { done: true, value: undefined };
            }
            const value = chunks[index];
            index += 1;
            return { done: false, value };
          },
          async cancel() {
            cancelled = true;
          },
        };
      },
    },
  });
  const received = [];
  const controller = new AbortController();
  const fetchImpl = createSpeechFetch(fetchFn);
  const pending = synthesizeSpeech({
    env: { OPENAI_API_KEY: "sk" },
    text: "stream",
    fetchImpl,
    signal: controller.signal,
    onChunk: (chunk) => {
      received.push(chunk);
      if (received.length === 1) {
        controller.abort();
      }
    },
  });
  const result = await pending;
  assert.equal(result.code, "aborted");
  assert.equal(cancelled, true);
  assert.equal(received.length, 1);
});
