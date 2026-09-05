import { createHash } from "node:crypto";

/**
 * Screenshot identity for stale-UI detection.
 *
 * Failure modes: missing bytes → hash null (treat as changed, never invent pixels).
 */

/**
 * @param {Buffer|Uint8Array|string|null|undefined} bytes
 * @returns {string|null}
 */
export function hashObservationBytes(bytes, encoding = "base64") {
  const buffer = toBuffer(bytes, encoding);
  if (!buffer || buffer.length === 0) {
    return null;
  }
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * @param {{ hash?: string|null }} previous
 * @param {{ hash?: string|null }} next
 */
export function observationChanged(previous, next) {
  if (!previous?.hash || !next?.hash) {
    return true;
  }
  return previous.hash !== next.hash;
}

/**
 * Wait and screenshot do not require a pixel change.
 * @param {{ action?: string, op?: string }} action
 */
export function expectsVisualChange(action) {
  const name = action?.action ?? action?.op;
  return name !== "wait" && name !== "screenshot";
}

function toBuffer(bytes, encoding) {
  if (!bytes) {
    return null;
  }
  if (Buffer.isBuffer(bytes)) {
    return bytes;
  }
  if (bytes instanceof Uint8Array) {
    return Buffer.from(bytes);
  }
  if (typeof bytes === "string") {
    return Buffer.from(bytes, encoding);
  }
  return null;
}
