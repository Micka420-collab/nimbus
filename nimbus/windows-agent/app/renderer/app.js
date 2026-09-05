const api = window.nimbusAgent;
const connectionLabel = document.getElementById("connection-label");
const voicePhase = document.getElementById("voice-phase");
const approvalLabel = document.getElementById("approval-label");
const errorLabel = document.getElementById("error-label");
const pairInput = document.getElementById("pair-input");
const pairBtn = document.getElementById("pair-btn");
const consentBtn = document.getElementById("consent-btn");
const muteBtn = document.getElementById("mute-btn");
const bargeBtn = document.getElementById("barge-btn");
const pttBtn = document.getElementById("ptt-btn");
const conversationBtn = document.getElementById("conversation-btn");
const micPill = document.getElementById("mic-pill");
const levelBar = document.getElementById("level-bar");
const inputDevice = document.getElementById("input-device");
const outputDevice = document.getElementById("output-device");
const hotkey = document.getElementById("hotkey");
const saveVoiceBtn = document.getElementById("save-voice-btn");
const briefInput = document.getElementById("brief-input");
const briefBtn = document.getElementById("brief-btn");

/** @type {MediaStream | null} */
let mediaStream = null;
/** @type {MediaRecorder | null} */
let recorder = null;
/** @type {Blob[]} */
let chunks = [];
/** @type {AudioContext | null} */
let audioContext = null;
/** @type {AnalyserNode | null} */
let analyser = null;
let meterRaf = 0;
let recording = false;
/** @type {HTMLAudioElement[]} */
const ttsQueue = [];
let ttsPlaying = false;

function showError(message) {
  if (!message) {
    errorLabel.hidden = true;
    errorLabel.textContent = "";
    return;
  }
  errorLabel.hidden = false;
  errorLabel.textContent = message;
}

function setPill(phase) {
  const map = {
    idle: ["idle", "Micro arrêté"],
    muted: ["muted", "Micro coupé"],
    listening: ["live", "Micro en écoute"],
    thinking: ["thinking", "Réflexion…"],
    speaking: ["speaking", "Lecture vocale"],
  };
  const [cls, text] = map[phase] ?? ["idle", "Micro arrêté"];
  micPill.className = `pill ${cls}`;
  micPill.textContent = text;
  voicePhase.textContent = `Voix : ${text}`;
}

function paintConnection(snapshot) {
  const sessionSnap = snapshot.session ?? {};
  if (sessionSnap.connected || sessionSnap.status === "connected") {
    connectionLabel.textContent = "Connecté au Gateway";
  } else if (sessionSnap.status === "connecting") {
    connectionLabel.textContent = "Reconnexion…";
  } else if (sessionSnap.status === "rejected") {
    connectionLabel.textContent = "Appairage refusé";
  } else {
    connectionLabel.textContent = "Hors ligne";
  }
  if (snapshot.voice?.phase) {
    setPill(snapshot.voice.phase);
  }
  muteBtn.textContent = snapshot.voice?.operatorMuted ? "Rétablir le micro" : "Couper le micro";
  conversationBtn.textContent = snapshot.voice?.conversation
    ? "Arrêter la conversation"
    : "Démarrer la conversation";
  const pending = snapshot.approvals?.pending ?? [];
  approvalLabel.textContent = pending.length
    ? `${pending.length} action(s) à approuver dans le plateau`
    : snapshot.astra?.status === "waiting_approval"
      ? "Étape à confirmer dans le plateau ou le bandeau"
      : "";
  const speech = snapshot.speech;
  if (snapshot.lastError) {
    showError(snapshot.lastError);
  } else if (speech && speech.ok === false && snapshot.voice?.consentGranted) {
    showError(speech.message);
  }
}

async function refreshDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return;
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  const inputs = devices.filter((device) => device.kind === "audioinput");
  const outputs = devices.filter((device) => device.kind === "audiooutput");
  fillSelect(inputDevice, inputs, "Micro par défaut");
  fillSelect(outputDevice, outputs, "Haut-parleurs par défaut");
}

function fillSelect(select, devices, fallbackLabel) {
  const current = select.value;
  select.replaceChildren();
  const def = document.createElement("option");
  def.value = "";
  def.textContent = fallbackLabel;
  select.append(def);
  for (const device of devices) {
    const option = document.createElement("option");
    option.value = device.deviceId;
    option.textContent = device.label || device.deviceId.slice(0, 8);
    select.append(option);
  }
  if ([...select.options].some((option) => option.value === current)) {
    select.value = current;
  }
}

function startMeter(stream) {
  stopMeter();
  audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);
  const data = new Uint8Array(analyser.frequencyBinCount);
  const tick = () => {
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const sample of data) {
      const normalized = (sample - 128) / 128;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / data.length);
    levelBar.style.width = `${Math.min(100, Math.round(rms * 280))}%`;
    meterRaf = requestAnimationFrame(tick);
  };
  tick();
}

function stopMeter() {
  cancelAnimationFrame(meterRaf);
  meterRaf = 0;
  levelBar.style.width = "0%";
  if (audioContext) {
    void audioContext.close();
    audioContext = null;
  }
  analyser = null;
}

async function ensureMic() {
  if (mediaStream) {
    return mediaStream;
  }
  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: inputDevice.value ? { deviceId: { exact: inputDevice.value } } : true,
    video: false,
  });
  startMeter(mediaStream);
  await refreshDevices();
  return mediaStream;
}

function startLocalRecord() {
  if (!mediaStream) {
    throw new Error("Micro non autorisé.");
  }
  chunks = [];
  recorder = new MediaRecorder(mediaStream);
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };
  recorder.start(200);
  recording = true;
}

function stopLocalRecord() {
  return new Promise((resolve) => {
    if (!recorder || recorder.state === "inactive") {
      recording = false;
      resolve(new Uint8Array());
      return;
    }
    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      const buffer = new Uint8Array(await blob.arrayBuffer());
      recording = false;
      resolve(buffer);
    };
    recorder.stop();
  });
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function decodeChunk(chunk) {
  if (chunk instanceof Uint8Array) {
    return chunk;
  }
  if (typeof chunk !== "string") {
    return new Uint8Array();
  }
  const binary = atob(chunk);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function enqueueTts(chunk) {
  const bytes = decodeChunk(chunk);
  if (bytes.length === 0) {
    return;
  }
  const blob = new Blob([bytes], { type: "audio/mpeg" });
  const audio = new Audio(URL.createObjectURL(blob));
  if (outputDevice.value && "setSinkId" in audio) {
    void audio.setSinkId(outputDevice.value);
  }
  ttsQueue.push(audio);
  void playNextTts();
}

async function playNextTts() {
  if (ttsPlaying) {
    return;
  }
  const next = ttsQueue.shift();
  if (!next) {
    return;
  }
  ttsPlaying = true;
  try {
    await next.play();
    await new Promise((resolve) => {
      next.onended = resolve;
      next.onerror = resolve;
    });
  } finally {
    URL.revokeObjectURL(next.src);
    ttsPlaying = false;
    void playNextTts();
  }
}

function stopTtsPlayback() {
  for (const audio of ttsQueue.splice(0)) {
    audio.pause();
    URL.revokeObjectURL(audio.src);
  }
  ttsPlaying = false;
}

async function persistVoice() {
  await api.voice("settings", {
    inputDeviceId: inputDevice.value || undefined,
    outputDeviceId: outputDevice.value || undefined,
    pttHotkey: hotkey.value.trim() || "Alt+Space",
  });
}

async function beginPtt() {
  showError("");
  await ensureMic();
  if (recording) {
    return;
  }
  startLocalRecord();
  const result = await api.voice("ptt-start");
  if (!result.ok) {
    showError(result.error ?? result.message);
    const leftover = await stopLocalRecord();
    void leftover;
  }
}

async function endPtt() {
  if (!recording) {
    return;
  }
  const pcm = await stopLocalRecord();
  const result = await api.voice("ptt-stop", { audioBase64: bytesToBase64(pcm) });
  if (!result.ok) {
    showError(result.error ?? result.turn?.message ?? result.message);
  }
}

pairBtn.addEventListener("click", async () => {
  showError("");
  const result = await api.pair(pairInput.value);
  if (!result.ok) {
    showError(result.error ?? result.message ?? "Jumelage refusé.");
  }
});

consentBtn.addEventListener("click", async () => {
  showError("");
  try {
    await ensureMic();
    const result = await api.voice("consent");
    if (result.ok === false) {
      showError(result.error ?? result.message);
      return;
    }
    pttBtn.disabled = false;
    conversationBtn.disabled = false;
    setPill("muted");
  } catch (error) {
    showError(error instanceof Error ? error.message : String(error));
  }
});

muteBtn.addEventListener("click", async () => {
  const snapshot = await api.state();
  if (snapshot.voice?.operatorMuted) {
    await api.voice("mute", { muted: false });
    return;
  }
  await api.voice("mute");
  stopTtsPlayback();
});

bargeBtn.addEventListener("click", async () => {
  stopTtsPlayback();
  await api.voice("barge-in");
});

pttBtn.addEventListener("pointerdown", async (event) => {
  event.preventDefault();
  pttBtn.setPointerCapture(event.pointerId);
  try {
    await beginPtt();
  } catch (error) {
    showError(error instanceof Error ? error.message : String(error));
  }
});

pttBtn.addEventListener("pointerup", async () => {
  try {
    await endPtt();
  } catch (error) {
    showError(error instanceof Error ? error.message : String(error));
  }
});

conversationBtn.addEventListener("click", async () => {
  const snapshot = await api.state();
  if (snapshot.voice?.conversation) {
    await api.voice("conversation-stop");
    return;
  }
  const result = await api.voice("conversation-start");
  if (result.ok === false) {
    showError(result.error ?? result.message);
  }
});

saveVoiceBtn.addEventListener("click", () => {
  void persistVoice();
});

briefBtn.addEventListener("click", async () => {
  showError("");
  const result = await api.astra({ op: "brief", text: briefInput.value });
  if (result.ok === false) {
    showError(result.error ?? result.message ?? "Contrôle refusé.");
  }
});

api.onState((snapshot) => {
  paintConnection(snapshot);
  if (snapshot.bargeIn) {
    stopTtsPlayback();
  }
});

api.onVoiceChunk((chunk) => {
  enqueueTts(chunk);
});

api.onHotkey(async (payload) => {
  if (payload?.kind !== "ptt-toggle") {
    return;
  }
  try {
    if (recording) {
      await endPtt();
      return;
    }
    await beginPtt();
  } catch (error) {
    showError(error instanceof Error ? error.message : String(error));
  }
});

void (async () => {
  const snapshot = await api.state();
  paintConnection(snapshot);
  if (snapshot.voiceSettings?.pttHotkey) {
    hotkey.value = snapshot.voiceSettings.pttHotkey;
  }
  if (snapshot.voiceSettings?.inputDeviceId) {
    await refreshDevices();
    inputDevice.value = snapshot.voiceSettings.inputDeviceId;
  }
  if (snapshot.voiceSettings?.outputDeviceId) {
    outputDevice.value = snapshot.voiceSettings.outputDeviceId;
  }
  await refreshDevices();
})();
