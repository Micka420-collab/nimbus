/**
 * PCM level meter. Pure: no devices, no I/O.
 *
 * Failure modes:
 * - empty / non-buffer input → level 0 (not an error; meter is informational).
 */

/**
 * @param {Buffer|Uint8Array|Int16Array} pcm
 * @param {"s16le"|"f32le"} [format]
 * @returns {{ rms: number, peak: number, db: number }}
 */
export function measurePcmLevel(pcm, format = "s16le") {
  const samples = toSamples(pcm, format);
  if (samples.length === 0) {
    return { rms: 0, peak: 0, db: -Infinity };
  }
  let sumSq = 0;
  let peak = 0;
  for (const sample of samples) {
    const mag = Math.abs(sample);
    sumSq += sample * sample;
    if (mag > peak) {
      peak = mag;
    }
  }
  const rms = Math.sqrt(sumSq / samples.length);
  const db = rms <= 0 ? -Infinity : 20 * Math.log10(rms);
  return { rms, peak, db };
}

/**
 * @param {{ rms: number }} level
 * @returns {number} 0–1 display value
 */
export function meterFill(level) {
  const rms = Number(level?.rms);
  if (!Number.isFinite(rms) || rms <= 0) {
    return 0;
  }
  return Math.min(1, rms);
}

function toSamples(pcm, format) {
  if (!pcm) {
    return [];
  }
  if (format === "f32le") {
    const view = pcm instanceof Float32Array ? pcm : new Float32Array(toArrayBuffer(pcm));
    return Array.from(view, (value) => clamp1(value));
  }
  const bytes = pcm instanceof Uint8Array ? pcm : Uint8Array.from(pcm);
  const samples = [];
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const value = bytes[i] | (bytes[i + 1] << 8);
    const signed = value > 0x7fff ? value - 0x10000 : value;
    samples.push(signed / 32768);
  }
  return samples;
}

function toArrayBuffer(pcm) {
  if (pcm instanceof ArrayBuffer) {
    return pcm;
  }
  if (ArrayBuffer.isView(pcm)) {
    return pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength);
  }
  return new Uint8Array(pcm).buffer;
}

function clamp1(value) {
  if (value > 1) {
    return 1;
  }
  if (value < -1) {
    return -1;
  }
  return value;
}
