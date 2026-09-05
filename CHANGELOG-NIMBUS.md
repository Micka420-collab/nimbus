# Changelog Nimbus

Journal de la couche personnelle. Le `CHANGELOG.md` OpenClaw reste généré pour les releases upstream — ne pas l'éditer ici.

## 0.2.0 — 2026-09-04

### Pourquoi

Pousser la couche Nimbus plus loin (anticipation, jumeau, oubli, pièces, skills, débat, offline, confiance) sans toucher au runtime OpenClaw.

### Ajouté

- Anticipation calibrée (`anticipate`) : stubs calendrier/heartbeat, notes utile/pas utile, poids locaux, cooldown anti-spam.
- Jumeau de stack (`twin`) : graphe service/repo/node éditable + simulation d'impact avant une étape colonie risquée.
- Mémoire à oubli volontaire : zones `perso` / `collegue` / `tech`, TTL, `forget --weekend` / `--zone`. Refus des secrets inchangé.
- Présence vocale : pièces bureau/salon (zone + outils). HUD visible. Micro toujours coupé au changement de pièce.
- Skills autogen : après N succès identiques, brouillon en bac à sable `deny-exec` jusqu'à approbation humaine.
- Mode débat : deux briefs (sécurité vs vitesse), recommandation Reine, décision humaine, registre des deux côtés.
- Continuum offline : file d'actions, résumé + approbations pendantes à la reconnexion.
- Score de confiance par outil : auto-ready seulement au-dessus du seuil et hors risque haut / deny-exec.
- CLI étendue + tests dédiés. Doc limites : `nimbus/docs/innovations.md`.

### Inchangé

- Install/run OpenClaw. Consentement vocal. Défaut colonie `needs_approval` pour `exec`. Overlay `deny`.
- Toujours pas de `src/` OpenClaw modifié.

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
