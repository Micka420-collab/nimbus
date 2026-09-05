const SETUP_PREFIX = "oc-pair://";
const SETUP_CODE_RE = /^[A-Za-z0-9_-]+$/u;

export function normalizeGatewayUrl(raw) {
  if (typeof raw !== "string") {
    return { ok: false, code: "invalid_url", message: "Gateway URL required." };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, code: "invalid_url", message: "Gateway URL required." };
  }
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, code: "invalid_url", message: "Gateway URL is not a valid URL." };
  }
  if (parsed.protocol === "http:") {
    parsed.protocol = "ws:";
  } else if (parsed.protocol === "https:") {
    parsed.protocol = "wss:";
  }
  if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
    return { ok: false, code: "invalid_url", message: "Gateway URL must be http(s) or ws(s)." };
  }
  if (!parsed.hostname) {
    return { ok: false, code: "invalid_url", message: "Gateway URL host required." };
  }
  return { ok: true, url: parsed.toString() };
}

export function decodeSetupCode(input, options = {}) {
  if (typeof input !== "string" || !input.trim()) {
    return { ok: false, code: "invalid_setup_code", message: "Setup code required." };
  }
  const trimmed = input.trim();
  const encoded = trimmed.toLowerCase().startsWith(SETUP_PREFIX)
    ? trimmed.slice(SETUP_PREFIX.length)
    : trimmed;
  if (!SETUP_CODE_RE.test(encoded)) {
    return { ok: false, code: "invalid_setup_code", message: "Setup code is not valid base64url." };
  }
  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return { ok: false, code: "invalid_setup_code", message: "Setup code payload is not JSON." };
  }
  if (decoded === null || typeof decoded !== "object" || Array.isArray(decoded)) {
    return { ok: false, code: "invalid_setup_code", message: "Setup code payload must be an object." };
  }
  const url = typeof decoded.url === "string" ? decoded.url : "";
  const bootstrapToken = typeof decoded.bootstrapToken === "string" ? decoded.bootstrapToken : "";
  if (!url || !bootstrapToken) {
    return { ok: false, code: "invalid_setup_code", message: "Setup code needs url and bootstrapToken." };
  }
  const normalized = normalizeGatewayUrl(url);
  if (!normalized.ok) {
    return normalized;
  }
  if (typeof decoded.expiresAtMs === "number") {
    const now = options.nowMs ?? Date.now();
    if (!Number.isSafeInteger(decoded.expiresAtMs) || decoded.expiresAtMs <= now) {
      return { ok: false, code: "expired_setup_code", message: "Setup code has expired." };
    }
  }
  return {
    ok: true,
    url: normalized.url,
    bootstrapToken,
    expiresAtMs: typeof decoded.expiresAtMs === "number" ? decoded.expiresAtMs : undefined,
  };
}

export function encodeSetupCode(payload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

/**
 * Accepts a Gateway URL plus token, or an OpenClaw `oc-pair://` / base64url setup code.
 * Tokens are returned for the caller to persist locally — never logged by this module.
 */
export function parsePairingInput(input = {}, options = {}) {
  const rawCode = typeof input.setupCode === "string" ? input.setupCode.trim() : "";
  const rawToken = typeof input.token === "string" ? input.token.trim() : "";
  const setupCandidate =
    rawCode ||
    (rawToken.startsWith(SETUP_PREFIX) || (!input.gatewayUrl && !input.url && rawToken)
      ? rawToken
      : "");

  if (setupCandidate) {
    const decoded = decodeSetupCode(setupCandidate, options);
    if (decoded.ok) {
      return {
        ok: true,
        gatewayUrl: decoded.url,
        auth: { kind: "bootstrap", bootstrapToken: decoded.bootstrapToken },
        expiresAtMs: decoded.expiresAtMs,
      };
    }
    if (!input.gatewayUrl && !input.url) {
      return decoded;
    }
  }

  const url = normalizeGatewayUrl(input.gatewayUrl ?? input.url);
  if (!url.ok) {
    return url;
  }
  if (!rawToken) {
    return { ok: false, code: "missing_token", message: "Token or setup code required." };
  }
  return {
    ok: true,
    gatewayUrl: url.url,
    auth: { kind: "token", token: rawToken },
  };
}

export function pairingConfigRecord(parsed, extras = {}) {
  if (!parsed?.ok) {
    return parsed;
  }
  return {
    gatewayUrl: parsed.gatewayUrl,
    auth: parsed.auth,
    locale: extras.locale ?? "fr-FR",
    displayName: extras.displayName ?? "Nimbus Windows Agent",
    computerControlEnabled: extras.computerControlEnabled !== false,
    screenRecordEnabled: extras.screenRecordEnabled === true,
    cameraEnabled: extras.cameraEnabled === true,
    pairedAt: extras.pairedAt ?? new Date(0).toISOString(),
  };
}
