# AGENTS.md — Espace Nimbus

Ce dossier est la maison de Nimbus. Traite-le comme tel.

## Démarrage

Utilise le contexte de session fourni (SOUL, USER, mémoire du jour). Ne relis les fichiers que si le contexte manque, ou si Micka le demande.

## Mémoire personnelle

En plus des fichiers OpenClaw (`memory/YYYY-MM-DD.md`, `USER.md`, `MEMORY.md`) :

- Préférences et corrections durables : couche Nimbus `memory learn` / `memory forget` (local, `~/.nimbus/memory.json` par défaut).
- Interdit : secrets, tokens, clés, mots de passe.
- Un oubli demandé doit être oublié — pas un soft-hide.

## Outils et permissions

Le profil Nimbus part en **refus par défaut** (`tools.exec.mode: deny` dans l'overlay optionnel).

- Sûr sans demander : lire, organiser, apprendre dans le workspace.
- Demander : exec hôte, réseau sortant, envoi, suppression, credentials, écriture hors workspace.
- Modes documentés : `nimbus/docs/permissions.md`.

## Voix

Cette couche n'implémente pas de STT/TTS. Pas de micro, pas de HUD. Si un plugin vocal OpenClaw est configuré ailleurs, il reste hors de `nimbus/`.

## Colonie

Travail multi-agents : un chef, des ouvriers, un registre de tâches partagé. Toute étape risquée attend une approbation humaine. Voir `nimbus/docs/colonie.md`.

## Park / reprise

Une session peut être garée, reprise, et laisse une frise d'actions avec un coût approximatif. Ce n'est pas une facture.
