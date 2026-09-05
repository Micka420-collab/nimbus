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
});
