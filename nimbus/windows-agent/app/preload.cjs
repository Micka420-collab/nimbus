const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nimbusAgent", {
  state: () => ipcRenderer.invoke("nimbus:state"),
  pair: (input) => ipcRenderer.invoke("nimbus:pair", input),
  connectParams: () => ipcRenderer.invoke("nimbus:connect-params"),
  voice: (op, extra) => ipcRenderer.invoke("nimbus:voice", op, extra),
  astra: (payload) => ipcRenderer.invoke("nimbus:astra", payload),
  invoke: (command, params) => ipcRenderer.invoke("nimbus:invoke", command, params),
  onState: (fn) => {
    ipcRenderer.on("nimbus:state", (_event, payload) => fn(payload));
  },
  onHotkey: (fn) => {
    ipcRenderer.on("nimbus:hotkey", (_event, payload) => fn(payload));
  },
  onVoiceChunk: (fn) => {
    ipcRenderer.on("nimbus:state", (_event, payload) => {
      if (payload?.speakChunk) {
        fn(payload.speakChunk);
      }
      if (payload?.speakAudio) {
        fn(payload.speakAudio);
      }
    });
  },
});

contextBridge.exposeInMainWorld("nimbusHud", {
  approve: () => ipcRenderer.invoke("nimbus:astra", { op: "approve" }),
  deny: () => ipcRenderer.invoke("nimbus:astra", { op: "deny" }),
  abort: () => ipcRenderer.invoke("nimbus:astra", { op: "abort" }),
  onState: (fn) => {
    ipcRenderer.on("nimbus:state", (_event, payload) => fn(payload));
  },
});
