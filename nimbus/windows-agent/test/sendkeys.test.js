import assert from "node:assert/strict";
import { test } from "node:test";
import { escapeSendKeysLiteral, mapSendKey, planWindowsCommand, windowsSendKeysPayload } from "../src/windows-input.js";

test("type path escapes SendKeys specials so model text cannot chord", () => {
  assert.equal(escapeSendKeysLiteral("%{F4}"), "{%}{{}F4{}}");
  assert.equal(escapeSendKeysLiteral("^a"), "{^}a");
  assert.equal(escapeSendKeysLiteral("+{TAB}"), "{+}{{}TAB{}}");
  assert.equal(escapeSendKeysLiteral("hello (world)"), "hello {(}world{)}");
  assert.equal(escapeSendKeysLiteral("{x}"), "{{}x{}}");
  assert.equal(escapeSendKeysLiteral("100%"), "100{%}");
  assert.equal(escapeSendKeysLiteral("a+b~c"), "a{+}b{~}c");

  const typed = planWindowsCommand({ action: "type", text: "%{F4}" });
  assert.equal(windowsSendKeysPayload(typed), "{%}{{}F4{}}");
  assert.ok(!windowsSendKeysPayload(typed).includes("%{F4}"));
});

test("key path allowlists named keys and literal-escapes the rest", () => {
  assert.equal(mapSendKey("enter"), "{ENTER}");
  assert.equal(mapSendKey("tab"), "{TAB}");
  assert.equal(mapSendKey("%{F4}"), "{%}{{}F4{}}");
  assert.equal(mapSendKey("^a"), "{^}a");
  const chord = planWindowsCommand({ action: "key", key: "+{TAB}" });
  assert.equal(windowsSendKeysPayload(chord), "{+}{{}TAB{}}");
});
