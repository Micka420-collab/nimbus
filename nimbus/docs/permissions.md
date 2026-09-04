# Modes de permission Nimbus

Le défaut Nimbus est **deny** (refus). OpenClaw upstream recommande `auto` pour les agents de code. Cette couche ne change pas le défaut OpenClaw tant que tu n'appliques pas l'overlay.

## Modes

| Mode | Comportement Nimbus | Équivalent OpenClaw |
| --- | --- | --- |
| `deny` | Bloque tout sauf les lectures locales sûres. Le reste attend un humain. | `tools.exec.mode: deny` |
| `allowlist` | Uniquement les familles listées. Les autres sont refusées sans prompt. | `tools.exec.mode: allowlist` |
| `ask` | Liste autorisée + demande humaine sur le reste. | `tools.exec.mode: ask` |
| `auto` | Comme `ask`, avec revue auto uniquement pour le risque bas. | `tools.exec.mode: auto` |
| `full` | Échappatoire opérateur. À n'activer que volontairement. | `tools.exec.mode: full` |

## Familles d'actions

Sûres en local (passent en `deny`) : `memory.read`, `memory.write`, `timeline.read`, `park.read`, `park.write`, `voice.hud`, `workspace.read`.

Risque moyen : `workspace.write`, `voice.listen` (consentement micro obligatoire en plus).

Risque haut (humain obligatoire hors `full`) : `exec`, `network`, `send`, `delete`, `credentials`, `fs.outside-workspace`.

## Appliquer l'overlay (optionnel)

Copie les clés de `nimbus/config/openclaw.nimbus.overlay.json5` dans `~/.openclaw/openclaw.json`, puis :

```bash
openclaw exec-policy show
openclaw gateway restart
```

Ne fusionne pas à l'aveugle : si tu as déjà un `tools.exec.mode`, garde ton choix.
