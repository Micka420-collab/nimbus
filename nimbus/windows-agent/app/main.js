import { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, desktopCapturer } from "electron";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LABELS,
  buildConnectParams,
  createComputerLoop,
  createGatewaySession,
  createSpeechFetch,
  createVoiceSession,
  createWindowsAdapter,
  dispatchNodeInvoke,
  loadAgentConfig,
  mergeAgentConfig,
  openWebSocketTransport,
  pairingFromConfig,
  runVoiceTurn,
  savePairingConfig,
  speechReadiness,
} from "../src/index.js";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const STATE = process.env.NIMBUS_STATE_DIR ?? join(homedir(), ".nimbus");
mkdirSync(STATE, { recursive: true });

const speechFetch = createSpeechFetch();
const voice = createVoiceSession();
const loop = createComputerLoop({
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
    width: 520,
    height: 680,
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
    width: 420,
    height: 72,
    frame: false,
    transparent: true,
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
  if (session?.status === "rejected" || session?.status === "offline") {
    return LABELS.tray.offline;
  }
  return loadAgentConfig(STATE).ok ? LABELS.tray.offline : LABELS.tray.pairing;
}

function refreshTray() {
  tray?.setToolTip(statusLabel());
  tray?.setContextMenu(trayMenu());
}

function abortControl() {
  loop.abort();
  hudWindow?.hide();
  globalShortcut.unregister("Escape");
  refreshTray();
  broadcast();
}

function showHud() {
  hudWindow?.showInactive();
  globalShortcut.register("Escape", () => abortControl());
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
  return {
    ok: true,
    format: "png",
    width: screen.thumbnail.getSize().width,
    height: screen.thumbnail.getSize().height,
    displayFrameId: `display-${Date.now()}`,
    imageBase64: png.toString("base64"),
  };
}

function currentState() {
  return {
    pairing: loadAgentConfig(STATE),
    session: gateway?.snapshot() ?? { status: "disconnected", connected: false },
    voice: voice.snapshot(),
    astra: loop.snapshot(),
    speech: speechReadiness(process.env),
    tray: statusLabel(),
  };
}

function broadcast(extra = {}) {
  const payload = { ...currentState(), ...extra };
  mainWindow?.webContents.send("nimbus:state", payload);
  hudWindow?.webContents.send("nimbus:state", payload);
}

function invokeHandlers() {
  return {
    "screen.snapshot": () => captureScreen(),
    "computer.act": async (body) => {
      if (loop.snapshot().aborted) {
        loop.reset();
      }
      showHud();
      await loop.observe({ note: "gateway-snapshot" });
      const ran = await loop.execute(body, { hudVisible: true, approved: body?.approved === true });
      refreshTray();
      broadcast();
      return ran;
    },
    "talk.ptt.start": () => voice.startPtt(),
    "talk.ptt.stop": () => voice.stopPtt(),
    "talk.ptt.cancel": () => voice.stopConversation(),
    "talk.speak": async (body) => {
      voice.agentReady(body?.text ?? "");
      const tts = await speechFetch({
        kind: "tts",
        config: speechReadiness(process.env).config,
        text: body?.text ?? "",
        language: "fr",
      });
      voice.speakEnd();
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
  gateway = createGatewaySession({
    openSocket: openWebSocketTransport,
    invokeHandlers: invokeHandlers(),
    sessionKey: "main",
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
  const session = ensureSession();
  const audio = extra.audioBase64 ? Buffer.from(extra.audioBase64, "base64") : null;
  const result = await runVoiceTurn({
    voice,
    audio,
    env: process.env,
    fetchImpl: speechFetch,
    sendChat: (text) => session.sendChat(text),
  });
  if (result.ok && result.audio) {
    broadcast({ speakAudio: Buffer.from(result.audio).toString("base64") });
  }
  return result;
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
    if (op === "ptt-start") {
      return voice.startPtt();
    }
    if (op === "ptt-stop") {
      const turn = await runVoiceFromPtt(extra);
      refreshTray();
      broadcast();
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
    if (payload?.op === "brief") {
      loop.reset();
      loop.setBrief(payload.text);
      showHud();
      await loop.observe({ note: "operator-brief" });
      const compiled = loop.compileBrief(payload.text);
      if (compiled.ok) {
        for (const step of compiled.steps) {
          const ran = await loop.execute(step, { hudVisible: true, approved: payload.approved === true });
          if (!ran.ok) {
            refreshTray();
            broadcast();
            return ran;
          }
        }
        await loop.reobserve({ note: "reobserve" });
      }
      refreshTray();
      broadcast();
      return { ok: compiled.ok, compiled, ...loop.snapshot() };
    }
    if (payload?.op === "approve") {
      const ran = await loop.execute(payload.action, { hudVisible: true, approved: true });
      refreshTray();
      broadcast();
      return ran;
    }
    return loop.snapshot();
  });
  ipcMain.handle("nimbus:invoke", async (_event, command, params) => {
    return dispatchNodeInvoke(command, params, invokeHandlers());
  });
}

app.whenReady().then(async () => {
  bindIpc();
  createMainWindow();
  createHudWindow();
  tray = new Tray(join(ROOT, "icon.png"));
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
