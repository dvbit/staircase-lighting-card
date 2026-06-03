# Staircase Lighting Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://github.com/hacs/integration)

Custom Lovelace card for the [Staircase Lighting](https://github.com/dvbit/staircase-lighting) integration.

![card preview](https://raw.githubusercontent.com/dvbit/staircase-lighting-card/main/screenshots/card.png)

## Installation

### HACS (recommended)

1. Open HACS → Frontend → three-dot menu → Custom repositories
2. Add `https://github.com/dvbit/staircase-lighting-card` as **Dashboard**
3. Search "Staircase Lighting Card" and install
4. Refresh the browser (Ctrl+F5)

### Manual

1. Download `staircase-lighting-card.js` from the [latest release](https://github.com/dvbit/staircase-lighting-card/releases)
2. Copy to `/config/www/staircase-lighting-card.js`
3. Go to **Settings → Dashboards → Resources** (three-dot menu)
4. Add resource: `/local/staircase-lighting-card.js` — Type: **JavaScript Module**

## Configuration

```yaml
type: custom:staircase-lighting-card
title: Scala Piano 1              # display name shown under icon
name: scala_piano_1               # entity prefix (slugified device name)
light_icon: mdi:ceiling-light     # optional, default: mdi:stairs
```

| Option | Type | Default | Description |
|---|---|---|---|
| `title` | string | same as `name` | Display name shown under the icon |
| `name` | string | **required** | Slugified device name (entity prefix) |
| `light_icon` | string | `mdi:stairs` | Custom icon for the light |

### Entity Override

If HA generated entity IDs different from the defaults, override any entity:

```yaml
type: custom:staircase-lighting-card
title: Scala Piano 1
name: scala_piano_1
entities:
  brightness_dim: number.scala_piano_1_dim_brightness
  lights: switch.scala_piano_1_luci
```

Available keys: `state`, `mode`, `time_remaining`, `current_brightness`, `ambient_lux`, `motion_bottom`, `motion_top`, `turn_off_delay`, `brightness`, `brightness_dim`, `lux_threshold`, `lux_control`, `lights`, `set_lux_threshold`

### Finding your device name

Go to **Settings → Devices & Services → Staircase Lighting** and look at the entity IDs. If you see `sensor.scala_piano_1_state`, your `name` is `scala_piano_1`.

If some entities show as "Not found" in the card, check the actual entity IDs in HA and use the `entities` override.

## Card Layout

- **Top**: progress bar showing time remaining until lights off (green → yellow → red). Hidden when idle.
- **Center**: large staircase icon — **yellow** when lights on, **gray** when off. **Tap** to toggle lights on/off.
- **Below center**: current mode (Normal/Dim) and brightness percentage.
- **Bottom-left**: motion sensor icons (▼ bottom, ▲ top) — colored when motion detected. **Tap** to open entity detail.
- **Bottom-center**: lux icon + value. **Tap** to open entity detail.
- **Bottom-right**: settings gear — **tap** to open configuration popup.

## Settings Popup

The popup provides real-time adjustment of all parameters:

- Turn-off delay (slider)
- Normal brightness (slider)
- Dim brightness (slider)
- Lux threshold (slider)
- Lux control toggle (on/off)
- "Set threshold to current lux" button

## Requirements

- [Staircase Lighting](https://github.com/dvbit/staircase-lighting) integration installed and configured

## License

MIT
