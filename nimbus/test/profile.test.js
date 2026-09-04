import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { installNimbusProfile, readNimbusProfile } from "../src/profile.js";
import { tempState } from "./helpers.js";

test("profile is French Jarvis Nimbus", () => {
  const profile = readNimbusProfile();
  assert.equal(profile.id, "nimbus");
  assert.equal(profile.locale, "fr");
  assert.match(profile.files["SOUL.md"], /Nimbus/);
  assert.match(profile.files["SOUL.md"], /français/);
  assert.match(profile.files["IDENTITY.md"], /\*\*Name:\*\* Nimbus/);
});

test("install is additive and does not overwrite existing workspace files", () => {
  const workspace = tempState("nimbus-ws-");
  writeFileSync(join(workspace, "SOUL.md"), "custom soul\n");
  const first = installNimbusProfile(workspace);
  assert.equal(first.ok, true);
  assert.ok(first.skipped.includes("SOUL.md"));
  assert.ok(first.copied.includes("IDENTITY.md"));
  assert.equal(readFileSync(join(workspace, "SOUL.md"), "utf8"), "custom soul\n");
});

test("force install replaces workspace persona files", () => {
  const workspace = tempState("nimbus-ws-");
  writeFileSync(join(workspace, "SOUL.md"), "old\n");
  const result = installNimbusProfile(workspace, { force: true });
  assert.ok(result.copied.includes("SOUL.md"));
  assert.match(readFileSync(join(workspace, "SOUL.md"), "utf8"), /Nimbus/);
});
