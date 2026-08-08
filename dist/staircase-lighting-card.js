/**
 * Staircase Lighting Card v2
 *
 * Config:
 *   type: custom:staircase-lighting-card
 *   title: Scala Piano 1              # display name shown under icon
 *   name: scala_piano_1               # entity prefix (slugified device name)
 *   light_icon: mdi:ceiling-light     # optional, default mdi:stairs
 *
 * Entity IDs are auto-derived from 'name'. If HA generated different IDs,
 * override any entity individually:
 *   entities:
 *     brightness_dim: number.scala_piano_1_dim_brightness
 */

class StaircaseLightingCard extends HTMLElement {

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._config = null;
    this._ent = {};
    this._rendered = false;
    this._tick = null;
    this._modalOpen = false;
  }

  /* ── Config ─────────────────────────────────────────────── */

  /* Slugify: lowercase, spaces/hyphens to underscores, strip non-alnum */
  _slugify(s) {
    return s.toLowerCase().replace(/[\s\-]+/g, "_").replace(/[^a-z0-9_]/g, "");
  }

  setConfig(config) {
    if (!config.name) throw new Error("'name' is required (entity prefix)");
    this._config = config;
    this._lightIcon = config.light_icon || config.icon || "mdi:stairs";
    this._title = config.title || config.name;

    // Slugify name to match HA entity_id format
    var n = this._slugify(config.name);
    var ov = config.entities || {};
    this._ent = {
      state:              ov.state              || "sensor." + n + "_state",
      mode:               ov.mode               || "sensor." + n + "_mode",
      time_remaining:     ov.time_remaining     || "sensor." + n + "_time_remaining",
      current_brightness: ov.current_brightness || "sensor." + n + "_current_brightness",
      ambient_lux:        ov.ambient_lux        || "sensor." + n + "_ambient_lux",
      motion_bottom:      ov.motion_bottom      || "binary_sensor." + n + "_motion_bottom",
      motion_top:         ov.motion_top          || "binary_sensor." + n + "_motion_top",
      turn_off_delay:     ov.turn_off_delay     || "number." + n + "_turn_off_delay",
      brightness:         ov.brightness         || "number." + n + "_brightness",
      brightness_dim:     ov.brightness_dim     || "number." + n + "_brightness_dim",
      lux_threshold:      ov.lux_threshold      || "number." + n + "_lux_threshold",
      lux_control:        ov.lux_control        || "switch." + n + "_lux_control",
      lights:             ov.lights             || "switch." + n + "_lights",
      set_lux_threshold:  ov.set_lux_threshold  || "button." + n + "_set_lux_threshold"
    };

    this._rendered = false;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    if (!this._rendered) this._build();
    this._refresh();
  }

  getCardSize() { return 3; }

  /* ── Lifecycle ──────────────────────────────────────────── */

  connectedCallback() {
    var self = this;
    this._tick = setInterval(function() {
      if (self._hass && self._rendered) self._refreshBar();
    }, 1000);
  }

  disconnectedCallback() {
    if (this._tick) { clearInterval(this._tick); this._tick = null; }
  }

  /* ── State helpers ──────────────────────────────────────── */

  _st(id) {
    if (!this._hass || !this._hass.states[id]) return null;
    return this._hass.states[id].state;
  }

  _num(id) {
    var s = this._st(id);
    if (s === null) return 0;
    var v = parseFloat(s);
    return isNaN(v) ? 0 : v;
  }

  _isOn(id) { return this._st(id) === "on"; }

  _exists(id) { return this._hass && !!this._hass.states[id]; }

  /* ── DOM build ──────────────────────────────────────────── */

  _build() {
    var sh = this.shadowRoot;
    sh.innerHTML = "";

    var style = document.createElement("style");
    style.textContent = this._css();
    sh.appendChild(style);

    var card = document.createElement("ha-card");
    card.innerHTML =
      '<div class="sc">' +
        /* progress bar */
        '<div class="bar-area" id="barArea">' +
          '<div class="bar-track"><div class="bar-fill" id="barFill"></div></div>' +
          '<div class="bar-time" id="barTime"></div>' +
        '</div>' +
        /* center icon */
        '<div class="center" id="centerBtn">' +
          '<ha-icon id="lightIcon" icon="' + this._lightIcon + '"></ha-icon>' +
        '</div>' +
        /* title */
        '<div class="title">' + this._title + '</div>' +
        /* mode + brightness */
        '<div class="mode" id="modeLabel"></div>' +
        /* bottom row */
        '<div class="bottom">' +
          '<div class="bot-left">' +
            '<div class="sicon" id="mbBtn">' +
              '<ha-icon id="mbIco" icon="mdi:motion-sensor"></ha-icon>' +
              '<span class="slbl">▼</span>' +
            '</div>' +
            '<div class="sicon" id="mtBtn">' +
              '<ha-icon id="mtIco" icon="mdi:motion-sensor"></ha-icon>' +
              '<span class="slbl">▲</span>' +
            '</div>' +
          '</div>' +
          '<div class="bot-center" id="luxBtn">' +
            '<ha-icon id="luxIco" icon="mdi:brightness-5"></ha-icon>' +
            '<span class="slbl" id="luxVal"></span>' +
          '</div>' +
          '<div class="bot-right">' +
            '<div class="gear" id="gearBtn"><ha-icon icon="mdi:cog"></ha-icon></div>' +
          '</div>' +
        '</div>' +
        /* missing entities warning */
        '<div class="warn" id="warn"></div>' +
      '</div>' +
      /* modal */
      '<div class="overlay" id="overlay">' +
        '<div class="modal">' +
          '<div class="mhdr">' +
            '<span class="mtitle">Settings</span>' +
            '<div class="mclose" id="mclose"><ha-icon icon="mdi:close"></ha-icon></div>' +
          '</div>' +
          '<div class="mbody" id="mbody"></div>' +
        '</div>' +
      '</div>';

    sh.appendChild(card);

    var self = this;
    sh.getElementById("centerBtn").addEventListener("click", function() { self._toggle(); });
    sh.getElementById("mbBtn").addEventListener("click", function() { self._info(self._ent.motion_bottom); });
    sh.getElementById("mtBtn").addEventListener("click", function() { self._info(self._ent.motion_top); });
    sh.getElementById("luxBtn").addEventListener("click", function() { self._info(self._ent.ambient_lux); });
    sh.getElementById("gearBtn").addEventListener("click", function() { self._openModal(); });
    sh.getElementById("mclose").addEventListener("click", function() { self._closeModal(); });
    sh.getElementById("overlay").addEventListener("click", function(e) {
      if (e.target.id === "overlay") self._closeModal();
    });

    this._rendered = true;
  }

  /* ── Refresh ────────────────────────────────────────────── */

  _refresh() {
    if (!this._rendered) return;
    var sh = this.shadowRoot;

    // check missing entities
    var missing = [];
    for (var k in this._ent) {
      if (!this._exists(this._ent[k])) missing.push(k + ": " + this._ent[k]);
    }
    var warn = sh.getElementById("warn");
    if (missing.length > 0) {
      warn.style.display = "block";
      warn.textContent = "⚠ Not found: " + missing.join(", ");
    } else {
      warn.style.display = "none";
    }

    // light state
    var isActive = this._st(this._ent.state) === "active";
    var lightsOn = this._isOn(this._ent.lights);
    var lightIcon = sh.getElementById("lightIcon");

    if (isActive || lightsOn) {
      lightIcon.style.color = "var(--state-light-active-color, #fdd835)";
    } else {
      lightIcon.style.color = "var(--state-icon-color, #9e9e9e)";
    }

    // mode + brightness
    var brPct = this._num(this._ent.current_brightness);
    var modeLabel = sh.getElementById("modeLabel");
    if (isActive || lightsOn) {
      var m = this._st(this._ent.mode) === "dim" ? "Dim" : "Normal";
      modeLabel.textContent = m + " · " + brPct + "%";
      modeLabel.style.color = "var(--primary-text-color)";
    } else {
      modeLabel.textContent = "Idle";
      modeLabel.style.color = "var(--secondary-text-color)";
    }

    // motion
    sh.getElementById("mbIco").style.color = this._isOn(this._ent.motion_bottom)
      ? "var(--state-binary_sensor-active-color, #fdd835)" : "var(--state-icon-color, #9e9e9e)";
    sh.getElementById("mtIco").style.color = this._isOn(this._ent.motion_top)
      ? "var(--state-binary_sensor-active-color, #fdd835)" : "var(--state-icon-color, #9e9e9e)";

    // lux
    var luxNum = this._num(this._ent.ambient_lux);
    var luxTh = this._num(this._ent.lux_threshold);
    sh.getElementById("luxVal").textContent = luxNum + " lx";
    var luxIco = sh.getElementById("luxIco");
    if (luxNum < luxTh) {
      luxIco.style.color = "var(--state-icon-color, #9e9e9e)";
    } else {
      luxIco.style.color = "var(--state-light-active-color, #fdd835)";
    }

    this._refreshBar();
    if (this._modalOpen) this._refreshModal();
  }

  _refreshBar() {
    if (!this._rendered) return;
    var sh = this.shadowRoot;
    var area = sh.getElementById("barArea");
    var fill = sh.getElementById("barFill");
    var time = sh.getElementById("barTime");

    var rem = this._num(this._ent.time_remaining);
    var tot = this._num(this._ent.turn_off_delay);

    if (rem <= 0 || tot <= 0) { area.style.display = "none"; return; }
    area.style.display = "flex";

    var pct = Math.min(100, (rem / tot) * 100);
    fill.style.width = pct + "%";
    fill.style.backgroundColor = pct > 50
      ? "var(--success-color, #4caf50)"
      : pct > 20 ? "var(--warning-color, #ff9800)" : "var(--error-color, #f44336)";

    var m = Math.floor(rem / 60), s = Math.round(rem % 60);
    time.textContent = m + ":" + (s < 10 ? "0" : "") + s;
  }

  /* ── Actions ────────────────────────────────────────────── */

  _toggle() {
    if (!this._hass) return;
    var eid = this._ent.lights;
    if (!this._exists(eid)) {
      console.warn("StaircaseLightingCard: entity not found:", eid);
      return;
    }
    this._hass.callService("switch", this._isOn(eid) ? "turn_off" : "turn_on",
      { entity_id: eid });
  }

  _info(eid) {
    if (!this._exists(eid)) {
      console.warn("StaircaseLightingCard: entity not found:", eid);
      return;
    }
    var ev = new Event("hass-more-info", { bubbles: true, composed: true });
    ev.detail = { entityId: eid };
    this.dispatchEvent(ev);
  }

  /* ── Modal ──────────────────────────────────────────────── */

  _openModal() {
    this._modalOpen = true;
    this.shadowRoot.getElementById("overlay").style.display = "flex";
    this._buildModal();
  }

  _closeModal() {
    this._modalOpen = false;
    this.shadowRoot.getElementById("overlay").style.display = "none";
  }

  _buildModal() {
    var body = this.shadowRoot.getElementById("mbody");
    var self = this;
    body.innerHTML = "";

    var params = [
      { e: this._ent.turn_off_delay, label: "Turn-off delay",  icon: "mdi:timer-outline",  unit: "s",  min:10,  max:300, step:10 },
      { e: this._ent.brightness,      label: "Brightness",      icon: "mdi:brightness-7",   unit: "%",  min:1,   max:100, step:1 },
      { e: this._ent.brightness_dim,   label: "Dim brightness",  icon: "mdi:brightness-5",   unit: "%",  min:1,   max:100, step:1 },
      { e: this._ent.lux_threshold,    label: "Lux threshold",   icon: "mdi:weather-sunny",  unit: "lx", min:0,   max:1000, step:10 }
    ];

    for (var i = 0; i < params.length; i++) {
      if (this._exists(params[i].e)) body.appendChild(this._slider(params[i]));
    }

    // lux control toggle
    if (this._exists(this._ent.lux_control)) {
      var luxOn = this._isOn(this._ent.lux_control);
      var row = document.createElement("div");
      row.className = "mrow mrow-toggle";
      row.innerHTML =
        '<div class="mrow-hdr">' +
          '<ha-icon icon="mdi:theme-light-dark" style="--mdc-icon-size:20px"></ha-icon>' +
          '<span class="mrow-lbl">Lux control</span>' +
        '</div>' +
        '<div class="toggle" id="luxToggle">' +
          '<div class="ttrack ' + (luxOn ? "on" : "") + '"><div class="tthumb"></div></div>' +
        '</div>';
      body.appendChild(row);

      row.querySelector("#luxToggle").addEventListener("click", function() {
        var on = self._isOn(self._ent.lux_control);
        self._hass.callService("switch", on ? "turn_off" : "turn_on",
          { entity_id: self._ent.lux_control });
      });
    }

    // set threshold button
    if (this._exists(this._ent.set_lux_threshold)) {
      var brow = document.createElement("div");
      brow.className = "mrow mrow-btn";
      var btn = document.createElement("button");
      btn.className = "mbtn";
      btn.textContent = "Set threshold to current lux (" + this._num(this._ent.ambient_lux) + " lx)";
      btn.addEventListener("click", function() {
        self._hass.callService("button", "press", { entity_id: self._ent.set_lux_threshold });
      });
      brow.appendChild(btn);
      body.appendChild(brow);
    }
  }

  _slider(p) {
    var self = this;
    var val = this._num(p.e);
    var row = document.createElement("div");
    row.className = "mrow";
    row.innerHTML =
      '<div class="mrow-hdr">' +
        '<ha-icon icon="' + p.icon + '" style="--mdc-icon-size:20px"></ha-icon>' +
        '<span class="mrow-lbl">' + p.label + '</span>' +
        '<span class="mrow-val" id="v_' + p.e + '">' + val + ' ' + p.unit + '</span>' +
      '</div>' +
      '<input type="range" class="rng" min="' + p.min + '" max="' + p.max +
      '" step="' + p.step + '" value="' + val + '" id="s_' + p.e + '">';

    var inp = row.querySelector("input");
    var vspan = row.querySelector(".mrow-val");
    var timer = null;

    inp.addEventListener("input", function() {
      vspan.textContent = this.value + " " + p.unit;
    });
    inp.addEventListener("change", function() {
      var v = parseFloat(this.value);
      clearTimeout(timer);
      timer = setTimeout(function() {
        self._hass.callService("number", "set_value", { entity_id: p.e, value: v });
      }, 250);
    });
    return row;
  }

  _refreshModal() {
    var sh = this.shadowRoot;
    var ents = [this._ent.turn_off_delay, this._ent.brightness, this._ent.brightness_dim, this._ent.lux_threshold];
    for (var i = 0; i < ents.length; i++) {
      var s = sh.getElementById("s_" + ents[i]);
      if (s && document.activeElement !== s) s.value = this._num(ents[i]);
    }
    var t = sh.getElementById("luxToggle");
    if (t) {
      var tr = t.querySelector(".ttrack");
      if (tr) { this._isOn(this._ent.lux_control) ? tr.classList.add("on") : tr.classList.remove("on"); }
    }
  }

  /* ── CSS ────────────────────────────────────────────────── */

  _css() {
    return '' +
    ':host{display:block}' +
    'ha-card{padding:16px;overflow:visible}' +
    '.sc{display:flex;flex-direction:column;align-items:center;gap:4px;min-height:160px}' +

    /* bar */
    '.bar-area{display:none;width:100%;align-items:center;gap:8px}' +
    '.bar-track{flex:1;height:6px;border-radius:3px;background:var(--divider-color,#e0e0e0);overflow:hidden}' +
    '.bar-fill{height:100%;border-radius:3px;transition:width 1s linear}' +
    '.bar-time{font-size:12px;font-weight:500;min-width:36px;text-align:right;color:var(--primary-text-color)}' +

    /* center */
    '.center{cursor:pointer;padding:12px;border-radius:50%;transition:background .2s}' +
    '.center:hover{background:var(--secondary-background-color,rgba(0,0,0,.05))}' +
    '.center:active{background:var(--divider-color,rgba(0,0,0,.1))}' +
    '.center ha-icon{--mdc-icon-size:48px;transition:color .3s}' +

    /* title */
    '.title{font-size:14px;font-weight:600;color:var(--primary-text-color);margin-top:0}' +

    /* mode */
    '.mode{font-size:13px;font-weight:400;letter-spacing:.3px}' +

    /* bottom */
    '.bottom{display:flex;width:100%;align-items:center;justify-content:space-between;margin-top:8px}' +
    '.bot-left{display:flex;gap:10px}' +
    '.bot-center{display:flex;align-items:center;gap:4px;cursor:pointer}' +
    '.bot-right{display:flex}' +
    '.sicon{display:flex;flex-direction:column;align-items:center;cursor:pointer;padding:4px}' +
    '.sicon ha-icon{--mdc-icon-size:22px;transition:color .3s}' +
    '.slbl{font-size:10px;color:var(--secondary-text-color);margin-top:2px}' +
    '.bot-center ha-icon{--mdc-icon-size:22px}' +
    '#luxVal{font-size:11px;color:var(--secondary-text-color)}' +
    '.gear{cursor:pointer;padding:4px;border-radius:50%;transition:background .2s}' +
    '.gear:hover{background:var(--secondary-background-color)}' +
    '.gear ha-icon{--mdc-icon-size:22px;color:var(--secondary-text-color)}' +

    /* warn */
    '.warn{display:none;font-size:10px;color:var(--error-color,#f44336);margin-top:6px;word-break:break-all;text-align:center;max-width:100%}' +

    /* modal */
    '.overlay{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:999;align-items:center;justify-content:center}' +
    '.modal{background:var(--card-background-color,#fff);border-radius:16px;width:90%;max-width:380px;box-shadow:0 8px 32px rgba(0,0,0,.3);overflow:hidden}' +
    '.mhdr{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid var(--divider-color,#e0e0e0)}' +
    '.mtitle{font-size:17px;font-weight:600;color:var(--primary-text-color)}' +
    '.mclose{cursor:pointer;padding:4px;border-radius:50%}' +
    '.mclose:hover{background:var(--secondary-background-color)}' +
    '.mclose ha-icon{--mdc-icon-size:20px;color:var(--secondary-text-color)}' +
    '.mbody{padding:14px 18px}' +

    '.mrow{margin-bottom:14px}' +
    '.mrow-hdr{display:flex;align-items:center;gap:8px;margin-bottom:6px}' +
    '.mrow-lbl{flex:1;font-size:13px;color:var(--primary-text-color)}' +
    '.mrow-val{font-size:12px;font-weight:500;color:var(--primary-color);min-width:48px;text-align:right}' +

    '.rng{width:100%;height:6px;border-radius:3px;outline:none;-webkit-appearance:none;appearance:none;background:var(--divider-color,#e0e0e0)}' +
    '.rng::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:var(--primary-color,#03a9f4);cursor:pointer;border:none}' +
    '.rng::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:var(--primary-color,#03a9f4);cursor:pointer;border:none}' +

    '.mrow-toggle{display:flex;align-items:center;justify-content:space-between}' +
    '.toggle{cursor:pointer}' +
    '.ttrack{width:44px;height:22px;border-radius:11px;background:var(--divider-color,#bdbdbd);position:relative;transition:background .2s}' +
    '.ttrack.on{background:var(--primary-color,#03a9f4)}' +
    '.tthumb{width:18px;height:18px;border-radius:50%;background:#fff;position:absolute;top:2px;left:2px;transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.3)}' +
    '.ttrack.on .tthumb{left:24px}' +

    '.mrow-btn{text-align:center;margin-top:8px;padding-top:10px;border-top:1px solid var(--divider-color,#e0e0e0)}' +
    '.mbtn{padding:8px 16px;border:none;border-radius:8px;background:var(--primary-color,#03a9f4);color:#fff;font-size:13px;font-weight:500;cursor:pointer;transition:opacity .2s}' +
    '.mbtn:hover{opacity:.85}' +
    '.mbtn:active{opacity:.7}' +
    '';
  }
}

customElements.define("staircase-lighting-card", StaircaseLightingCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "staircase-lighting-card",
  name: "Staircase Lighting Card",
  description: "Card for the Staircase Lighting integration",
  preview: false
});
console.info("%c STAIRCASE-LIGHTING-CARD v3 ","color:#fff;background:#4285f4;font-weight:bold;padding:2px 6px;border-radius:4px;");
