# Innovations Nimbus (couche locale)

Tout ceci vit dans `nimbus/`. Rien n'est branché en dur dans OpenClaw `src/`.

| Module | Démo locale | Stub / limite |
| --- | --- | --- |
| Anticipation calibrée | hints + notes utile/pas utile + anti-spam | Pas de vrai Google Calendar ; tu pousses les stubs |
| Jumeau de stack | graphe JSON + simulation d'impact | Ne parle pas à Docker/systemd |
| Oubli volontaire | TTL, zones, forget-weekend | Pas de sync cloud (volontaire) |
| Voix pièce | bureau/salon changent zone/outils | HUD + consentement ; pas de STT réseau |
| Skills autogen | brouillon après N succès, bac à sable deny-exec | Pas d'écriture dans `skills/` OpenClaw tant que tu n'approuves pas |
| Débat | sécurité vs vitesse, Reine + humain | Les arguments sont saisis, pas générés par un LLM ici |
| Continuum offline | file + résumé à la reco | « Offline » est un drapeau local, pas un vrai detect réseau |
| Confiance outils | score sur approbations | Jamais d'auto-exec à risque haut en deny |

Commandes : `node nimbus/cli/nimbus.mjs help`.
