---
name: home-assistant
description: "Read and control Home Assistant entities, call services, and author automations that survive upgrades."
homepage: https://developers.home-assistant.io/docs/api/rest/
metadata:
  {
    "openclaw":
      {
        "emoji": "🏠",
        "requires":
          { "anyBins": ["hass-cli", "curl"], "env": ["HASS_SERVER", "HASS_TOKEN"] },
        "primaryEnv": "HASS_TOKEN",
        "install":
          [
            {
              "id": "uv",
              "kind": "uv",
              "package": "homeassistant-cli",
              "bins": ["hass-cli"],
              "label": "Install Home Assistant CLI (uv)",
            },
          ],
      },
  }
---

# Home Assistant

Prefer `hass-cli`. Use `curl` against the REST API when `hass-cli` is missing or a raw
request is clearer.

`HASS_SERVER` is the base URL (`http://homeassistant.local:8123`). `HASS_TOKEN` is a
long-lived access token from the user's HA profile page. Both are read by `hass-cli` and
by every curl example below. Never print the token, and never paste it into a file the
user did not ask for.

## When to Use

- Reading device or sensor state ("is the garage open?", "how cold is the bedroom?")
- Turning things on/off, setting brightness, temperature, covers, media
- Writing or repairing automations, scripts, scenes, helpers, dashboards
- Explaining why an automation did or did not fire

## When NOT to Use

- Philips Hue only, with no HA bridge -> the Hue CLI is more direct
- A device not exposed to Home Assistant -> integrate it in HA first
- Editing HA's own `configuration.yaml` on a host you cannot reach

## Never guess an entity id

Half of all broken automations are a typo in an entity id. Resolve the real id before
acting.

```bash
# hass-cli
hass-cli state list
hass-cli state list | grep -i salon

# curl
curl -sS -H "Authorization: Bearer $HASS_TOKEN" "$HASS_SERVER/api/states" \
  | jq -r '.[].entity_id' | grep -i salon
```

If the search returns several plausible matches, ask which one — do not pick the first.

## Read state

```bash
hass-cli state get light.salon

curl -sS -H "Authorization: Bearer $HASS_TOKEN" "$HASS_SERVER/api/states/light.salon"
```

`state` is the value; `attributes` carries brightness, temperature, position, and the
friendly name. An entity that answers `unavailable` or `unknown` is not off — it is not
reporting, which is a different problem and usually the real one.

## Call a service

```bash
hass-cli service call light.turn_on \
  --arguments entity_id=light.salon,brightness_pct=40

curl -sS -X POST \
  -H "Authorization: Bearer $HASS_TOKEN" -H "Content-Type: application/json" \
  -d '{"entity_id":"light.salon","brightness_pct":40}' \
  "$HASS_SERVER/api/services/light/turn_on"
```

The response returns `changed_states` — the states HA wrote, not proof the device obeyed.
For anything physical, read the entity again a moment later and report that value.

## Render a template

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $HASS_TOKEN" -H "Content-Type: application/json" \
  -d '{"template":"{{ states(\"sensor.temperature_salon\") }}"}' \
  "$HASS_SERVER/api/template"
```

## Check the config before telling the user to restart

```bash
curl -sS -X POST -H "Authorization: Bearer $HASS_TOKEN" \
  "$HASS_SERVER/api/config/core/check_config"
```

## Authoring rules

Use native constructs. Templates bypass validation, fail silently at runtime, and turn a
readable automation into something only its author can debug.

1. Reach for a purpose-specific trigger/condition first, then a generic native one, then
   a template — in that order.
2. Prefer a built-in helper or a Template Helper over a template sensor.
3. Pick `mode` deliberately: `single`, `restart`, `queued`, `parallel`. The default is
   `single` and it is wrong more often than not.
4. Target `entity_id`, not `device_id`.
5. For buttons and remotes, trigger on the integration's event rather than polling state.

### Anti-patterns

| Instead of | Do this |
| --- | --- |
| A template condition comparing floats | `numeric_state` condition — validated when the automation loads |
| `wait_template` polling a state | `wait_for_trigger` — event-driven, no polling |
| `device_id` in a trigger or action | `entity_id` — device ids change when a device is re-added |
| `mode: single` on a motion light | `mode: restart` so re-triggering resets the timer |
| A template sensor summing entities | A `min_max` helper — it handles `unavailable` members |
| Renaming entities in place | Search the whole config for the old id first, then rename |
| The same Jinja copy-pasted across templates | One macro in `custom_templates/*.jinja` |

## Physical actions need a human

Locks, garage doors, gates, alarm arm/disarm, heating setpoints, water valves — anything
in `lock.`, `cover.`, `alarm_control_panel.`, `climate.`, `valve.`, `switch.` wired to a
real actuator — gets an explicit confirmation before the call, naming the exact entity and
the state you are about to set. Reading those entities is free and needs no confirmation.

Never unlock or disarm anything on an inference. "The user is probably home" is not a
reason.
