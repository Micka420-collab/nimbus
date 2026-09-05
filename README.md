# Nimbus

Couche locale personnelle posée sur une copie de travail d'[OpenClaw 2.0](https://github.com/openclaw/openclaw) (`v2026.8.1`). Ce n'est pas une réécriture du runtime OpenClaw : le runtime est intact, la couche additive vit dans [`nimbus/`](nimbus/) et écrit ses propres fichiers sous `~/.nimbus` (ou `NIMBUS_STATE_DIR`).

Trois choses cohabitent dans ce dépôt, et elles s'installent séparément :

| Brique | Ce que c'est | Installation |
| --- | --- | --- |
| **Gateway OpenClaw** | L'assistant complet : modèles, canaux, Control UI, service. | Docker ou build source — voir ci-dessous |
| **Couche Nimbus** | Mémoire, colonie, confiance, file hors-ligne, park, permissions. Zéro dépendance. | Aucune. Node ≥ 22 et c'est tout |
| **Agent Windows** | Nœud Electron : pairage Gateway, voix PTT, contrôle bureau Astra, HUD visible. | Installateur `NimbusAgent-Setup-x64.exe` — voir section 4 |

---

## 1. Installation rapide sur Ubuntu

### Prérequis

- Ubuntu 22.04 ou 24.04, 2 vCPU.
- **6 Go de RAM minimum pour la construction** (image Docker comme build source). En dessous, la compilation se termine par `Killed` / code 137.
- 20 Go de disque libre.
- Un accès SSH. Le port `18789` du Gateway **ne doit pas** être ouvert sur Internet : on y accède par tunnel SSH (section 3).

Pare-feu, avant tout le reste :

```bash
sudo apt update
sudo apt install -y ufw
sudo ufw allow OpenSSH
sudo ufw enable
sudo ufw status verbose
```

Choisis ensuite **une** des deux voies.

---

### Voie A — Docker (recommandée sur un serveur)

Le plus court et le plus isolé. Le script construit l'image depuis ce dépôt, génère le jeton du Gateway, lance l'onboarding et démarre les conteneurs.

```bash
# 1. Outils de base + Docker
sudo apt update
sudo apt install -y git curl ca-certificates
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER" && newgrp docker
docker --version && docker compose version

# 2. Le dépôt
git clone https://github.com/Micka420-collab/nimbus.git
cd nimbus

# 3. Les chemins persistants sur l'hôte
export OPENCLAW_CONFIG_DIR="$HOME/.openclaw"
export OPENCLAW_WORKSPACE_DIR="$HOME/.openclaw/workspace"
export OPENCLAW_AUTH_PROFILE_SECRET_DIR="$HOME/.openclaw-auth-profile-secrets"

# 4. Build + démarrage (onboarding interactif inclus)
./scripts/docker/setup.sh
```

Pour une installation non interactive (onboarding plus tard) :

```bash
OPENCLAW_SKIP_ONBOARDING=1 ./scripts/docker/setup.sh
```

Vérifier :

```bash
docker compose ps
docker compose logs --tail=100 openclaw-gateway
docker compose run --rm openclaw-cli doctor --json
```

Les conteneurs sont en `restart: unless-stopped` : ils repartent au reboot, sans systemd à écrire.

---

### Voie B — Build source + service systemd

À préférer si tu veux la CLI `openclaw` directement sur l'hôte et modifier le code.

```bash
# 1. Outils de base
sudo apt update
sudo apt install -y curl git build-essential ca-certificates

# 2. Node (ligne 24 LTS ; 22.22.3+, 24.15+ ou 25.9+ sont acceptés)
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node -v          # doit afficher >= 24.15.0

# 3. pnpm à la version épinglée par le dépôt (pnpm 12)
sudo corepack enable

# 4. Le dépôt
git clone https://github.com/Micka420-collab/nimbus.git
cd nimbus

# 5. Dépendances + build (compter 10-20 min selon la machine)
pnpm install
pnpm build
pnpm ui:build

# 6. Rendre la commande `openclaw` disponible partout
pnpm add --global "openclaw@link:$PWD"
openclaw --version
```

Si `corepack enable` n'est pas disponible :

```bash
sudo npm install -g pnpm@12.1.0 --allow-scripts=pnpm@12.1.0
```

Si pnpm signale que son dossier de binaires globaux n'est pas dans le `PATH` : `pnpm setup`, rouvre le shell, puis relance l'étape 6. Alternative sans installation globale : préfixe tout par `pnpm openclaw ...` depuis le dépôt.

#### Onboarding et service

```bash
openclaw onboard --install-daemon
```

L'onboarding demande le modèle et les identifiants, puis installe un service **systemd utilisateur**. Sur un serveur sans session graphique, deux réglages sont obligatoires :

```bash
# Le service doit survivre à la déconnexion SSH
sudo loginctl enable-linger "$(whoami)"

# Nécessaire avant toute commande `systemctl --user` en SSH
export XDG_RUNTIME_DIR=/run/user/$(id -u)
```

Gestion du service :

```bash
openclaw gateway status
openclaw gateway start
openclaw gateway stop
openclaw gateway health
openclaw gateway install       # (ré)installe l'unité systemd
systemctl --user status openclaw-gateway.service
```

---

## 2. Le jeton du Gateway

Le Gateway refuse de démarrer sans authentification dès qu'il écoute au-delà de la boucle locale. Le jeton est généré automatiquement au premier démarrage ; pour le fournir toi-même :

```bash
cp .env.example .env
printf 'OPENCLAW_GATEWAY_TOKEN=%s\n' "$(openssl rand -hex 32)" >> .env
```

Ne recopie jamais un jeton d'exemple tiré d'une doc : le Gateway les rejette explicitement.

---

## 3. Accéder au Control UI depuis ton poste

Le port `18789` reste fermé côté Internet. On passe par un tunnel SSH.

Sur le serveur, vérifie que `/etc/ssh/sshd_config` contient :

```text
AllowTcpForwarding local
```

puis `sudo sshd -t && sudo systemctl restart ssh`.

Depuis ton poste, laisse tourner :

```bash
ssh -N -L 18789:127.0.0.1:18789 <user>@<ip-du-serveur>
```

Ouvre ensuite `http://127.0.0.1:18789/` et colle le jeton. Pour réafficher l'URL du dashboard ou approuver un navigateur :

```bash
# Voie Docker
docker compose run --rm openclaw-cli dashboard --no-open
docker compose run --rm openclaw-cli devices list
docker compose run --rm openclaw-cli devices approve <requestId>

# Voie source
openclaw dashboard --no-open
openclaw devices list
openclaw devices approve <requestId>
```

Si le tunnel échoue en `administratively prohibited`, c'est `AllowTcpForwarding` qu'il faut revoir — pas le pare-feu cloud, qui n'a besoin d'autoriser que SSH.

---

## 4. La couche Nimbus

Aucune installation : Node ≥ 22, aucune dépendance, aucun build. Elle fonctionne même si tu n'as pas construit OpenClaw.

```bash
node nimbus/cli/nimbus.mjs --help
node --test nimbus/test/*.test.js     # overlay
node --test nimbus/windows-agent/test/*.test.js
```

### Ce qui écrit un état réel sur disque

| Surface | Ce que ça fait | Fichier |
| --- | --- | --- |
| Mémoire | `learn` / `forget` / `list`, zones (`perso`, `collegue`, `tech`), TTL (`weekend` ou heures). Toute forme `password:` / `token:` / `secret:` est refusée quelle que soit la valeur ; `--force` passe outre avec un avertissement. | `~/.nimbus/memory.json` |
| Colonie | Ouvriers, tâches, étapes. Les actions risquées (`exec`, `network`, `send`, …) restent en `needs_approval` jusqu'à décision humaine. | `~/.nimbus/colony-ledger.json` |
| Confiance | Scores d'approbation/rejet. Peut rendre exécutables les étapes **medium** après assez d'échantillons. N'auto-exécute jamais du risque élevé en mode deny. | `~/.nimbus/trust.json` |
| Hors-ligne | File locale avec bascule manuelle `offline on\|off`. La reconnexion rend les éléments livrés et les approbations en attente. | `~/.nimbus/continuum.json` |
| Permissions | Overlay deny par défaut. `permissions apply` fusionne `tools.exec.mode` dans un `openclaw.json` réel (garde le mode existant sans `--force`). | `openclaw.json` cible |
| Profil | Copie `SOUL.md`, `IDENTITY.md`, `USER.md`, `AGENTS.md`, `MEMORY.md` dans un workspace. N'écrase pas sans `--force`. | fichiers du workspace |
| Park | Pause/reprise de sessions, frise d'actions, estimation de coût. | `~/.nimbus/park.json` |
| Agent Windows | Pairage nœud Gateway, voix PTT, contrôle bureau Astra avec HUD. Installateur : `NimbusAgent-Setup-x64.exe`. | `~/.nimbus/windows-agent.json` |

### Premiers pas

```bash
# Installer le profil dans le workspace de l'agent
node nimbus/cli/nimbus.mjs profile install --workspace ~/.openclaw/workspace

# Appliquer l'overlay de permissions deny à la config OpenClaw
node nimbus/cli/nimbus.mjs permissions apply --config ~/.openclaw/openclaw.json

# Mémoire
node nimbus/cli/nimbus.mjs memory learn --key ville --value Paris
node nimbus/cli/nimbus.mjs memory learn --key stack --value Ubuntu --zone tech
node nimbus/cli/nimbus.mjs memory list
```

`permissions apply` réécrit la config en JSON et **perd les commentaires** du fichier d'origine. Une sauvegarde horodatée (`openclaw.json.bak-20260905T140541`) est écrite à côté avant chaque réécriture, donc la version commentée reste récupérable même après plusieurs passages.

Pour tester sans toucher à ta vraie config, utilise un état isolé :

```bash
node nimbus/cli/nimbus.mjs --state /tmp/nimbus-demo memory learn --key test --value ok
node nimbus/cli/nimbus.mjs --state /tmp/nimbus-demo memory list
```

Docs détaillées : [`nimbus/docs/memoire.md`](nimbus/docs/memoire.md), [`nimbus/docs/colonie.md`](nimbus/docs/colonie.md), [`nimbus/docs/permissions.md`](nimbus/docs/permissions.md).

### Compagnon Windows

Pairage comme nœud Gateway, PTT visible, contrôle bureau avec HUD. Détail : [`nimbus/windows-agent/README.md`](nimbus/windows-agent/README.md). Control UI → Apps → **Download Windows Agent** (asset GitHub `latest`, ou fichier local `/nimbus-agent/NimbusAgent-Setup-x64.exe` sur l'hôte Gateway).

```bash
node --test nimbus/windows-agent/test/*.test.js
node nimbus/windows-agent/cli.mjs phrase --text "ouvre le Bloc-notes et écris hello"
```

---

## 5. Mise à jour

```bash
cd nimbus
git pull --ff-only

# Voie Docker
OPENCLAW_SKIP_ONBOARDING=1 ./scripts/docker/setup.sh
docker compose run --rm openclaw-cli doctor --json

# Voie source
pnpm install
pnpm build
pnpm ui:build
openclaw doctor --fix
openclaw gateway restart
```

---

## 6. Désinstallation

```bash
# Voie Docker
cd nimbus && docker compose down

# Voie source
openclaw gateway stop
openclaw gateway uninstall
pnpm remove -g openclaw
```

L'état persistant (`~/.openclaw`, `~/.nimbus`) n'est jamais supprimé par ces commandes — efface-le à la main si c'est voulu.

---

## 7. Dépannage

| Symptôme | Cause et remède |
| --- | --- |
| `Killed` ou code 137 pendant le build | Pas assez de RAM. Il en faut ~6 Go. Agrandis la machine ou ajoute du swap. |
| `Unsupported Node version` | `node -v` est en dessous du plancher. Versions acceptées : 22.22.3+, 24.15+, ou 25.9+. |
| `systemctl --user` répond `Failed to connect to bus` | `export XDG_RUNTIME_DIR=/run/user/$(id -u)` dans la session SSH. |
| Le Gateway s'arrête à la déconnexion SSH | `sudo loginctl enable-linger "$(whoami)"`. |
| `Cannot find module ...` après un `git pull` | `node_modules` périmé. `pnpm install` avant de chercher plus loin. |
| Le tunnel SSH refuse : `administratively prohibited` | `AllowTcpForwarding local` dans `/etc/ssh/sshd_config`, puis redémarrage de `ssh`. |
| `docker: permission denied` | Le compte n'est pas encore dans le groupe `docker`. `newgrp docker` ou reconnexion. |
| Diagnostic général | `openclaw doctor --fix`, ou `docker compose run --rm openclaw-cli doctor --json`. |

---

## Ce qui n'est pas prêt

Pas de calendrier, pas d'intégration Docker dans la couche Nimbus. La voix en direct et le contrôle bureau vivent dans l'agent Windows (PTT + HUD), pas dans `nimbus/src`. Les plugins voix et calendrier d'OpenClaw restent configurables depuis la doc amont ; cette couche ne prétend pas les avoir câblés.

Ce fork ne fait pas tourner la suite complète d'actions GitHub d'OpenClaw (runners d'organisation, GitHub App, CodeQL). Le check qui compte ici est [`.github/workflows/nimbus.yml`](.github/workflows/nimbus.yml) ; les workflows amont sont archivés dans `.github/upstream-workflows/`.

## Références

- Documentation amont : https://docs.openclaw.ai
- Notes de la couche : [`CHANGELOG-NIMBUS.md`](CHANGELOG-NIMBUS.md)
- Guides serveur amont : [`docs/install/hetzner.md`](docs/install/hetzner.md), [`docs/install/docker-vm-runtime.md`](docs/install/docker-vm-runtime.md), [`docs/platforms/linux.md`](docs/platforms/linux.md)

## Licence

MIT, sources OpenClaw 2.0 incluses. Voir `LICENSE` et `THIRD_PARTY_NOTICES.md`.
Tag amont : [openclaw/openclaw@v2026.8.1](https://github.com/openclaw/openclaw/releases/tag/v2026.8.1).
