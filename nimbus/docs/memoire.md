# Mémoire personnelle

Stockage local des préférences et corrections. Rien n'est envoyé vers un cloud par cette couche.

## Commandes

```bash
node nimbus/cli/nimbus.mjs memory learn --key ville --value Paris --kind preference
node nimbus/cli/nimbus.mjs memory learn --key prenom --value "Micka = mi-ka" --kind correction
node nimbus/cli/nimbus.mjs memory list --query paris
node nimbus/cli/nimbus.mjs memory forget --key ville
```

## Secrets

Les formes suivantes sont refusées (rien n'est écrit) : blocs PEM, clés AWS `AKIA…`, tokens GitHub/Slack, `sk-…`, Bearer, JWT, `password=` / `api_key=`.

Place les vrais secrets dans le magasin de credentials OpenClaw (`~/.openclaw/credentials/`), jamais dans `USER.md`, `MEMORY.md`, ou `~/.nimbus/memory.json`.

## Rapport avec OpenClaw

OpenClaw a déjà `USER.md`, `MEMORY.md`, et `memory/YYYY-MM-DD.md`. Nimbus ajoute un registre clé/valeur avec oubli explicite. Les deux peuvent coexister. Ne pas commiter `~/.nimbus/`.
