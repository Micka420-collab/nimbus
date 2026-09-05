# Modes de permission Nimbus

Le défaut Nimbus est **deny**. OpenClaw upstream recommande souvent `auto` pour les agents de code. Cette couche ne change pas le défaut OpenClaw tant que tu n'appliques pas l'overlay.

## Modes

| Mode | Comportement Nimbus | Équivalent OpenClaw |
| --- | --- | --- |
| `deny` | Bloque tout sauf les lectures/écritures locales sûres. Le reste attend un humain. | `tools.exec.mode: deny` |
| `allowlist` | Uniquement les familles listées. Les autres sont refusées sans prompt. | `tools.exec.mode: allowlist` |
| `ask` | Liste autorisée + demande humaine sur le reste. | `tools.exec.mode: ask` |
| `auto` | Comme `ask`, avec revue auto uniquement pour le risque bas. | `tools.exec.mode: auto` |
| `full` | Échappatoire opérateur. À n'activer que volontairement. | `tools.exec.mode: full` |

## Familles d'actions

Sûres en local (passent en `deny`) : `memory.read`, `memory.write`, `timeline.read`, `park.read`, `park.write`, `workspace.read`.

Risque moyen : `workspace.write`.

Risque haut (humain obligatoire hors `full`) : `exec`, `network`, `send`, `delete`, `credentials`, `fs.outside-workspace`.

## Appliquer l'overlay

```bash
node nimbus/cli/nimbus.mjs permissions apply --config ~/.openclaw/openclaw.json
node nimbus/cli/nimbus.mjs permissions apply --config ~/.openclaw/openclaw.json --workspace ~/.openclaw/workspace
```

- Crée le fichier s'il n'existe pas.
- Si `tools.exec.mode` est déjà défini, il est **conservé**. `--force` l'écrase.
- La fusion réécrit le fichier en JSON (les commentaires JSON5 sont perdus).
- Après ça : `openclaw exec-policy show` puis `openclaw gateway restart` si le gateway tourne.

Le fichier `nimbus/config/openclaw.nimbus.overlay.json5` est la forme documentaire du même overlay, pas un second chemin d'application.
