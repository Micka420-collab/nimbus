export const MEMORY_ZONES = Object.freeze(["perso", "collegue", "tech"]);

export function normalizeZone(zone) {
  const raw = typeof zone === "string" ? zone.trim().toLowerCase() : "";
  if (raw === "kollega" || raw === "colleague" || raw === "collegue") {
    return "collegue";
  }
  if (MEMORY_ZONES.includes(raw)) {
    return raw;
  }
  return "perso";
}

export function nextMondayUtc(nowIso) {
  const stamp = Date.parse(nowIso);
  const start = Number.isFinite(stamp) ? new Date(stamp) : new Date();
  const day = start.getUTCDay();
  const add = day === 0 ? 1 : 8 - day;
  const monday = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + add, 0, 0, 0));
  return monday.toISOString();
}

export function resolveExpiry(ttl, nowIso) {
  if (ttl === "weekend") {
    return { ttl: "weekend", weekendForget: true, expiresAt: nextMondayUtc(nowIso) };
  }
  const hours = Number(ttl);
  if (Number.isFinite(hours) && hours > 0) {
    const start = Date.parse(nowIso);
    return {
      ttl: `${hours}h`,
      weekendForget: false,
      expiresAt: new Date(start + hours * 3600_000).toISOString(),
    };
  }
  return { ttl: null, weekendForget: Boolean(ttl === true), expiresAt: null };
}
