# Changelog Nimbus

Journal de la couche personnelle. Le `CHANGELOG.md` OpenClaw reste généré pour les releases upstream — ne pas l'éditer ici.

## 0.1.0 — 2026-09-04

### Pourquoi

Le dépôt était un import quasi intact d'OpenClaw 2.0 (`v2026.8.1`) sous le nom de travail « nimpus ». Il manquait une couche Nimbus additive : persona, mémoire locale, voix consentie, colonie, park, permissions.

### Ajouté

- `nimbus/` autonome (Node ≥ 22, `node:test`, zéro dépendance).
- Profil FR Jarvis (`SOUL.md`, `IDENTITY.md`, `USER.md`, `AGENTS.md`, `MEMORY.md`) installable sans écraser un workspace existant.
- Mémoire personnelle locale avec `learn` / `forget` et refus des secrets.
- Machine d'états vocale + HUD `nimbus/ui/voix.html` (consentement visible, pas de micro au chargement).
- Mode colonie : lead, ouvriers, registre de tâches, approbation des étapes risquées.
- Park / reprise, frise d'actions, estimation de coût (barème documenté, pas une facture).
- Overlay permissions `deny` optionnel + doc des modes OpenClaw.
- CLI `node nimbus/cli/nimbus.mjs`.
- Tests : mémoire, permissions, colonie, park, voix, profil.

### Inchangé

- Install / run OpenClaw (`pnpm install`, `pnpm build`, `openclaw onboard`, gateway).
- Aucun fichier `src/` ou `extensions/` OpenClaw modifié.
- Licence MIT OpenClaw conservée.

### Non fait (volontairement)

- Pas de plugin bundlé dans `extensions/` (évite l'inventaire / le dist core).
- Pas de STT/TTS réseau dans cette couche : on compose les plugins vocaux OpenClaw déjà là.
- Pas d'écoute toujours-allumée, keylogger, ou outil d'accès non autorisé.
