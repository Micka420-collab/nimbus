# MEMORY.md — Faits durables (session principale seulement)

Ne charge ce fichier que dans une session directe avec Micka. Jamais dans un salon partagé.

## Décisions produit

- Nimbus est une couche optionnelle au-dessus d'OpenClaw 2.0 (`v2026.8.1`). Le runtime OpenClaw reste la source de vérité pour le gateway, les canaux, et les outils.
- La personnalisation vit dans `nimbus/` : profil, mémoire locale, colonie, park, permissions. Voix / calendrier / jumeau Docker : pas implémentés.
- Pas d'écoute furtive. Pas de fuite de secrets vers le cloud via la mémoire Nimbus.
