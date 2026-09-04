/** User-facing French copy. Code and comments stay English. */
export const LABELS = Object.freeze({
  voice: Object.freeze({
    muted: "Micro coupé",
    listening: "Écoute",
    thinking: "Réflexion",
    speaking: "Parole",
    micLive: "Micro actif",
    micOff: "Micro inactif",
    consentRequired: "Consentement requis — le micro ne s'allume jamais tout seul.",
    consentGranted: "Écoute autorisée pour cette session.",
    consentRevoked: "Consentement retiré. Micro coupé.",
    bargeIn: "Interruption (barge-in)",
    hudTitle: "Nimbus — conversation vocale",
    roomBureau: "Bureau",
    roomSalon: "Salon",
  }),
  rooms: Object.freeze({
    bureau: "Bureau",
    salon: "Salon",
  }),
  debate: Object.freeze({
    security: "Sécurité",
    speed: "Vitesse",
    awaitingHuman: "La Reine a tranché — à toi de confirmer.",
  }),
  anticipation: Object.freeze({
    quiet: "Silence calibré — pas de spam.",
  }),
  permissions: Object.freeze({
    deny: "Refus par défaut",
    ask: "Demander avant",
    allowlist: "Liste autorisée uniquement",
    auto: "Revue automatique puis humain",
    full: "Tout autoriser (déconseillé)",
    needsApproval: "Approbation humaine requise",
    blocked: "Action bloquée",
  }),
  colony: Object.freeze({
    lead: "Chef",
    worker: "Ouvrier",
    pendingApproval: "En attente d'approbation",
    approved: "Approuvé",
    rejected: "Refusé",
  }),
  memory: Object.freeze({
    learned: "Préférence enregistrée localement.",
    forgotten: "Souvenir oublié.",
    secretRefused: "Secret refusé — rien n'a été écrit.",
  }),
});

export function voiceHud(snapshot) {
  const roomId = snapshot.room?.id;
  return {
    phase: snapshot.phase,
    phaseLabel: LABELS.voice[snapshot.phase],
    micLive: snapshot.micLive,
    micLabel: snapshot.micLive ? LABELS.voice.micLive : LABELS.voice.micOff,
    consent: snapshot.consentGranted,
    consentLabel: snapshot.consentGranted
      ? LABELS.voice.consentGranted
      : LABELS.voice.consentRequired,
    bargeIn: Boolean(snapshot.bargeInArmed),
    room: roomId ?? null,
    roomLabel: roomId ? (LABELS.rooms[roomId] ?? snapshot.room.label ?? roomId) : null,
  };
}
