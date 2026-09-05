/**
 * Gateway WebSocket session for this node.
 * Transport is injectable so Linux tests never need Electron or a live socket.
 */

import { buildConnectParams, buildRequestFrame, dispatchNodeInvoke } from "./protocol.js";

const CONNECT_TIMEOUT_MS = 15_000;

export function createMemoryTransport() {
  const clientListeners = [];
  const serverListeners = [];
  let closed = false;
  const client = {
    send(data) {
      if (closed) {
        return;
      }
      for (const listener of serverListeners) {
        listener(data);
      }
    },
    onMessage(listener) {
      clientListeners.push(listener);
    },
    onClose(listener) {
      client._onClose = listener;
    },
    close() {
      if (closed) {
        return;
      }
      closed = true;
      client._onClose?.();
    },
  };
  const server = {
    send(frame) {
      if (closed) {
        return;
      }
      const data = typeof frame === "string" ? frame : JSON.stringify(frame);
      for (const listener of clientListeners) {
        listener(data);
      }
    },
    onMessage(listener) {
      serverListeners.push(listener);
    },
    received() {
      return serverListeners;
    },
  };
  return { client, server };
}

export function createGatewaySession(options = {}) {
  let status = "disconnected";
  let hello = null;
  let nextId = 1;
  let socket = null;
  const pending = new Map();
  const events = [];
  const invokeHandlers = options.invokeHandlers ?? {};
  const now = options.now ?? (() => Date.now());
  const requestTimeoutMs = options.requestTimeoutMs ?? CONNECT_TIMEOUT_MS;

  const snapshot = () => ({
    status,
    connected: status === "connected",
    hello,
    lastError: lastError(),
  });

  function lastError() {
    for (let i = events.length - 1; i >= 0; i -= 1) {
      if (events[i].ok === false) {
        return events[i];
      }
    }
    return null;
  }

  function setStatus(next, extra = {}) {
    status = next;
    events.push({ at: now(), status: next, ...extra });
    options.onStatus?.(snapshot());
    return snapshot();
  }

  function parseFrame(raw) {
    if (raw && typeof raw === "object") {
      return raw;
    }
    try {
      return JSON.parse(String(raw));
    } catch {
      return null;
    }
  }

  function handleFrame(raw) {
    const frame = parseFrame(raw);
    if (!frame || typeof frame !== "object") {
      return;
    }
    if (frame.type === "res" && typeof frame.id === "string") {
      const waiter = pending.get(frame.id);
      if (waiter) {
        pending.delete(frame.id);
        waiter.resolve(frame);
      }
      return;
    }
    if (frame.type === "hello-ok") {
      hello = frame;
      setStatus("connected", { ok: true });
      options.onHelloOk?.(hello);
      return;
    }
    if (frame.type !== "event" || typeof frame.event !== "string") {
      return;
    }
    if (frame.event === "node.invoke.request") {
      void handleInvoke(frame.payload ?? {});
      return;
    }
    if (frame.event === "node.invoke.cancel") {
      options.onCancel?.(frame.payload ?? {});
    }
    options.onEvent?.(frame);
  }

  async function handleInvoke(payload) {
    const id = payload.id;
    const nodeId = payload.nodeId ?? hello?.auth?.deviceId ?? "nimbus-windows-agent";
    const command = payload.command;
    let params = payload.params ?? {};
    if (typeof payload.paramsJSON === "string" && payload.paramsJSON) {
      try {
        params = JSON.parse(payload.paramsJSON);
      } catch {
        await request("node.invoke.result", {
          id,
          nodeId,
          ok: false,
          error: { code: "invalid_params", message: "paramsJSON is not JSON." },
        });
        return;
      }
    }
    const result = await dispatchNodeInvoke(command, params, invokeHandlers);
    const ok = result?.ok !== false;
    await request("node.invoke.result", {
      id,
      nodeId,
      ok,
      payload: result,
      error: ok ? undefined : { code: result?.code, message: result?.message },
    });
  }

  function request(method, params) {
    if (!socket) {
      return Promise.resolve({
        type: "res",
        id: "",
        ok: false,
        error: { code: "offline", message: "Not connected to the Gateway." },
      });
    }
    const id = `nimbus-${nextId}`;
    nextId += 1;
    const frame = buildRequestFrame(id, method, params);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        resolve({
          type: "res",
          id,
          ok: false,
          error: { code: "timeout", message: `Gateway request ${method} timed out.` },
        });
      }, requestTimeoutMs);
      pending.set(id, {
        resolve: (response) => {
          clearTimeout(timer);
          resolve(response);
        },
      });
      socket.send(JSON.stringify(frame));
    });
  }

  async function connect(pairing) {
    const record = pairingFromConfig(pairing);
    const built = buildConnectParams(record, {
      ...options.connectExtras,
      computerControlEnabled: record.computerControlEnabled,
    });
    if (!built.ok) {
      return setStatus("rejected", { ok: false, code: built.code, message: built.message });
    }
    setStatus("connecting");
    try {
      socket = await options.openSocket(built.gatewayUrl);
    } catch (error) {
      return setStatus("offline", {
        ok: false,
        code: "socket_failed",
        message: error?.message ?? "Could not open the Gateway socket.",
      });
    }
    socket.onMessage(handleFrame);
    socket.onClose?.(() => {
      if (status === "connected" || status === "connecting") {
        setStatus("offline", { ok: false, code: "socket_closed", message: "Gateway socket closed." });
      }
    });
    const response = await request("connect", built.params);
    if (!response.ok) {
      return setStatus("rejected", {
        ok: false,
        code: response.error?.code ?? "connect_rejected",
        message: response.error?.message ?? "Gateway rejected the node connect.",
      });
    }
    const payload = response.payload && typeof response.payload === "object" ? response.payload : {};
    if (payload.type === "hello-ok" || response.payload?.type === "hello-ok") {
      hello = payload.type === "hello-ok" ? payload : response.payload;
      options.onHelloOk?.(hello);
      return setStatus("connected", { ok: true });
    }
    return setStatus("rejected", {
      ok: false,
      code: "bad_hello",
      message: "Gateway did not return hello-ok.",
    });
  }

  function sendChat(message, extras = {}) {
    const text = String(message ?? "").trim();
    if (!text) {
      return Promise.resolve({
        ok: false,
        code: "empty_message",
        message: "Chat text required.",
      });
    }
    return request("chat.send", {
      sessionKey: extras.sessionKey ?? options.sessionKey ?? "main",
      message: text,
      idempotencyKey: extras.idempotencyKey ?? `nimbus-chat-${now()}`,
    });
  }

  function close() {
    socket?.close?.();
    socket = null;
    if (status !== "disconnected") {
      setStatus("disconnected");
    }
  }

  return {
    snapshot,
    events: () => events.slice(),
    connect,
    request,
    sendChat,
    close,
    handleFrame,
  };
}

export function pairingFromConfig(pairing) {
  if (pairing?.config && !pairing.gatewayUrl) {
    return { ok: true, ...pairing.config, auth: pairing.config.auth };
  }
  if (pairing?.ok || pairing?.gatewayUrl) {
    return pairing.ok ? pairing : { ok: true, ...pairing };
  }
  return { ok: false, code: "not_paired", message: "Pairing config required." };
}

export function openWebSocketTransport(url, WebSocketImpl = globalThis.WebSocket) {
  if (typeof WebSocketImpl !== "function") {
    return Promise.reject(new Error("WebSocket is not available in this runtime."));
  }
  return new Promise((resolve, reject) => {
    const ws = new WebSocketImpl(url);
    const transport = {
      send(data) {
        ws.send(data);
      },
      onMessage(listener) {
        ws.addEventListener("message", (event) => listener(event.data));
      },
      onClose(listener) {
        ws.addEventListener("close", () => listener());
      },
      close() {
        ws.close();
      },
    };
    ws.addEventListener("open", () => resolve(transport));
    ws.addEventListener("error", () => reject(new Error("Gateway WebSocket failed to open.")));
  });
}
