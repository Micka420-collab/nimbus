/** User-facing French copy. Code and comments stay English. */

export const LABELS = Object.freeze({
  appName: "Nimbus Windows Agent",
  tray: Object.freeze({
    idle: "Nimbus — connecté",
    pairing: "Nimbus — appairage",
    offline: "Nimbus — hors ligne",
    running: "Nimbus — contrôle du bureau",
    waiting: "Nimbus — en attente d'approbation",
    open: "Ouvrir",
    stop: "Arrêter le contrôle",
    approve: "Confirmer l'étape",
    deny: "Refuser l'étape",
    quit: "Quitter",
  }),
  pair: Object.freeze({
    title: "Appairage Gateway",
    url: "URL du Gateway",
    token: "Jeton ou code d'installation",
    save: "Enregistrer et appairer",
    required: "URL et jeton (ou code d'installation) requis.",
    saved: "Configuration enregistrée. Connexion au Gateway…",
    connected: "Connecté au Gateway.",
    rejected: "Le Gateway a refusé l'appairage. Approuve le nœud ou régénère le jeton.",
    offline: "Hors ligne — reconnexion automatique…",
    reconnectFailed: "Reconnexion impossible. Vérifie l'URL et le jeton.",
  }),
  voice: Object.freeze({
    idle: "Inactif",
    muted: "Micro coupé",
    listening: "Écoute",
    thinking: "Réflexion",
    speaking: "Parole",
    micLive: "Micro actif",
    micOff: "Micro inactif",
    ptt: "Maintenir pour parler",
    pttHint: "Le micro ne s'allume que pendant l'appui (PTT) ou après Démarrer la conversation.",
    startConversation: "Démarrer la conversation",
    stopConversation: "Couper le micro",
    consentRequired: "Consentement requis — le micro ne s'allume jamais tout seul.",
    missingKey: "Clé STT/TTS absente. Configure OPENAI_API_KEY ou un fournisseur vocal, puis réessaie.",
    notAstraAudio: "La voix est un chemin Nimbus séparé. Ce n'est pas de l'audio natif Astra.",
    noAudio: "Aucun audio. Relâche le bouton après avoir parlé.",
    mute: "Couper le micro",
    unmute: "Rétablir le micro",
    bargeIn: "Interrompre la lecture",
    hotkey: "Raccourci PTT",
    inputDevice: "Micro",
    outputDevice: "Haut-parleurs",
  }),
  astra: Object.freeze({
    idle: "Inactif",
    running: "En cours",
    waiting_approval: "En attente d'approbation",
    aborted: "Interrompu",
    title: "Contrôle bureau (mode Astra)",
    brief: "Objectif",
    hud: "Nimbus contrôle le bureau",
    abort: "Arrêter (Échap)",
    confirm: "Confirmer cette étape",
    deny: "Refuser",
  }),
  safety: Object.freeze({
    recordDenied: "screen.record est refusé par défaut.",
    cameraDenied: "Caméra refusée par défaut.",
    needsConfirm: "Action à fort impact — confirmation humaine requise.",
    exploitBlocked: "Outil d'exploitation refusé. Nimbus ne fait pas de découverte de failles.",
  }),
});

export function voiceHud(snapshot) {
  return {
    phase: snapshot.phase,
    phaseLabel: LABELS.voice[snapshot.phase] ?? snapshot.phase,
    micLive: snapshot.micLive,
    micLabel: snapshot.micLive ? LABELS.voice.micLive : LABELS.voice.micOff,
    consent: snapshot.consentGranted,
    consentLabel: snapshot.consentGranted
      ? LABELS.voice.pttHint
      : LABELS.voice.consentRequired,
  };
}

export function astraHud(snapshot) {
  return {
    status: snapshot.status,
    statusLabel: LABELS.astra[snapshot.status] ?? snapshot.status,
    title: LABELS.astra.hud,
    brief: snapshot.brief ?? "",
    abortLabel: LABELS.astra.abort,
    visible: snapshot.status === "running" || snapshot.status === "waiting_approval",
  };
}
