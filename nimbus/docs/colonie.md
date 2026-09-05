# Mode colonie

Concepts inspirés d'une ruche (lead / ouvriers / registre), **réimplémentés from scratch**. Aucun code Hive n'a été copié.

## Rôles

- **Chef** (`lead`) : crée les tâches, assigne, propose des étapes.
- **Ouvrier** (`worker`) : porte une tâche. Ne force pas une étape risquée.
- **Humain** : seul à approuver `exec`, `network`, `send`, `delete`, credentials, écriture hors workspace.

## Registre

Fichier local `colony-ledger.json` dans `NIMBUS_STATE_DIR` (défaut `~/.nimbus`). Ce n'est pas l'état runtime OpenClaw.

## Flux

1. `colony worker` / `colony task` / `colony assign`
2. `colony step --action exec` → statut `needs_approval`
3. `colony decide --verdict approve|reject`
4. `colony run` refuse tant que ce n'est pas `ready`

Les écritures mémoire locales peuvent passer sans approbation. Un score de confiance élevé peut passer une action *medium* en `ready` ; le risque haut reste humain en `deny`. Voir `nimbus/test/colony.test.js` et `nimbus/test/trust.test.js`.
