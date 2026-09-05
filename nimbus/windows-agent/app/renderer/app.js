const $ = (id) => document.getElementById(id);

let mediaStream = null;
let recorder = null;
let chunks = [];

function sessionLabel(state) {
  const status = state.session?.status;
  if (status === "connected") {
    return "Connecté au Gateway.";
  }
  if (status === "connecting") {
    return "Connexion au Gateway…";
  }
  if (status === "rejected") {
    return "Le Gateway a refusé l'appairage. Approuve le nœud puis réessaie.";
  }
  if (status === "offline") {
    return "Hors ligne — le socket Gateway est fermé.";
  }
  return state.pairing?.ok ? "Configuration enregistrée. Hors ligne." : "Pas encore appairé.";
}

function render(state) {
  const pair = state.pairing;
  const gatewayLine = pair?.ok ? `Gateway : ${pair.config.gatewayUrl}` : "Pas encore appairé.";
  $("pairStatus").textContent = `${gatewayLine} — ${sessionLabel(state)}`;
  $("trayStatus").textContent = state.tray ?? "";
  const voice = state.voice;
  $("mic").dataset.live = voice?.micLive ? "on" : "off";
  $("mic").textContent = voice?.hud?.micLabel ?? "Micro inactif";
  $("voiceStatus").textContent = voice?.hud?.phaseLabel ?? "Micro coupé";
  if (state.speech && state.speech.ok === false) {
    $("voiceStatus").textContent = state.speech.message;
  }
  if (state.turn?.ok) {
    $("voiceStatus").textContent = `Toi : ${state.turn.transcript} — Nimbus : ${state.turn.reply}`;
  } else if (state.turn && state.turn.ok === false) {
    $("voiceStatus").textContent = state.turn.message ?? "Tour vocal échoué.";
  }
  const astra = state.astra;
  $("astraStatus").textContent = astra?.hud?.statusLabel ?? "Inactif";
  if (astra?.brief) {
    $("astraBrief").textContent = `Objectif : ${astra.brief}`;
  }
  if (state.speakAudio) {
    playAudio(state.speakAudio);
  }
}

function playAudio(base64) {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const blob = new Blob([bytes], { type: "audio/mpeg" });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.onended = () => URL.revokeObjectURL(url);
  audio.play().catch(() => {
    $("voiceStatus").textContent = "Réponse reçue, lecture audio refusée par le système.";
  });
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function unlockMic() {
  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaStream.getTracks().forEach((track) => {
    track.stop();
  });
  mediaStream = null;
}

async function startRecording() {
  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  chunks = [];
  recorder = new MediaRecorder(mediaStream);
  recorder.ondataavailable = (event) => {
    if (event.data.size) {
      chunks.push(event.data);
    }
  };
  recorder.start();
}

function stopRecording() {
  return new Promise((resolve) => {
    if (!recorder) {
      resolve(null);
      return;
    }
    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      mediaStream?.getTracks().forEach((track) => track.stop());
      mediaStream = null;
      recorder = null;
      resolve(toBase64(await blob.arrayBuffer()));
    };
    recorder.stop();
  });
}

async function refresh() {
  render(await window.nimbusAgent.state());
}

$("pair").addEventListener("click", async () => {
  const result = await window.nimbusAgent.pair({
    gatewayUrl: $("url").value,
    token: $("token").value,
    setupCode: $("token").value.startsWith("oc-pair://") ? $("token").value : "",
  });
  $("pairStatus").textContent = result.message ?? (result.ok ? "Configuration enregistrée." : result.message);
  await refresh();
});

$("consent").addEventListener("click", async () => {
  try {
    await unlockMic();
    await window.nimbusAgent.voice("consent");
  } catch {
    $("voiceStatus").textContent = "Le système a refusé le micro.";
    return;
  }
  await refresh();
});

$("ptt").addEventListener("mousedown", async () => {
  const started = await window.nimbusAgent.voice("ptt-start");
  if (!started.ok) {
    $("voiceStatus").textContent = started.message ?? "Consentement requis.";
    return;
  }
  try {
    await startRecording();
  } catch {
    $("voiceStatus").textContent = "Impossible d'ouvrir le micro.";
  }
  await refresh();
});

$("ptt").addEventListener("mouseup", async () => {
  const audioBase64 = await stopRecording();
  const result = await window.nimbusAgent.voice("ptt-stop", { audioBase64 });
  render({ ...(await window.nimbusAgent.state()), turn: result.turn });
});

$("conversation").addEventListener("click", async () => {
  const state = await window.nimbusAgent.state();
  if (state.voice?.conversation) {
    await window.nimbusAgent.voice("conversation-stop");
  } else {
    await window.nimbusAgent.voice("conversation-start");
  }
  await refresh();
});

$("run").addEventListener("click", async () => {
  const result = await window.nimbusAgent.astra({ op: "brief", text: $("brief").value });
  $("astraStatus").textContent = result.hud?.statusLabel ?? result.message ?? "En cours";
  if (result.reason === "needs_human" || result.reason === "impact_not_in_brief") {
    $("astraStatus").textContent = "En attente d'approbation — confirme cette étape.";
  }
  await refresh();
});

$("approve").addEventListener("click", async () => {
  const state = await window.nimbusAgent.state();
  await window.nimbusAgent.astra({
    op: "brief",
    text: $("brief").value || state.astra?.brief,
    approved: true,
  });
  await refresh();
});

$("abort").addEventListener("click", async () => {
  await window.nimbusAgent.astra({ op: "abort" });
  await refresh();
});

window.nimbusAgent.onState(render);
refresh();
