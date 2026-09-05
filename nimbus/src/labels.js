/** User-facing French copy. Code and comments stay English. */
export const LABELS = Object.freeze({
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
