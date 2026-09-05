# Nimbus — couche locale

Assistant personnel de Micka, posé **par-dessus** ce fork OpenClaw 2.0 (`v2026.8.1`). Ce dossier ne remplace pas le gateway, le CLI `openclaw`, ni les plugins upstream.

## Lancer OpenClaw (inchangé)

```bash
pnpm install
pnpm build
pnpm ui:build
pnpm openclaw onboard --install-daemon
```

Voir le README racine et https://docs.openclaw.ai

## Couche Nimbus (sans installer le monorepo)

```bash
node nimbus/cli/nimbus.mjs help
node --test nimbus/test/*.test.js
```

```bash
# Persona FR → workspace OpenClaw existant (n'écrase rien sans --force)
node nimbus/cli/nimbus.mjs profile install --workspace ~/.openclaw/workspace
```

## Modules

| Module | Rôle |
| --- | --- |
| Profil | `SOUL.md` / `IDENTITY.md` Jarvis FR |
| Mémoire | préférences + corrections, zones, TTL, oubli weekend |
| Voix | STT→agent→TTS, barge-in, HUD, pièces bureau/salon |
| Colonie | chef, ouvriers, registre, approbation humaine |
| Débat | sécurité vs vitesse, Reine + humain |
| Skills | brouillon local après N succès, bac à sable deny-exec |
| Jumeau | graphe homelab + dry-run d'impact |
| Anticipation | hints calibrés, anti-spam |
| Continuum | file hors-ligne + résumé à la reco |
| Confiance | score par outil, jamais d'auto-exec haut risque en deny |
| Park | pause / reprise, frise d'actions, coût approximatif |
| Permissions | défaut `deny`, modes documentés |

Détail innovations + limites : [docs/innovations.md](docs/innovations.md).

## Voix — honnêteté

**Pas d'écoute furtive.** Le micro démarre coupé. Un bouton (et la permission OS/navigateur) est obligatoire. Détail : [docs/voix-consentement.md](docs/voix-consentement.md).

## Attribution

OpenClaw est MIT, © OpenClaw Foundation. Conservé dans `LICENSE` et `THIRD_PARTY_NOTICES.md`.
