import { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, desktopCapturer, session } from "electron";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LABELS,
  buildConnectParams,
  createComputerLoop,
  createComputerTrustGate,
  createReconnectingSession,
  createSpeechFetch,
  createVoicePipeline,
  createVoiceSession,
  createWindowsAdapter,
  dispatchNodeInvoke,
  hashObservationBytes,
  loadAgentConfig,
  mergeAgentConfig,
  normalizeVoiceSettings,
  openWebSocketTransport,
  pairingFromConfig,
  savePairingConfig,
  speechReadiness,
} from "../src/index.js";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const STATE = process.env.NIMBUS_STATE_DIR ?? join(homedir(), ".nimbus");
mkdirSync(STATE, { recursive: true });

const speechFetch = createSpeechFetch();
const trustGate = createComputerTrustGate(STATE);
const voice = createVoiceSession({
  settings: normalizeVoiceSettings(loadAgentConfig(STATE).config?.voice),
});
const pipeline = createVoicePipeline({
  voice,
  fetchImpl: speechFetch,
  env: process.env,
  sendChat: (text) => ensureSession().sendChat(text),
  onTtsChunk: (chunk) => {
    broadcast({ speakChunk: Buffer.from(chunk).toString("base64") });
  },
});
const loop = createComputerLoop({
  trustGate,
  adapter: createWindowsAdapter({
    capture: captureScreen,
  }),
});

let mainWindow = null;
let hudWindow = null;
let tray = null;
let gateway = null;

function preloadPath() {
  return join(ROOT, "preload.cjs");
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 540,
    height: 760,
    title: LABELS.appName,
    show: true,
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(join(ROOT, "renderer", "index.html"));
}

function createHudWindow() {
  hudWindow = new BrowserWindow({
    width: 480,
    height: 140,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: true,
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  hudWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  hudWindow.loadFile(join(ROOT, "renderer", "hud.html"));
  hudWindow.hide();
}

function trayMenu() {
  const snap = loop.snapshot();
  return Menu.buildFromTemplate([
    { label: statusLabel(), enabled: false },
    { type: "separator" },
    { label: LABELS.tray.open, click: () => mainWindow?.show() },
    {
      label: LABELS.tray.approve,
      enabled: snap.status === "waiting_approval",
      click: () => approvePending(),
    },
    {
      label: LABELS.tray.deny,
      enabled: snap.status === "waiting_approval",
      click: () => {
        loop.denyPending();
        refreshTray();
        broadcast();
      },
    },
    {
      label: LABELS.tray.stop,
      enabled: snap.status === "running" || snap.status === "waiting_approval",
      click: () => abortControl(),
    },
    { type: "separator" },
    { label: LABELS.tray.quit, click: () => app.quit() },
  ]);
}

function statusLabel() {
  const astra = loop.snapshot();
  if (astra.status === "running") {
    return LABELS.tray.running;
  }
  if (astra.status === "waiting_approval") {
    return LABELS.tray.waiting;
  }
  const session = gateway?.snapshot();
  if (session?.status === "connected") {
    return LABELS.tray.idle;
  }
  if (session?.status === "connecting") {
    return LABELS.tray.pairing;
  }
  if (session?.status === "rejected") {
    return LABELS.pair.rejected;
  }
  if (session?.status === "offline") {
    return LABELS.pair.offline;
  }
  return loadAgentConfig(STATE).ok ? LABELS.pair.offline : LABELS.tray.pairing;
}

function refreshTray() {
  tray?.setToolTip(statusLabel());
  tray?.setContextMenu(trayMenu());
}

function abortControl() {
  loop.abort();
  hudWindow?.hide();
  refreshTray();
  broadcast();
}

function showHud() {
  const snap = loop.snapshot();
  if (snap.hud?.visible || snap.status === "waiting_approval" || snap.status === "running") {
    hudWindow?.showInactive();
    return;
  }
  hudWindow?.hide();
}

async function captureScreen() {
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: { width: 1280, height: 720 },
  });
  const screen = sources[0];
  if (!screen) {
    return { ok: false, code: "no_screen", message: "Aucun écran capturable." };
  }
  const png = screen.thumbnail.toPNG();
  const imageBase64 = png.toString("base64");
  return {
    ok: true,
    format: "png",
    width: screen.thumbnail.getSize().width,
    height: screen.thumbnail.getSize().height,
    displayFrameId: `display-${Date.now()}`,
    imageBase64,
    hash: hashObservationBytes(imageBase64),
  };
}

function currentState() {
  const loaded = loadAgentConfig(STATE);
  const sessionSnap = gateway?.snapshot() ?? { status: "disconnected", connected: false };
  const astra = loop.snapshot();
  const voiceSnap = voice.snapshot();
  return {
    pairing: loaded,
    session: sessionSnap,
    voice: voiceSnap,
    voiceSettings: voiceSnap.settings,
    astra,
    approvals: {
      pending: astra.pendingAction ? [astra.pendingAction] : [],
    },
    speech: speechReadiness(process.env),
    lastError: errorText(sessionSnap.lastError),
    tray: statusLabel(),
  };
}

function errorText(error) {
  if (!error) {
    return "";
  }
  if (typeof error === "string") {
    return error;
  }
  return typeof error.message === "string" ? error.message : "";
}

function broadcast(extra = {}) {
  const payload = { ...currentState(), ...extra };
  syncHud(payload.astra);
  mainWindow?.webContents.send("nimbus:state", payload);
  hudWindow?.webContents.send("nimbus:state", payload);
}

function syncHud(astra) {
  if (astra?.hud?.visible || astra?.status === "waiting_approval" || astra?.status === "running") {
    hudWindow?.showInactive();
    return;
  }
  if (astra?.status === "idle" || astra?.status === "aborted") {
    hudWindow?.hide();
  }
}

function invokeHandlers() {
  return {
    "screen.snapshot": () => captureScreen(),
    "computer.act": async (body) => {
      if (loop.snapshot().aborted) {
        loop.reset();
      }
      showHud();
      const shot = await captureScreen();
      await loop.observe(shot);
      const ran = await loop.execute(body, {
        hudVisible: true,
        approved: body?.approved === true,
        capture: captureScreen,
      });
      refreshTray();
      broadcast();
      return ran;
    },
    "talk.ptt.start": () => voice.startPtt(),
    "talk.ptt.stop": () => voice.stopPtt(),
    "talk.ptt.cancel": () => voice.stopConversation(),
    "talk.speak": async (body) => {
      if (voice.snapshot().phase !== "thinking") {
        voice.hearFinal(body?.text ?? "");
      }
      voice.agentReady(body?.text ?? "");
      const tts = await speechFetch({
        kind: "tts",
        config: speechReadiness(process.env).config,
        text: body?.text ?? "",
        language: "fr",
      });
      if (voice.snapshot().phase === "speaking") {
        voice.speakEnd();
      }
      if (tts.ok && tts.audio) {
        broadcast({ speakAudio: Buffer.from(tts.audio).toString("base64") });
      }
      return tts.ok ? tts : { ok: false, code: tts.code, message: tts.message };
    },
  };
}

function ensureSession() {
  if (gateway) {
    return gateway;
  }
  const loaded = loadAgentConfig(STATE);
  gateway = createReconnectingSession({
    openSocket: openWebSocketTransport,
    invokeHandlers: invokeHandlers(),
    sessionKey: "main",
    pairing: loaded.ok ? pairingFromConfig(loaded) : undefined,
    onStatus: () => {
      refreshTray();
      broadcast();
    },
    onHelloOk: (hello) => {
      const deviceToken = hello?.auth?.deviceToken;
      if (typeof deviceToken === "string" && deviceToken) {
        mergeAgentConfig(STATE, { auth: { deviceToken } });
      }
    },
    onCancel: () => abortControl(),
  });
  return gateway;
}

async function connectSaved() {
  const loaded = loadAgentConfig(STATE);
  if (!loaded.ok) {
    return loaded;
  }
  gateway?.close?.();
  gateway = null;
  return ensureSession().connect(pairingFromConfig(loaded));
}

async function runVoiceFromPtt(extra = {}) {
  const audio = extra.audioBase64 ? Buffer.from(extra.audioBase64, "base64") : null;
  return pipeline.runTurn({ audio });
}

async function approvePending() {
  showHud();
  const ran = await loop.approvePending({ hudVisible: true, capture: captureScreen });
  refreshTray();
  broadcast();
  return ran;
}

function bindHotkey() {
  globalShortcut.unregisterAll();
  globalShortcut.register("Escape", () => abortControl());
  const hotkey = voice.snapshot().settings.pttHotkey;
  if (hotkey) {
    globalShortcut.register(hotkey, () => {
      if (voice.snapshot().phase === "speaking") {
        pipeline.bargeIn();
        broadcast({ bargeIn: true });
        return;
      }
      mainWindow?.webContents.send("nimbus:hotkey", { kind: "ptt-toggle" });
    });
  }
}

function bindIpc() {
  ipcMain.handle("nimbus:state", async () => currentState());
  ipcMain.handle("nimbus:pair", async (_event, input) => {
    const saved = savePairingConfig(STATE, input);
    if (!saved.ok) {
      refreshTray();
      broadcast();
      return saved;
    }
    const connected = await connectSaved();
    refreshTray();
    broadcast();
    return {
      ...saved,
      session: gateway?.snapshot(),
      connected: connected.status === "connected",
      message:
        connected.status === "connected"
          ? LABELS.pair.connected
          : connected.status === "rejected"
            ? LABELS.pair.rejected
            : connected.message ?? LABELS.pair.saved,
    };
  });
  ipcMain.handle("nimbus:connect-params", async () => {
    const loaded = loadAgentConfig(STATE);
    if (!loaded.ok) {
      return loaded;
    }
    return buildConnectParams(pairingFromConfig(loaded));
  });
  ipcMain.handle("nimbus:voice", async (_event, op, extra = {}) => {
    if (op === "consent") {
      return voice.grantConsent();
    }
    if (op === "mute") {
      const result = extra.muted === false ? voice.unmute() : pipeline.mute();
      broadcast();
      return result;
    }
    if (op === "settings") {
      const settings = voice.setSettings(extra).settings;
      mergeAgentConfig(STATE, { voice: settings });
      bindHotkey();
      broadcast();
      return settings;
    }
    if (op === "barge-in") {
      const result = pipeline.bargeIn();
      broadcast();
      return result;
    }
    if (op === "ptt-start") {
      return voice.startPtt();
    }
    if (op === "ptt-stop") {
      const turn = await runVoiceFromPtt(extra);
      refreshTray();
      broadcast({ turn });
      return { ok: turn.ok, turn };
    }
    if (op === "conversation-start") {
      return voice.startConversation();
    }
    if (op === "conversation-stop") {
      return voice.stopConversation();
    }
    return voice.snapshot();
  });
  ipcMain.handle("nimbus:astra", async (_event, payload) => {
    if (payload?.op === "abort") {
      abortControl();
      return loop.snapshot();
    }
    if (payload?.op === "approve") {
      return approvePending();
    }
    if (payload?.op === "deny") {
      const snap = loop.denyPending();
      refreshTray();
      broadcast();
      return snap;
    }
    if (payload?.op === "brief") {
      loop.reset();
      loop.setBrief(payload.text);
      showHud();
      const shot = await captureScreen();
      await loop.observe(shot);
      const planned = await loop.plan(payload.text, {
        sendChat: (text) => ensureSession().sendChat(text),
      });
      if (planned.ok) {
        for (const step of planned.steps) {
          const ran = await loop.execute(step, {
            hudVisible: true,
            approved: payload.approved === true,
            capture: captureScreen,
          });
          if (!ran.ok) {
            refreshTray();
            broadcast();
            return ran;
          }
        }
        await loop.reobserve(await captureScreen());
      }
      refreshTray();
      broadcast();
      return { ok: planned.ok, compiled: planned, ...loop.snapshot() };
    }
    return loop.snapshot();
  });
  ipcMain.handle("nimbus:invoke", async (_event, command, params) => {
    return dispatchNodeInvoke(command, params, invokeHandlers());
  });
}

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(permission === "media" || permission === "display-capture");
  });
  bindIpc();
  createMainWindow();
  createHudWindow();
  tray = new Tray(join(ROOT, "icon.png"));
  bindHotkey();
  refreshTray();
  if (loadAgentConfig(STATE).ok) {
    await connectSaved();
    refreshTray();
    broadcast();
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  gateway?.close?.();
});
