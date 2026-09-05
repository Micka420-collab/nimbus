import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function tempState(prefix = "nimbus-") {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function fixedClock(iso = "2026-09-04T12:00:00.000Z") {
  return () => iso;
}
