#!/usr/bin/env node
/**
 * Optional live STT/TTS smoke. Off by default.
 * NIMBUS_LIVE_SPEECH=1 OPENAI_API_KEY=... node nimbus/windows-agent/scripts/speech-live.mjs
 * Never prints the key.
 */
import { createSpeechFetch } from "../src/speech-transport.js";
import { speechReadiness, synthesizeSpeech, transcribeAudio } from "../src/speech.js";

if (process.env.NIMBUS_LIVE_SPEECH !== "1" && process.env.NIMBUS_LIVE_SPEECH !== "true") {
  process.stdout.write("skip: set NIMBUS_LIVE_SPEECH=1 to hit a real STT/TTS endpoint\n");
  process.exit(0);
}

const ready = speechReadiness(process.env);
if (!ready.ok) {
  process.stderr.write(`${ready.message}\n`);
  process.exit(2);
}

const fetchImpl = createSpeechFetch();
const tts = await synthesizeSpeech({
  env: process.env,
  text: "Nimbus. Chemin vocal, pas d'audio Astra.",
  fetchImpl,
});
if (!tts.ok) {
  process.stderr.write(`${tts.message}\n`);
  process.exit(1);
}
const stt = await transcribeAudio({
  env: process.env,
  audio: tts.audio,
  fetchImpl,
});
if (!stt.ok) {
  process.stderr.write(`${stt.message}\n`);
  process.exit(1);
}
process.stdout.write(`ok provider=${stt.provider} chars=${stt.text.length}\n`);
