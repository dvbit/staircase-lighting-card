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
name: hall_stairs       # slugified device name (as in entity IDs)
```

| Option | Type | Default | Description |
|---|---|---|---|
| `name` | string | **required** | Slugified device name (the part before `_state` in `sensor.<name>_state`) |
| `icon` | string | `mdi:stairs` | Main icon |

### Finding your device name

Go to **Settings → Devices & Services → Staircase Lighting** and look at the entity IDs. If you see `sensor.scala_piano_1_state`, your `name` is `scala_piano_1`.

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
