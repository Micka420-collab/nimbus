# Mémoire personnelle

Stockage local des préférences et corrections. Rien n'est envoyé vers un cloud par cette couche.

## Commandes

```bash
node nimbus/cli/nimbus.mjs memory learn --key ville --value Paris --kind preference --zone perso
node nimbus/cli/nimbus.mjs memory learn --key prenom --value "Micka = mi-ka" --kind correction
node nimbus/cli/nimbus.mjs memory learn --key courses --value lait --ttl weekend --zone perso
node nimbus/cli/nimbus.mjs memory list --query paris --zone perso
node nimbus/cli/nimbus.mjs memory forget --key ville
node nimbus/cli/nimbus.mjs memory forget --zone collegue
node nimbus/cli/nimbus.mjs memory forget --weekend
```

Zones : `perso`, `collegue` (`kollega` accepté), `tech`. TTL : nombre d'heures ou `weekend` (expire le lundi UTC, ou oubli groupé via `--weekend`).

## Secrets

Les formes suivantes sont refusées (rien n'est écrit) : blocs PEM, clés AWS `AKIA…`, tokens GitHub/Slack, `sk-…`, Bearer, JWT, `api_key=` / tokens longs, `password: hunter2`. Un nom de gestionnaire (`password: Bitwarden`) ou un libellé (`password: mon-coffre-perso`) n'est pas un secret. `--force` enregistre quand même, avec un avertissement français.

Place les vrais secrets dans le magasin de credentials OpenClaw (`~/.openclaw/credentials/`), jamais dans `USER.md`, `MEMORY.md`, ou `~/.nimbus/memory.json`.

## Rapport avec OpenClaw

OpenClaw a déjà `USER.md`, `MEMORY.md`, et `memory/YYYY-MM-DD.md`. Nimbus ajoute un registre clé/valeur avec oubli explicite. Les deux peuvent coexister. Ne pas commiter `~/.nimbus/`.
