# Nimbus — fork OpenClaw 2.0

Ancien nom de note : « nimpus ». Le produit s'appelle **Nimbus**.

Ce dépôt est un fork de travail d'**OpenClaw 2.0** (`v2026.8.1`, tag GitHub `v2026.8.1`), plus une couche optionnelle dans `nimbus/`.

## Upstream

- Projet : [openclaw/openclaw](https://github.com/openclaw/openclaw)
- Release : [v2026.8.1 (AKA OpenClaw 2.0)](https://github.com/openclaw/openclaw/releases/tag/v2026.8.1)
- Docs : https://docs.openclaw.ai
- Licence : MIT (voir `LICENSE`)

## Objectif

Personnaliser OpenClaw ici (profil, mémoire locale, voix consentie, colonie, park, permissions) **sans réécrire le runtime upstream**.

## Dev local (OpenClaw, inchangé)

```bash
pnpm install
pnpm build
pnpm ui:build
```

Voir le README OpenClaw et `CONTRIBUTING.md` pour le workflow complet.

## Couche Nimbus

```bash
node --test nimbus/test/*.test.js
node nimbus/cli/nimbus.mjs help
```

Détail : [`nimbus/README.md`](nimbus/README.md).
