/**
 * Staircase Lighting Card v1 - Custom Lovelace Card
 *
 * Layout:
 *   TOP:           progress bar (time remaining) + timer icon. Hidden when idle.
 *   CENTER:        large light icon, colored by on/off state. Tap = toggle lights.
 *   BELOW CENTER:  mode label (Normal/Dim) + brightness %
 *   BOTTOM-LEFT:   motion bottom + motion top icons (colored when active)
 *   BOTTOM-CENTER: lux icon + value
 *   BOTTOM-RIGHT:  settings gear → popup modal with all parameters
 *
 * YAML config:
 *   type: custom:staircase-lighting-card
 *   name: scala_piano_1          # slugified device name (entity prefix)
 *   icon: mdi:stairs             # optional, default mdi:stairs
 *
 * Installation:
 *   1. Copy staircase-lighting-card.js to /config/www/
 *   2. Resources → /local/staircase-lighting-card.js → JavaScript Module
 */

class StaircaseLightingCard extends HTMLElement {

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._config = null;
    this._entities = {};
    this._rendered = false;
    this._timer = null;
    this._modalOpen = false;
  }

  /* ── Config ─────────────────────────────────────────────── */

  setConfig(config) {
    if (!config.name) throw new Error("'name' is required (slugified device name)");

    this._config = config;
    this._lightIcon = config.icon || "mdi:stairs";

    var n = config.name;
    this._entities = {
      state:              "sensor." + n + "_state",
      mode:               "sensor." + n + "_mode",
      time_remaining:     "sensor." + n + "_time_remaining",
      current_brightness: "sensor." + n + "_current_brightness",
      ambient_lux:        "sensor." + n + "_ambient_lux",
      motion_bottom:      "binary_sensor." + n + "_motion_bottom",
      motion_top:         "binary_sensor." + n + "_motion_top",
      turn_off_delay:     "number." + n + "_turn_off_delay",
      brightness:         "number." + n + "_brightness",
      brightness_dim:     "number." + n + "_brightness_dim",
      lux_threshold:      "number." + n + "_lux_threshold",
      lux_control:        "switch." + n + "_lux_control",
      lights:             "switch." + n + "_lights",
      set_lux_threshold:  "button." + n + "_set_lux_threshold"
    };

    this._rendered = false;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    if (!this._rendered) this._buildDom();
    this._refresh();
  }

  getCardSize() { return 3; }

  /* ── Lifecycle ──────────────────────────────────────────── */

  connectedCallback() {
    var self = this;
    // 1-second refresh for progress bar countdown
    this._timer = setInterval(function() {
      if (self._hass && self._rendered) self._refreshBar();
    }, 1000);
  }

  disconnectedCallback() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  /* ── State helpers ──────────────────────────────────────── */

  _st(id) {
    if (!this._hass || !this._hass.states || !this._hass.states[id]) return "unavailable";
    return this._hass.states[id].state;
  }

  _num(id) {
    var v = parseFloat(this._st(id));
    return isNaN(v) ? 0 : v;
  }

  _isOn(id) { return this._st(id) === "on"; }

  /* ── DOM build ──────────────────────────────────────────── */

  _buildDom() {
    var shadow = this.shadowRoot;
    shadow.innerHTML = "";

    // --- Styles ---
    var style = document.createElement("style");
    style.textContent = this._getStyles();
    shadow.appendChild(style);

    // --- Card container ---
    var card = document.createElement("ha-card");
    card.innerHTML =
      '<div class="sl-card">' +
        // Progress bar area (top)
        '<div class="sl-bar-area" id="barArea">' +
          '<div class="sl-bar-track">' +
            '<div class="sl-bar-fill" id="barFill"></div>' +
          '</div>' +
          '<div class="sl-bar-time" id="barTime"></div>' +
        '</div>' +

        // Center light icon
        '<div class="sl-center" id="centerBtn">' +
          '<ha-icon id="lightIcon" icon="' + this._lightIcon + '"></ha-icon>' +
        '</div>' +

        // Mode + brightness label
        '<div class="sl-mode" id="modeLabel"></div>' +

        // Bottom status row
        '<div class="sl-bottom">' +
          // Left: motion icons
          '<div class="sl-status-left">' +
            '<div class="sl-status-icon" id="motionBottomBtn" title="Motion Bottom">' +
              '<ha-icon id="motionBottomIcon" icon="mdi:arrow-down-bold"></ha-icon>' +
              '<span class="sl-status-label">▼</span>' +
            '</div>' +
            '<div class="sl-status-icon" id="motionTopBtn" title="Motion Top">' +
              '<ha-icon id="motionTopIcon" icon="mdi:arrow-up-bold"></ha-icon>' +
              '<span class="sl-status-label">▲</span>' +
            '</div>' +
          '</div>' +

          // Center: lux
          '<div class="sl-status-center" id="luxBtn">' +
            '<ha-icon id="luxIcon" icon="mdi:brightness-5"></ha-icon>' +
            '<span class="sl-status-label" id="luxValue"></span>' +
          '</div>' +

          // Right: settings
          '<div class="sl-status-right">' +
            '<div class="sl-settings-btn" id="settingsBtn">' +
              '<ha-icon icon="mdi:cog"></ha-icon>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // Modal overlay (hidden by default)
      '<div class="sl-modal-overlay" id="modalOverlay">' +
        '<div class="sl-modal">' +
          '<div class="sl-modal-header">' +
            '<span class="sl-modal-title">Settings</span>' +
            '<div class="sl-modal-close" id="modalClose">' +
              '<ha-icon icon="mdi:close"></ha-icon>' +
            '</div>' +
          '</div>' +
          '<div class="sl-modal-body" id="modalBody"></div>' +
        '</div>' +
      '</div>';

    shadow.appendChild(card);

    // --- Event listeners ---
    var self = this;

    // Center icon tap → toggle lights switch
    shadow.getElementById("centerBtn").addEventListener("click", function() {
      self._toggleLights();
    });

    // Motion icons → open more-info
    shadow.getElementById("motionBottomBtn").addEventListener("click", function() {
      self._moreInfo(self._entities.motion_bottom);
    });
    shadow.getElementById("motionTopBtn").addEventListener("click", function() {
      self._moreInfo(self._entities.motion_top);
    });

    // Lux icon → open more-info
    shadow.getElementById("luxBtn").addEventListener("click", function() {
      self._moreInfo(self._entities.ambient_lux);
    });

    // Settings → open modal
    shadow.getElementById("settingsBtn").addEventListener("click", function() {
      self._openModal();
    });

    // Modal close
    shadow.getElementById("modalClose").addEventListener("click", function() {
      self._closeModal();
    });

    // Overlay click → close modal
    shadow.getElementById("modalOverlay").addEventListener("click", function(e) {
      if (e.target.id === "modalOverlay") self._closeModal();
    });

    this._rendered = true;
  }

  /* ── Refresh ────────────────────────────────────────────── */

  _refresh() {
    if (!this._rendered) return;
    var shadow = this.shadowRoot;

    // --- State ---
    var stState = this._st(this._entities.state);
    var stMode = this._st(this._entities.mode);
    var isActive = stState === "active";
    var isLightsOn = this._isOn(this._entities.lights);

    // --- Center icon color ---
    var lightIcon = shadow.getElementById("lightIcon");
    if (isActive || isLightsOn) {
      lightIcon.style.color = "var(--state-light-active-color, #fdd835)";
    } else {
      lightIcon.style.color = "var(--state-icon-color, #9e9e9e)";
    }

    // --- Mode + brightness label ---
    var brPct = this._num(this._entities.current_brightness);
    var modeLabel = shadow.getElementById("modeLabel");
    if (isActive || isLightsOn) {
      var modeTxt = stMode === "dim" ? "Dim" : "Normal";
      modeLabel.textContent = modeTxt + " · " + brPct + "%";
      modeLabel.style.color = "var(--primary-text-color)";
    } else {
      modeLabel.textContent = "Idle";
      modeLabel.style.color = "var(--secondary-text-color)";
    }

    // --- Motion icons ---
    var mbIcon = shadow.getElementById("motionBottomIcon");
    var mtIcon = shadow.getElementById("motionTopIcon");
    mbIcon.style.color = this._isOn(this._entities.motion_bottom)
      ? "var(--state-binary_sensor-active-color, #fdd835)"
      : "var(--state-icon-color, #9e9e9e)";
    mtIcon.style.color = this._isOn(this._entities.motion_top)
      ? "var(--state-binary_sensor-active-color, #fdd835)"
      : "var(--state-icon-color, #9e9e9e)";

    // --- Lux ---
    var luxIcon = shadow.getElementById("luxIcon");
    var luxValue = shadow.getElementById("luxValue");
    var luxNum = this._num(this._entities.ambient_lux);
    var luxThreshold = this._num(this._entities.lux_threshold);
    luxValue.textContent = luxNum + " lx";
    if (luxNum < luxThreshold) {
      // Below threshold → dark/opaque icon (lights would turn on)
      luxIcon.style.color = "var(--state-icon-color, #9e9e9e)";
      luxIcon.style.opacity = "0.5";
    } else {
      // Above threshold → bright icon (enough light)
      luxIcon.style.color = "var(--state-light-active-color, #fdd835)";
      luxIcon.style.opacity = "1";
    }

    // --- Progress bar ---
    this._refreshBar();

    // --- Update modal if open ---
    if (this._modalOpen) this._refreshModal();
  }

  _refreshBar() {
    if (!this._rendered) return;
    var shadow = this.shadowRoot;
    var barArea = shadow.getElementById("barArea");
    var barFill = shadow.getElementById("barFill");
    var barTime = shadow.getElementById("barTime");

    var remaining = this._num(this._entities.time_remaining);
    var total = this._num(this._entities.turn_off_delay);

    if (remaining <= 0 || total <= 0) {
      barArea.style.display = "none";
      return;
    }

    barArea.style.display = "flex";
    var pct = Math.min(100, (remaining / total) * 100);
    barFill.style.width = pct + "%";

    // Color: green > yellow > red as time decreases
    if (pct > 50) {
      barFill.style.backgroundColor = "var(--success-color, #4caf50)";
    } else if (pct > 20) {
      barFill.style.backgroundColor = "var(--warning-color, #ff9800)";
    } else {
      barFill.style.backgroundColor = "var(--error-color, #f44336)";
    }

    // Format mm:ss
    var m = Math.floor(remaining / 60);
    var s = Math.round(remaining % 60);
    barTime.textContent = m + ":" + (s < 10 ? "0" : "") + s;
  }

  /* ── Actions ────────────────────────────────────────────── */

  _toggleLights() {
    if (!this._hass) return;
    var isOn = this._isOn(this._entities.lights);
    this._hass.callService("switch", isOn ? "turn_off" : "turn_on", {
      entity_id: this._entities.lights
    });
  }

  _moreInfo(entityId) {
    var ev = new Event("hass-more-info", { bubbles: true, composed: true });
    ev.detail = { entityId: entityId };
    this.dispatchEvent(ev);
  }

  /* ── Modal ──────────────────────────────────────────────── */

  _openModal() {
    this._modalOpen = true;
    var overlay = this.shadowRoot.getElementById("modalOverlay");
    overlay.style.display = "flex";
    this._buildModalContent();
  }

  _closeModal() {
    this._modalOpen = false;
    var overlay = this.shadowRoot.getElementById("modalOverlay");
    overlay.style.display = "none";
  }

  _buildModalContent() {
    var body = this.shadowRoot.getElementById("modalBody");
    var self = this;
    body.innerHTML = "";

    // --- Parameter rows ---
    var params = [
      { entity: this._entities.turn_off_delay,  label: "Turn-off delay",  icon: "mdi:timer-outline",     unit: "s",  min: 10,  max: 300, step: 10 },
      { entity: this._entities.brightness,       label: "Brightness",      icon: "mdi:brightness-7",      unit: "%",  min: 1,   max: 100, step: 1 },
      { entity: this._entities.brightness_dim,   label: "Dim brightness",  icon: "mdi:brightness-5",      unit: "%",  min: 1,   max: 100, step: 1 },
      { entity: this._entities.lux_threshold,    label: "Lux threshold",   icon: "mdi:weather-sunny",     unit: "lx", min: 0,   max: 1000, step: 10 }
    ];

    for (var i = 0; i < params.length; i++) {
      body.appendChild(this._buildSliderRow(params[i]));
    }

    // --- Lux control switch ---
    var luxRow = document.createElement("div");
    luxRow.className = "sl-modal-row";
    var luxOn = this._isOn(this._entities.lux_control);
    luxRow.innerHTML =
      '<div class="sl-modal-row-header">' +
        '<ha-icon icon="mdi:theme-light-dark" style="color:var(--primary-text-color);--mdc-icon-size:20px;"></ha-icon>' +
        '<span class="sl-modal-row-label">Lux control</span>' +
      '</div>' +
      '<div class="sl-modal-toggle" id="luxToggle">' +
        '<div class="sl-toggle-track ' + (luxOn ? "on" : "") + '">' +
          '<div class="sl-toggle-thumb"></div>' +
        '</div>' +
      '</div>';
    body.appendChild(luxRow);

    // Toggle event
    setTimeout(function() {
      var toggle = self.shadowRoot.getElementById("luxToggle");
      if (toggle) {
        toggle.addEventListener("click", function() {
          self._hass.callService("switch", luxOn ? "turn_off" : "turn_on", {
            entity_id: self._entities.lux_control
          });
        });
      }
    }, 0);

    // --- Set lux threshold button ---
    var btnRow = document.createElement("div");
    btnRow.className = "sl-modal-row sl-modal-btn-row";
    var btn = document.createElement("button");
    btn.className = "sl-modal-btn";
    btn.textContent = "Set threshold to current lux";
    btn.addEventListener("click", function() {
      self._hass.callService("button", "press", {
        entity_id: self._entities.set_lux_threshold
      });
    });
    btnRow.appendChild(btn);
    body.appendChild(btnRow);
  }

  _buildSliderRow(param) {
    var self = this;
    var currentVal = this._num(param.entity);

    var row = document.createElement("div");
    row.className = "sl-modal-row";
    row.innerHTML =
      '<div class="sl-modal-row-header">' +
        '<ha-icon icon="' + param.icon + '" style="color:var(--primary-text-color);--mdc-icon-size:20px;"></ha-icon>' +
        '<span class="sl-modal-row-label">' + param.label + '</span>' +
        '<span class="sl-modal-row-value" id="val_' + param.entity + '">' + currentVal + ' ' + param.unit + '</span>' +
      '</div>' +
      '<input type="range" class="sl-slider" ' +
        'min="' + param.min + '" max="' + param.max + '" step="' + param.step + '" ' +
        'value="' + currentVal + '" id="slider_' + param.entity + '">';

    // Slider events (debounced)
    var slider = row.querySelector("input");
    var valSpan = row.querySelector(".sl-modal-row-value");
    var debounceTimer = null;

    slider.addEventListener("input", function() {
      valSpan.textContent = this.value + " " + param.unit;
    });

    slider.addEventListener("change", function() {
      var v = parseFloat(this.value);
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function() {
        self._hass.callService("number", "set_value", {
          entity_id: param.entity,
          value: v
        });
      }, 300);
    });

    return row;
  }

  _refreshModal() {
    // Update slider values from HA state
    var params = [
      this._entities.turn_off_delay,
      this._entities.brightness,
      this._entities.brightness_dim,
      this._entities.lux_threshold
    ];
    for (var i = 0; i < params.length; i++) {
      var slider = this.shadowRoot.getElementById("slider_" + params[i]);
      if (slider && document.activeElement !== slider) {
        slider.value = this._num(params[i]);
      }
    }
    // Update lux toggle
    var toggle = this.shadowRoot.getElementById("luxToggle");
    if (toggle) {
      var track = toggle.querySelector(".sl-toggle-track");
      if (track) {
        if (this._isOn(this._entities.lux_control)) {
          track.classList.add("on");
        } else {
          track.classList.remove("on");
        }
      }
    }
  }

  /* ── Styles ─────────────────────────────────────────────── */

  _getStyles() {
    return '' +
      /* Card */
      ':host { display: block; }' +
      'ha-card { padding: 16px; position: relative; overflow: visible; }' +

      '.sl-card {' +
        'display: flex; flex-direction: column; align-items: center;' +
        'gap: 8px; min-height: 160px; position: relative;' +
      '}' +

      /* Progress bar area */
      '.sl-bar-area {' +
        'display: none; width: 100%; align-items: center; gap: 8px;' +
      '}' +
      '.sl-bar-track {' +
        'flex: 1; height: 6px; border-radius: 3px;' +
        'background: var(--divider-color, #e0e0e0);' +
        'overflow: hidden;' +
      '}' +
      '.sl-bar-fill {' +
        'height: 100%; border-radius: 3px;' +
        'transition: width 1s linear;' +
        'background: var(--success-color, #4caf50);' +
      '}' +
      '.sl-bar-time {' +
        'font-size: 12px; font-weight: 500; min-width: 36px; text-align: right;' +
        'color: var(--primary-text-color);' +
      '}' +

      /* Center icon */
      '.sl-center {' +
        'cursor: pointer; padding: 16px;' +
        'border-radius: 50%;' +
        'transition: background 0.2s;' +
      '}' +
      '.sl-center:hover { background: var(--secondary-background-color, rgba(0,0,0,0.05)); }' +
      '.sl-center:active { background: var(--divider-color, rgba(0,0,0,0.1)); }' +
      '.sl-center ha-icon {' +
        '--mdc-icon-size: 48px;' +
        'transition: color 0.3s;' +
      '}' +

      /* Mode label */
      '.sl-mode {' +
        'font-size: 14px; font-weight: 500;' +
        'letter-spacing: 0.5px;' +
      '}' +

      /* Bottom row */
      '.sl-bottom {' +
        'display: flex; width: 100%; align-items: center;' +
        'justify-content: space-between; margin-top: 8px;' +
      '}' +
      '.sl-status-left { display: flex; gap: 12px; }' +
      '.sl-status-center {' +
        'display: flex; align-items: center; gap: 4px; cursor: pointer;' +
      '}' +
      '.sl-status-right { display: flex; }' +

      '.sl-status-icon {' +
        'display: flex; flex-direction: column; align-items: center;' +
        'cursor: pointer; padding: 4px;' +
      '}' +
      '.sl-status-icon ha-icon { --mdc-icon-size: 22px; transition: color 0.3s; }' +
      '.sl-status-label {' +
        'font-size: 10px; color: var(--secondary-text-color); margin-top: 2px;' +
      '}' +
      '.sl-status-center ha-icon { --mdc-icon-size: 22px; }' +
      '#luxValue { font-size: 11px; color: var(--secondary-text-color); }' +

      /* Settings button */
      '.sl-settings-btn {' +
        'cursor: pointer; padding: 4px;' +
        'border-radius: 50%;' +
        'transition: background 0.2s;' +
      '}' +
      '.sl-settings-btn:hover { background: var(--secondary-background-color); }' +
      '.sl-settings-btn ha-icon {' +
        '--mdc-icon-size: 22px; color: var(--secondary-text-color);' +
      '}' +

      /* Modal overlay */
      '.sl-modal-overlay {' +
        'display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0;' +
        'background: rgba(0,0,0,0.5); z-index: 999;' +
        'align-items: center; justify-content: center;' +
      '}' +
      '.sl-modal {' +
        'background: var(--card-background-color, #fff);' +
        'border-radius: 16px; padding: 0; width: 90%; max-width: 380px;' +
        'box-shadow: 0 8px 32px rgba(0,0,0,0.3);' +
        'overflow: hidden;' +
      '}' +
      '.sl-modal-header {' +
        'display: flex; justify-content: space-between; align-items: center;' +
        'padding: 16px 20px; border-bottom: 1px solid var(--divider-color, #e0e0e0);' +
      '}' +
      '.sl-modal-title {' +
        'font-size: 18px; font-weight: 600; color: var(--primary-text-color);' +
      '}' +
      '.sl-modal-close {' +
        'cursor: pointer; padding: 4px; border-radius: 50%;' +
      '}' +
      '.sl-modal-close:hover { background: var(--secondary-background-color); }' +
      '.sl-modal-close ha-icon {' +
        '--mdc-icon-size: 20px; color: var(--secondary-text-color);' +
      '}' +
      '.sl-modal-body { padding: 16px 20px; }' +

      /* Modal rows */
      '.sl-modal-row { margin-bottom: 16px; }' +
      '.sl-modal-row-header {' +
        'display: flex; align-items: center; gap: 8px; margin-bottom: 6px;' +
      '}' +
      '.sl-modal-row-label {' +
        'flex: 1; font-size: 14px; color: var(--primary-text-color);' +
      '}' +
      '.sl-modal-row-value {' +
        'font-size: 13px; font-weight: 500; color: var(--primary-color);' +
        'min-width: 50px; text-align: right;' +
      '}' +

      /* Slider */
      '.sl-slider {' +
        'width: 100%; height: 6px; border-radius: 3px; outline: none;' +
        '-webkit-appearance: none; appearance: none;' +
        'background: var(--divider-color, #e0e0e0);' +
      '}' +
      '.sl-slider::-webkit-slider-thumb {' +
        '-webkit-appearance: none; width: 20px; height: 20px;' +
        'border-radius: 50%; background: var(--primary-color, #03a9f4);' +
        'cursor: pointer; border: none;' +
      '}' +
      '.sl-slider::-moz-range-thumb {' +
        'width: 20px; height: 20px; border-radius: 50%;' +
        'background: var(--primary-color, #03a9f4);' +
        'cursor: pointer; border: none;' +
      '}' +

      /* Toggle */
      '.sl-modal-toggle { cursor: pointer; display: inline-block; }' +
      '.sl-toggle-track {' +
        'width: 44px; height: 22px; border-radius: 11px;' +
        'background: var(--divider-color, #bdbdbd);' +
        'position: relative; transition: background 0.2s;' +
      '}' +
      '.sl-toggle-track.on {' +
        'background: var(--primary-color, #03a9f4);' +
      '}' +
      '.sl-toggle-thumb {' +
        'width: 18px; height: 18px; border-radius: 50%;' +
        'background: #fff; position: absolute; top: 2px; left: 2px;' +
        'transition: left 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.3);' +
      '}' +
      '.sl-toggle-track.on .sl-toggle-thumb { left: 24px; }' +

      /* Button */
      '.sl-modal-btn-row { text-align: center; margin-top: 8px; padding-top: 12px;' +
        'border-top: 1px solid var(--divider-color, #e0e0e0); }' +
      '.sl-modal-btn {' +
        'padding: 8px 20px; border: none; border-radius: 8px;' +
        'background: var(--primary-color, #03a9f4); color: #fff;' +
        'font-size: 13px; font-weight: 500; cursor: pointer;' +
        'transition: opacity 0.2s;' +
      '}' +
      '.sl-modal-btn:hover { opacity: 0.85; }' +
      '.sl-modal-btn:active { opacity: 0.7; }' +
    '';
  }
}

/* ── Registration ─────────────────────────────────────────── */

customElements.define("staircase-lighting-card", StaircaseLightingCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "staircase-lighting-card",
  name: "Staircase Lighting Card",
  description: "Card for the Staircase Lighting integration with status icons and settings popup",
  preview: false
});

console.info(
  "%c STAIRCASE-LIGHTING-CARD v1 ",
  "color:#fff;background:#4285f4;font-weight:bold;padding:2px 6px;border-radius:4px;"
);
