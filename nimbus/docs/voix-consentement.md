# Conversation vocale — modèle de consentement

Nimbus n'écoute jamais en silence.

## États visibles (obligatoires)

L'interface doit afficher en permanence l'un de ces états, en français :

| État interne | Libellé | Micro |
| --- | --- | --- |
| `muted` | Micro coupé | inactif |
| `listening` | Écoute | actif, consentement déjà donné |
| `thinking` | Réflexion | inactif (traitement) |
| `speaking` | Parole | actif seulement si le barge-in est armé, et c'est écrit à l'écran |

Le HUD expose aussi **Micro actif** / **Micro inactif**. Si le micro est actif pendant la parole (barge-in), ce n'est pas caché.

## Consentement

1. Session démarre en **Micro coupé**.
2. L'opérateur appuie sur un contrôle explicite (« Autoriser l'écoute »).
3. Le navigateur / l'OS demande encore sa permission micro — Nimbus ne la contourne pas.
4. Retirer le consentement coupe le micro tout de suite.
5. Le consentement ne survit pas à la session. Pas de réveil, pas d'écoute de fond, pas de mot-clé caché.

## Pipeline

`STT (flux)` → agent → `TTS (flux)`.

- Les partiels STT restent dans l'état Écoute.
- Un énoncé final passe en Réflexion.
- La réponse passe en Parole.
- Parler par-dessus (barge-in) interrompt le TTS et revient à Écoute — uniquement pendant une session déjà consentie.

Cette couche est une **machine d'états**. Le STT/TTS réel vient des plugins vocaux OpenClaw déjà présents (ElevenLabs, Deepgram, Azure Speech, etc.) quand tu les configures. Nimbus n'ajoute pas de micro furtif ni de client vocal « toujours allumé ».

## Démo sans micro

```bash
node nimbus/cli/nimbus.mjs voice demo
```

Ouvre `nimbus/ui/voix.html` dans un navigateur pour le HUD. Le micro du navigateur n'est demandé qu'après le bouton **Autoriser l'écoute**.

## Pièces (bureau / salon)

Changer de pièce change la zone mémoire et les outils par défaut. **Ça ne démarre jamais le micro.** La session reste en Micro coupé jusqu'au consentement explicite.
