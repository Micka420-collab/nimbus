import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

test("installer icon meets electron-builder 256px floor", () => {
  const path = fileURLToPath(new URL("../app/icon.png", import.meta.url));
  const data = readFileSync(path);
  assert.equal(data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);
  const width = data.readUInt32BE(16);
  const height = data.readUInt32BE(20);
  assert.ok(width >= 256, `icon width ${width}`);
  assert.ok(height >= 256, `icon height ${height}`);
});

test("CI verifies the NSIS exe without uploading on every PR", () => {
  const yaml = readFileSync(new URL("../../../.github/workflows/nimbus-windows-agent.yml", import.meta.url), "utf8");
  assert.equal(yaml.includes("Copy-Item"), false);
  assert.match(yaml, /Verify installer artifact/);
  assert.match(
    yaml,
    /Upload installer\n {8}if: github\.event_name == 'workflow_dispatch' \|\| startsWith\(github\.ref, 'refs\/tags\/nimbus-agent-v'\)/,
  );
});
