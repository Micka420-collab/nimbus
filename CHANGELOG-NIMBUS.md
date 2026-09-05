# Changelog Nimbus

Journal de la couche personnelle. Le `CHANGELOG.md` OpenClaw reste généré pour les releases upstream — ne pas l'éditer ici.

## 0.5.0 — 2026-09-05

### Pourquoi

Il manquait un compagnon Windows téléchargeable depuis le Dashboard, avec voix PTT visible et contrôle bureau façon Astra (observe → valide → exécute → réobserve), sans HUD furtif.

### Ajouté

- `nimbus/windows-agent/` : nœud Electron, handshake Gateway réel (`connect` / `hello-ok` / `node.invoke`), installateur NSIS `NimbusAgent-Setup-x64.exe`, tests protocole Linux.
- Apps / Control UI : **Download Windows Agent** vers le latest GitHub asset (ou `/nimbus-agent/` en local).
- Voix : machine idle/muted/listening/thinking/speaking, PTT + conversation explicite, barge-in, appareils / niveau / mute / raccourci. STT/TTS OpenAI-compatible. Pas d'audio Astra. Échec franc sans clé.
- Contrôle bureau : hash d'écran + un retry stale-UI, planner FR, plan JSON Gateway, Playwright `goto` si installé, trust overlay, HUD / plateau Approuver-Refuser, Échap.
- Reconnexion Gateway ; jeton refusé visible en français (pas de boucle).
- CI `nimbus-windows-agent.yml` sur `windows-latest` (NSIS unsigned — SmartScreen attendu).

### Inchangé

- Overlay `nimbus/src` sans théâtre vocal. Mémoire, colonie, trust, park, permissions.

## 0.4.0 — 2026-09-05

### Pourquoi

Le jeu de skills livré couvrait le Mac et des CLI ponctuelles. Rien pour piloter la maison, rien pour se servir d'un PC Windows appairé, rien sur la manière de conduire une application sans cliquer à l'aveugle.

### Ajouté

- `skills/home-assistant` : lecture d'état, appel de service et écriture d'automatisations via `hass-cli` ou l'API REST. Résolution obligatoire de l'`entity_id` avant d'agir, vérification après coup, tableau d'anti-patterns, et confirmation humaine imposée sur les actionneurs physiques (serrure, portail, alarme, chauffage, vanne).
- `skills/windows-desktop` : préflight des trois conditions du `computer` tool, boucle observer → agir → réobserver avec discipline du `frameId`, cibles structurées avant les coordonnées, raccourcis Windows, refus explicite des surfaces non automatisables (UAC, Windows Hello, BitLocker), et rappel que l'écran est une entrée non fiable.
- `skills/desktop-apps` : échelle des surfaces de contrôle (CLI/API > pont d'automatisation OS > éléments accessibilité > pixels), discipline du focus, références qui périment, attente sur un état plutôt que sur une horloge, et les décisions qui restent à l'utilisateur (licences, permissions, paiements).

### Inchangé

- Aucun fichier upstream modifié : les trois skills sont des ajouts sous `skills/`, chargés au rang « bundled ».
- Couche `nimbus/` inchangée.

## 0.3.0 — 2026-09-05

### Pourquoi

Les chemins démo (HUD voix, anticipation, jumeau, skills, débat, pièces) étaient présentés comme des fonctions. Ils n'avaient pas d'intégration réelle.

### Changé

- Suppression des modules et commandes théâtre. README limité à ce qui écrit un état disque testé.
- `permissions apply` fusionne `tools.exec.mode` (et optionnellement le workspace) dans un `openclaw.json` réel. Mode existant conservé sans `--force`.
- La colonie n'attache plus de simulation d'impact. Trust continue de gate les étapes medium / high.
- CI de ce fork : seul `.github/workflows/nimbus.yml` reste actif. Les workflows OpenClaw org sont archivés dans `.github/upstream-workflows/`.

### Inchangé

- Mémoire, colonie, trust, file hors-ligne, park, profil. Install OpenClaw inchangé.

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
