import assert from "node:assert/strict";
import { test } from "node:test";
import { encodeSetupCode, normalizeGatewayUrl, parsePairingInput } from "../src/pairing.js";
import { savePairingConfig, loadAgentConfig, mergeAgentConfig } from "../src/config.js";
import { tempState } from "../../test/helpers.js";

test("normalizes http(s) gateway URLs to websocket URLs", () => {
  assert.equal(normalizeGatewayUrl("https://gw.example:18789").url, "wss://gw.example:18789/");
  assert.equal(normalizeGatewayUrl("http://127.0.0.1:18789").url, "ws://127.0.0.1:18789/");
  assert.equal(normalizeGatewayUrl("not-a-url").ok, false);
});

test("long alphanumeric tokens stay tokens when a Gateway URL is also present", () => {
  const parsed = parsePairingInput({
    gatewayUrl: "wss://gw.example:18789",
    token: "abcdefghijklmnopqrstuvwxyz012345",
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.auth.kind, "token");
  assert.equal(parsed.auth.token, "abcdefghijklmnopqrstuvwxyz012345");
});

test("parses token pairing and OpenClaw setup codes", () => {
  const token = parsePairingInput({
    gatewayUrl: "wss://gw.example:18789",
    token: "secret-token",
  });
  assert.equal(token.ok, true);
  assert.equal(token.auth.kind, "token");
  assert.equal(token.auth.token, "secret-token");

  const code = encodeSetupCode({
    url: "wss://gw.example:18789",
    bootstrapToken: "boot-1",
    expiresAtMs: Date.now() + 60_000,
  });
  const setup = parsePairingInput({ setupCode: `oc-pair://${code}` }, { nowMs: Date.now() });
  assert.equal(setup.ok, true);
  assert.equal(setup.auth.kind, "bootstrap");
  assert.equal(setup.auth.bootstrapToken, "boot-1");
});

test("rejects expired setup codes and missing tokens", () => {
  const code = encodeSetupCode({
    url: "wss://gw.example:18789",
    bootstrapToken: "boot-1",
    expiresAtMs: 10,
  });
  const expired = parsePairingInput({ setupCode: code }, { nowMs: 20 });
  assert.equal(expired.ok, false);
  assert.equal(expired.code, "expired_setup_code");
  assert.equal(parsePairingInput({ gatewayUrl: "wss://gw.example" }).ok, false);
});

test("pair save writes windows-agent.json without putting secrets in the filename", () => {
  const state = tempState("nimbus-wa-");
  const saved = savePairingConfig(state, {
    gatewayUrl: "https://gw.example:18789",
    token: "operator-token",
  });
  assert.equal(saved.ok, true);
  const loaded = loadAgentConfig(state);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.config.gatewayUrl, "wss://gw.example:18789/");
  assert.equal(loaded.config.auth.token, "operator-token");
  assert.equal(loaded.config.screenRecordEnabled, false);
  assert.equal(loaded.config.cameraEnabled, false);
  const merged = mergeAgentConfig(state, { auth: { deviceToken: "dev-token" } });
  assert.equal(merged.config.auth.token, "operator-token");
  assert.equal(merged.config.auth.deviceToken, "dev-token");
});
