import { createJsonStore, storePath } from "./store.js";

export const DEFAULT_ROOMS = Object.freeze({
  bureau: {
    id: "bureau",
    label: "Bureau",
    memoryZone: "tech",
    toolDefaults: ["workspace.read", "memory.read", "memory.write", "timeline.read"],
    anticipationContext: "work",
  },
  salon: {
    id: "salon",
    label: "Salon",
    memoryZone: "perso",
    toolDefaults: ["memory.read", "voice.hud"],
    anticipationContext: "home",
  },
});

/**
 * Presence rooms switch memory/tool defaults. Never starts the microphone.
 */
export function createPresence(rootDir, options = {}) {
  const store = createJsonStore(storePath(rootDir, "presence.json"), {
    version: 1,
    room: null,
  });
  const rooms = { ...DEFAULT_ROOMS, ...(options.rooms ?? {}) };

  return {
    rooms() {
      return { ok: true, rooms: Object.values(rooms).map((room) => ({ ...room })) };
    },

    current() {
      const id = store.read().room;
      const room = id ? rooms[id] : null;
      return { ok: true, room: room ? { ...room } : null };
    },

    enter(roomId) {
      const id = String(roomId ?? "").trim().toLowerCase();
      const room = rooms[id];
      if (!room) {
        return { ok: false, code: "unknown_room", message: "bureau or salon" };
      }
      store.write({ version: 1, room: id });
      return {
        ok: true,
        room: { ...room },
        voice: { phase: "muted", micLive: false, consentGranted: false },
        message: `${room.label} — mémoire ${room.memoryZone}. Micro toujours coupé jusqu'au consentement.`,
      };
    },

    leave() {
      store.write({ version: 1, room: null });
      return { ok: true, room: null };
    },
  };
}
