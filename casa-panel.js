/*
 * casa-panel.js — Dashboard su misura per Home Assistant
 * Stile "blu notte / vetro", una sola card a tutto schermo con navigazione interna.
 * Copiare in  homeassistant/www/casa-panel.js  (sulla scheda dell'AI Hub)
 * Risorsa:    /local/casa-panel.js?v=1   (tipo: Modulo JavaScript)
 */
const CP_VERSION = '1.3.0';

/* ---------- utilità ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n, d = 0) => (n == null || isNaN(n) ? '—' : Number(n).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d }));
const ic = (i, cls = '') => `<ha-icon class="${cls}" icon="${esc(i)}"></ha-icon>`;
const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const GG = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const COL = { ok: '#3ddc97', warn: '#f6b93b', bad: '#ff5d6c', acc: '#4fd1e8', blue: '#5aa9ff', purple: '#b48cff', orange: '#ff9f43', sub: '#8ea3c0' };
const WX = {
  'clear-night': ['mdi:weather-night', 'Sereno'], cloudy: ['mdi:weather-cloudy', 'Nuvoloso'], exceptional: ['mdi:alert-circle-outline', 'Eccezionale'],
  fog: ['mdi:weather-fog', 'Nebbia'], hail: ['mdi:weather-hail', 'Grandine'], lightning: ['mdi:weather-lightning', 'Temporale'],
  'lightning-rainy': ['mdi:weather-lightning-rainy', 'Temporale'], partlycloudy: ['mdi:weather-partly-cloudy', 'Parz. nuvoloso'],
  pouring: ['mdi:weather-pouring', 'Pioggia forte'], rainy: ['mdi:weather-rainy', 'Pioggia'], snowy: ['mdi:weather-snowy', 'Neve'],
  'snowy-rainy': ['mdi:weather-snowy-rainy', 'Nevischio'], sunny: ['mdi:weather-sunny', 'Soleggiato'], windy: ['mdi:weather-windy', 'Ventoso'],
  'windy-variant': ['mdi:weather-windy-variant', 'Ventoso'],
};
const lvl = (v, a, b) => (v == null || isNaN(v) ? 'sub' : v < a ? 'ok' : v < b ? 'warn' : 'bad');
const glob = (p) => new RegExp('^' + p.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
const spUri = (u) => { const m = String(u).match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(playlist|album|artist|track|show)\/([A-Za-z0-9]+)/); return m ? `spotify:${m[1]}:${m[2]}` : String(u).trim(); };
const VAC_ST = { cleaning: 'In pulizia', docked: 'In base', returning: 'Rientro alla base', paused: 'In pausa', idle: 'Fermo', error: 'Errore', unavailable: 'Non raggiungibile' };
const STATION_ST = { idle: 'Pronta', emptying: 'Svuotamento', washing: 'Lavaggio mocio', drying: 'Asciugatura mocio', cleaning: 'In lavaggio', refilling: 'Riempimento' };
const FAN_LBL = { quiet: 'Silenzioso', normal: 'Standard', max: 'Max', max_plus: 'Max+', standard: 'Standard', strong: 'Forte' };
const PART_LBL = { dust_bucket_lifespan: 'Contenitore polvere', dust_container_filter_lifespan: 'Filtro contenitore', heavy_duty_cleaning_solution_lifespan: 'Soluzione intensiva',
  mop_washing_tray_lifespan: 'Vaschetta lavaggio mocio', strainer_lifespan: 'Filtro acqua', unit_care_lifespan: 'Manutenzione unità' };
const BTN_LBL = { trasferire: ['Riposiziona robot', 'mdi:map-marker-question-outline'], asciuga_il_mocio: ['Asciuga mocio', 'mdi:weather-windy'], svuota_contenitore_della_polvere: ['Svuota polvere', 'mdi:delete-empty-outline'],
  wash_mop: ['Lava mocio', 'mdi:water-sync'], relocate: ['Riposiziona', 'mdi:map-marker-question'] };
const ROOM_IC = { cameretta: 'mdi:teddy-bear', studio: 'mdi:desk', camera_da_letto: 'mdi:bed-king', atrio: 'mdi:door-open', bagno: 'mdi:shower', cucina: 'mdi:stove', soggiorno: 'mdi:sofa', sala: 'mdi:sofa', corridoio: 'mdi:shoe-print' };
const COMANDI_ESCLUSI_DEFAULT = ['*child_lock*', '*blocco_bambini*', '*_display', '*indicatore_led*', '*night_light*', 'light.*air_purifier*'];

/* ---------- grafici SVG ---------- */
let _gid = 0;
function spark(pts, { w = 300, h = 80, color = COL.acc, fill = true, lo = null, hi = null } = {}) {
  if (!pts || pts.length < 2) return `<div class="nodata">in attesa di dati…</div>`;
  if (pts.length > 240) { const k = Math.ceil(pts.length / 240); pts = pts.filter((_, i) => i % k === 0 || i === pts.length - 1); }
  const vals = pts.map((p) => p.v);
  let mn = lo ?? Math.min(...vals), mx = hi ?? Math.max(...vals);
  if (mx - mn < 1e-6) { mx += 1; mn -= 1; }
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t || t0 + 1;
  const x = (t) => ((t - t0) / (t1 - t0 || 1)) * w;
  const y = (v) => h - 3 - ((v - mn) / (mx - mn)) * (h - 6);
  let d = '';
  pts.forEach((p, i) => { d += (i ? ' L' : 'M') + x(p.t).toFixed(1) + ' ' + y(p.v).toFixed(1); });
  const id = 'cpg' + (++_gid);
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".32"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    ${fill ? `<path d="${d} L${w} ${h} L0 ${h} Z" fill="url(#${id})"/>` : ''}
    <path d="${d}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
function barChart(items, { h = 150, color = COL.acc, unit = '', dec = 1 } = {}) {
  if (!items || !items.length) return `<div class="nodata">in attesa di dati…</div>`;
  const mx = Math.max(...items.map((i) => i.v), 0.0001);
  const cols = items.map((it, i) => {
    const pct = Math.max(1.5, (it.v / mx) * 100);
    const last = i === items.length - 1;
    return `<div class="bcol" title="${esc(it.label)}: ${fmt(it.v, dec)} ${unit}"><div class="bbar${last ? ' last' : ''}" style="height:${pct}%;background:${last ? COL.acc : color}"></div></div>`;
  }).join('');
  const lbl = items.map((it, i) => `<span>${i % 7 === 0 || i === items.length - 1 ? esc(it.short) : ''}</span>`).join('');
  return `<div class="bchart" style="height:${h}px">${cols}</div><div class="blabels">${lbl}</div>`;
}

/* ---------- card ---------- */
class CasaPanel extends HTMLElement {
  constructor() {
    super();
    this._tab = 'casa';
    this._hist = {};
    this._histAt = {};
    this._stats = null;
    this._statsAt = 0;
    this._fcH = null;
    this._fcD = null;
    this._metric = {};
    this._eUnit = 'kWh';
    this._modal = null;
    this._pin = '';
    this._pinErr = '';
    this._pending = null;
    this._tick = 0;
    this._lastRender = 0;
  }

  static getStubConfig() { return {}; }
  getCardSize() { return 14; }

  setConfig(config) {
    const c = JSON.parse(JSON.stringify(config || {}));
    c.nome = c.nome || '';
    c.prezzo_kwh = Number(c.prezzo_kwh ?? 0.25);
    c.stanze = c.stanze || [];
    c.elettrodomestici = c.elettrodomestici || [];
    c.consumi = c.consumi || [];
    c.energia = c.energia || [];
    c.purificatori = c.purificatori || [];
    c.comandi_rapidi = c.comandi_rapidi || [];
    c.telecamere = c.telecamere || [];
    c.sicurezza = c.sicurezza || {};
    c.sicurezza.perdite = c.sicurezza.perdite || [];
    c.escludi = (c.escludi || []).map(glob);
    c.escludi_comandi = [...COMANDI_ESCLUSI_DEFAULT, ...(c.escludi_comandi || [])].map(glob);
    c.soglia_batteria = Number(c.soglia_batteria ?? 20);
    c.robot = c.robot ? (typeof c.robot === 'string' ? { entita: c.robot } : c.robot) : null;
    this._rooms = new Set(); this._passes = 1;
    c.musica = c.musica || {};
    c.musica.playlist = (c.musica.playlist || []).map((x) => ({ ...x, uri: spUri(x.uri || x.link || '') }));
    c.musica.radio = c.musica.radio || [];
    this._cfg = c;
    if (this._root) this._render(true);
  }

  set hass(h) {
    const old = this._hass;
    this._hass = h;
    if (!this._root) this._init();
    if (!this._wxSub && this._weatherId()) this._subscribeWeather();
    if (!old || this._watchedChanged(old, h)) this._schedule();
  }

  connectedCallback() {
    if (!this._timer) {
      this._timer = setInterval(() => {
        this._tick++;
        if (this._tab === 'casa' || this._tab === 'telecamere' || this._tab === 'musica' || this._tick % 6 === 0) this._render(true);
      }, 10000);
    }
  }
  disconnectedCallback() {
    if (this._onResize) { window.removeEventListener('resize', this._onResize); window.removeEventListener('orientationchange', this._onResize); }
    clearInterval(this._timer); this._timer = null;
    if (this._wxSub) { this._wxSub.forEach((u) => u && u.then && u.then((f) => f && f())); this._wxSub = null; }
  }

  /* ----- stato ----- */
  _st(id) { return id && this._hass ? this._hass.states[id] : undefined; }
  _v(id) { const s = this._st(id); return s ? s.state : undefined; }
  _n(id) { const s = this._st(id); if (!s) return null; const v = parseFloat(s.state); return isNaN(v) ? null : v; }
  _u(id) { const s = this._st(id); return (s && s.attributes.unit_of_measurement) || ''; }
  _on(id) { return this._v(id) === 'on'; }
  _name(id) { const s = this._st(id); return (s && s.attributes.friendly_name) || id; }
  _ok(id) { const s = this._st(id); return s && s.state !== 'unavailable' && s.state !== 'unknown'; }
  _stLabel(id) {
    const s = this._st(id); if (!s) return 'Non trovato';
    const m = { unavailable: 'Non raggiungibile', unknown: 'Sconosciuto', on: 'Acceso', off: 'Spento', open: 'Aperto', closed: 'Chiuso', opening: 'In apertura', closing: 'In chiusura',
      locked: 'Bloccato', unlocked: 'Sbloccato', cleaning: 'In pulizia', docked: 'In base', returning: 'Rientra', paused: 'In pausa', idle: 'Fermo', error: 'Errore' };
    return m[s.state] || s.state;
  }
  _excluded(id) { return this._cfg.escludi.some((r) => r.test(id)); }
  _locked() { const b = this._cfg.blocco; return !!(b && this._st(b) && this._v(b) !== 'disarmed'); }
  _weatherId() { return this._cfg.meteo || Object.keys(this._hass?.states || {}).find((k) => k.startsWith('weather.')); }

  _watchedIds() {
    if (this._watch && this._watchAt > Date.now() - 60000) return this._watch;
    const c = this._cfg, ids = new Set();
    const add = (x) => x && ids.add(x);
    c.stanze.forEach((r) => ['temperatura', 'umidita', 'co2', 'pm25'].forEach((k) => add(r[k])));
    c.elettrodomestici.forEach((a) => { add(a.potenza); add(a.presa); });
    c.consumi.forEach((x) => add(x.entita));
    c.energia.forEach((x) => add(x.entita));
    c.purificatori.forEach((p) => { add(p.ventola); add(p.pm25); add(p.filtro); });
    c.comandi_rapidi.forEach((q) => add(q.entita));
    c.telecamere.forEach((t) => add(t.entita));
    Object.values(c.sicurezza).flat().forEach(add);
    if (c.esterno) { add(c.esterno.temperatura); add(c.esterno.umidita); }
    add(c.blocco); add(this._weatherId());
    Object.keys(this._hass.states).forEach((k) => { if (/^(person|switch|light|fan|cover|vacuum|lock|camera|media_player)\./.test(k)) ids.add(k); });
    this._watch = [...ids]; this._watchAt = Date.now();
    return this._watch;
  }
  _watchedChanged(o, n) { return this._watchedIds().some((id) => o.states[id] !== n.states[id]); }
  _schedule() {
    const wait = Math.max(0, 1000 - (Date.now() - this._lastRender));
    clearTimeout(this._rt);
    this._rt = setTimeout(() => this._render(), wait);
  }

  /* ----- dati storici ----- */
  async _history(ids, hours) {
    ids = ids.filter((id) => id && this._st(id));
    const key = (id) => id + '|' + hours;
    const need = ids.filter((id) => !this._histAt[key(id)] || Date.now() - this._histAt[key(id)] > 300000);
    if (!need.length || this._histBusy?.[hours]) return;
    this._histBusy = this._histBusy || {}; this._histBusy[hours] = true;
    try {
      const start = new Date(Date.now() - hours * 3600e3).toISOString();
      const res = await this._hass.callWS({ type: 'history/history_during_period', start_time: start, entity_ids: need, minimal_response: true, no_attributes: true, significant_changes_only: false });
      const now = Date.now();
      need.forEach((id) => {
        const arr = (res[id] || []).map((p) => ({ t: (p.lu ?? p.lc ?? 0) * 1000, v: parseFloat(p.s) })).filter((p) => !isNaN(p.v));
        if (arr.length) { arr[0].t = Math.max(arr[0].t, now - hours * 3600e3); arr.push({ t: now, v: arr[arr.length - 1].v }); }
        this._hist[key(id)] = arr; this._histAt[key(id)] = now;
      });
    } catch (e) { console.warn('casa-panel history', e); }
    this._histBusy[hours] = false;
    this._render(true);
  }
  _h(id, hours) { return this._hist[id + '|' + hours]; }

  async _energyStats() {
    const ids = this._cfg.energia.map((e) => e.entita).filter((id) => this._st(id));
    if (!ids.length || this._statsBusy || (this._stats && Date.now() - this._statsAt < 900000)) return;
    this._statsBusy = true;
    try {
      const now = new Date();
      const s1 = new Date(now.getFullYear(), now.getMonth(), 1);
      const s2 = new Date(now.getTime() - 30 * 86400e3); s2.setHours(0, 0, 0, 0);
      const start = s1 < s2 ? s1 : s2;
      const res = await this._hass.callWS({ type: 'recorder/statistics_during_period', start_time: start.toISOString(), period: 'day', statistic_ids: ids, types: ['change'], units: { energy: 'kWh' } });
      const days = {}, perId = {};
      ids.forEach((id) => (res[id] || []).forEach((r) => {
        const t = typeof r.start === 'number' ? r.start : Date.parse(r.start);
        const d = new Date(t); d.setHours(0, 0, 0, 0);
        const k = d.getTime(); const v = Math.max(0, r.change || 0);
        days[k] = (days[k] || 0) + v;
        if (d >= s1) perId[id] = (perId[id] || 0) + v;
      }));
      this._stats = { days, perId, monthStart: s1.getTime() };
      this._statsAt = Date.now();
    } catch (e) { console.warn('casa-panel stats', e); }
    this._statsBusy = false;
    this._render(true);
  }

  _subscribeWeather() {
    const id = this._weatherId();
    if (!id || !this._hass.connection) return;
    this._wxSub = ['hourly', 'daily'].map((type) =>
      this._hass.connection.subscribeMessage((ev) => { if (type === 'hourly') this._fcH = ev.forecast; else this._fcD = ev.forecast; this._schedule(); },
        { type: 'weather/subscribe_forecast', entity_id: id, forecast_type: type }).catch(() => null));
  }

  /* ----- inizializzazione ----- */
  _init() {
    this._root = this.attachShadow({ mode: 'open' });
    this._root.innerHTML = `<style>${CSS}</style><div class="wrap"><nav class="nav"></nav><main class="main"></main><div class="dock"></div><div class="modal-host"></div></div>`;
    this._nav = this._root.querySelector('.nav');
    this._main = this._root.querySelector('.main');
    this._mh = this._root.querySelector('.modal-host');
    this._dock = this._root.querySelector('.dock');
    this._wrap = this._root.querySelector('.wrap');
    this._onResize = () => { this._fitKey = ''; this._render(true); };
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onResize);
    this._root.addEventListener('click', (e) => {
      const el = e.composedPath().find((n) => n.dataset && n.dataset.a);
      if (el) { e.stopPropagation(); this._act(el.dataset.a, el.dataset); }
    });
  }

  /* ----- azioni ----- */
  _act(a, d) {
    const h = this._hass;
    switch (a) {
      case 'tab': this._tab = d.t; this._render(true); this._main.scrollTop = 0; break;
      case 'more': this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: d.id }, bubbles: true, composed: true })); break;
      case 'toggle': this._guard(() => this._toggle(d.id), d.conf === '1', d.label); break;
      case 'preset': this._guard(() => h.callService('fan', 'set_preset_mode', { entity_id: d.id, preset_mode: d.m })); break;
      case 'speed': this._guard(() => (d.dir === '+' ? h.callService('fan', 'increase_speed', { entity_id: d.id }) : h.callService('fan', 'decrease_speed', { entity_id: d.id }))); break;
      case 'metric': this._metric[d.r] = d.m; this._render(true); break;
      case 'eunit': this._eUnit = d.u; this._render(true); break;
      case 'lock': if (this._cfg.blocco) h.callService('alarm_control_panel', 'alarm_arm_home', { entity_id: this._cfg.blocco }); break;
      case 'unlock': this._guard(() => {}); break;
      case 'key': this._key(d.k); break;
      case 'close': this._modal = null; this._pending = null; this._pin = ''; this._pinErr = ''; this._renderModal(); break;
      case 'mp': this._hass.callService('media_player', d.s, { entity_id: d.id, ...(d.v != null ? JSON.parse(d.v) : {}) }); break;
      case 'vol': { const st = this._st(d.id); const v = Math.min(1, Math.max(0, (st?.attributes.volume_level ?? 0.3) + Number(d.d))); h.callService('media_player', 'volume_set', { entity_id: d.id, volume_level: Math.round(v * 100) / 100 }); break; }
      case 'src': h.callService('media_player', 'select_source', { entity_id: d.id, source: d.src }); break;
      case 'pl': this._playSpotify(d.uri); break;
      case 'radio': this._openRadio(+d.i); break;
      case 'radio-alexa': { const r = this._cfg.musica.radio[+d.i]; const ax = this._cfg.musica.alexa; if (r && ax) h.callService('media_player', 'play_media', { entity_id: ax, media_content_type: 'custom', media_content_id: r.comando_alexa || `metti ${r.nome}` }); break; }
      case 'radio-min': this._dock.classList.toggle('min'); break;
      case 'radio-close': this._radio = null; this._dock.innerHTML = ''; this._dock.className = 'dock'; if (this._tab === 'musica') this._render(true); break;
      case 'vac': this._guard(() => h.callService('vacuum', d.s, { entity_id: d.id, ...(d.v != null ? JSON.parse(d.v) : {}) })); break;
      case 'room': { const k = d.k; if (this._rooms.has(k)) this._rooms.delete(k); else this._rooms.add(k); this._render(true); break; }
      case 'passes': this._passes = this._passes === 1 ? 2 : 1; this._render(true); break;
      case 'rooms-go': { const R = this._robot(); if (!R || !this._rooms.size) break; const rooms = [...this._rooms].map((k) => R.rooms[k]).filter((x) => x != null).join(',');
        this._guard(() => h.callService('vacuum', 'send_command', { entity_id: R.id, command: 'spot_area', params: { rooms, cleanings: this._passes } }).then(() => { this._rooms.clear(); this._render(true); })); break; }
      case 'press': this._guard(() => h.callService('button', 'press', { entity_id: d.id }), d.conf === '1', d.label); break;
      case 'num': { const st = this._st(d.id); if (!st) break; const a = st.attributes; const v = Math.min(a.max ?? 100, Math.max(a.min ?? 0, Number(st.state) + Number(d.d)));
        this._guard(() => h.callService('number', 'set_value', { entity_id: d.id, value: v })); break; }
      case 'sel': this._guard(() => h.callService('select', 'select_option', { entity_id: d.id, option: d.o })); break;
      case 'confirm-yes': { const p = this._pending; this._pending = null; this._modal = null; this._renderModal(); if (p) p(); break; }
    }
  }
  _toggle(id) {
    const dom = id.split('.')[0];
    if (dom === 'cover') return this._hass.callService('cover', 'toggle', { entity_id: id });
    if (dom === 'lock') return this._hass.callService('lock', this._v(id) === 'locked' ? 'unlock' : 'lock', { entity_id: id });
    if (dom === 'vacuum') return this._hass.callService('vacuum', this._v(id) === 'cleaning' ? 'return_to_base' : 'start', { entity_id: id });
    return this._hass.callService('homeassistant', 'toggle', { entity_id: id });
  }
  _guard(fn, confirm = false, label = '') {
    const run = () => {
      if (confirm) { this._pending = fn; this._modal = { type: 'confirm', label }; this._renderModal(); }
      else fn();
    };
    if (this._locked()) { this._pending = run; this._pin = ''; this._pinErr = ''; this._modal = { type: 'pin' }; this._renderModal(); }
    else run();
  }
  async _key(k) {
    if (k === 'del') this._pin = this._pin.slice(0, -1);
    else if (k === 'ok') return this._submitPin();
    else if (this._pin.length < 16) this._pin += k;
    this._pinErr = ''; this._renderModal();
  }
  async _submitPin() {
    const code = this._pin; this._pin = '';
    this._pinErr = 'Verifica…'; this._renderModal();
    try { await this._hass.callService('alarm_control_panel', 'alarm_disarm', { entity_id: this._cfg.blocco, code: String(code) }, undefined, false); }
    catch (e) {
      const msg = String((e && (e.message || e.code)) || e || '');
      console.warn('casa-panel disarm error', e);
      this._pinErr = /code|codice|invalid|non valid|wrong|errat/i.test(msg) ? `Codice errato (${code.length} cifre)` : `Errore: ${msg.slice(0, 90)}`;
      this._renderModal(); return;
    }
    const t0 = Date.now();
    while (Date.now() - t0 < 8000 && this._locked()) await new Promise((r) => setTimeout(r, 200));
    if (this._locked()) { this._pinErr = `Non sbloccato: stato "${this._v(this._cfg.blocco)}" (${code.length} cifre)`; this._renderModal(); return; }
    const p = this._pending; this._pending = null; this._modal = null; this._pinErr = ''; this._renderModal(); this._render(true);
    if (p) p();
  }

  _renderModal() {
    if (!this._modal) { this._mh.innerHTML = ''; return; }
    if (this._modal.type === 'pin') {
      const dots = Array.from({ length: Math.max(4, this._pin.length) }, (_, i) => `<i class="${i < this._pin.length ? 'f' : ''}"></i>`).join('');
      const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'].map((k) =>
        `<button class="key ${k === 'ok' ? 'kok' : ''}" data-a="key" data-k="${k}">${k === 'del' ? ic('mdi:backspace-outline') : k === 'ok' ? ic('mdi:check') : k}</button>`).join('');
      this._mh.innerHTML = `<div class="modal"><div class="dlg">${ic('mdi:lock-outline', 'dlg-ic')}<div class="dt">Comandi bloccati</div><div class="ds">Inserisci il codice per sbloccare</div>
        <div class="dots">${dots}</div><div class="err">${esc(this._pinErr)}</div><div class="kp">${keys}</div>
        <button class="btn ghost" data-a="close">Annulla</button></div></div>`;
    } else {
      this._mh.innerHTML = `<div class="modal"><div class="dlg">${ic('mdi:help-circle-outline', 'dlg-ic')}<div class="dt">${esc(this._modal.label || 'Confermi?')}</div>
        <div class="ds">Vuoi davvero procedere?</div><div class="row2"><button class="btn ghost" data-a="close">Annulla</button><button class="btn pri" data-a="confirm-yes">Conferma</button></div></div></div>`;
    }
  }

  /* ----- adatta allo schermo ----- */
  _fit() {
    // 1) altezza esatta dello spazio visibile (evita lo scorrimento esterno su iPad)
    const top = Math.max(0, this.getBoundingClientRect().top);
    const vh = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
    if (vh - top > 300) this._wrap.style.height = `${Math.floor(vh - top)}px`;
    // 2) se la pagina sfora di poco, la rimpicciolisce quanto basta (max -20%)
    const v = this._main.firstElementChild; if (!v) return;
    if (this._cfg.adatta_schermo === false || window.innerWidth <= 700) { v.style.zoom = ''; return; }
    const key = `${this._tab}|${this._main.clientWidth}x${this._main.clientHeight}`;
    if (key !== this._fitKey) { this._fitKey = key; this._z = 1; }
    v.style.zoom = this._z === 1 ? '' : this._z;
    const avail = this._main.clientHeight, h = this._main.scrollHeight;
    if (h > avail + 1) {
      const z = Math.floor(this._z * (avail / h) * 1000) / 1000;
      if (z >= (this._cfg.zoom_minimo ?? 0.8)) { this._z = z; v.style.zoom = z; }
    }
  }

  /* ----- avvisi ----- */
  _batteries() {
    return Object.values(this._hass.states)
      .filter((s) => s.attributes.device_class === 'battery' && s.entity_id.startsWith('sensor.') && !isNaN(parseFloat(s.state)) && !this._excluded(s.entity_id))
      .map((s) => ({ id: s.entity_id, name: (s.attributes.friendly_name || s.entity_id).replace(/\s*(Batteria|Battery)$/i, ''), v: parseFloat(s.state) }))
      .sort((a, b) => a.v - b.v);
  }
  _configuredIds() {
    const c = this._cfg, ids = [];
    c.stanze.forEach((r) => ['temperatura', 'umidita', 'co2'].forEach((k) => r[k] && ids.push(r[k])));
    c.purificatori.forEach((p) => p.ventola && ids.push(p.ventola));
    c.comandi_rapidi.forEach((q) => ids.push(q.entita));
    c.telecamere.forEach((t) => ids.push(t.entita));
    c.elettrodomestici.forEach((a) => a.potenza && ids.push(a.potenza));
    if (c.robot) ids.push(c.robot.entita);
    return [...new Set(ids)];
  }
  _alerts() {
    const c = this._cfg, s = c.sicurezza, A = [];
    if (s.co_allarme && this._on(s.co_allarme)) A.push({ l: 'bad', i: 'mdi:molecule-co', t: 'ALLARME MONOSSIDO', s: 'Aerare subito e uscire di casa', id: s.co_allarme });
    s.perdite.forEach((id) => { if (this._on(id)) A.push({ l: 'bad', i: 'mdi:water-alert', t: "Perdita d'acqua", s: this._name(id), id }); });
    c.stanze.forEach((r) => { const v = this._n(r.co2); if (v != null && v >= 1200) A.push({ l: v >= 2000 ? 'bad' : 'warn', i: 'mdi:molecule-co2', t: `CO₂ alta in ${r.nome}`, s: `${fmt(v)} ppm · arieggiare`, id: r.co2 }); });
    const rn = this._n(s.radon); if (rn != null && rn >= 100) A.push({ l: rn >= 300 ? 'bad' : 'warn', i: 'mdi:radioactive', t: 'Radon sopra il riferimento', s: `${fmt(rn)} Bq/m³`, id: s.radon });
    c.purificatori.forEach((p) => { const v = this._n(p.pm25); if (v != null && v >= 35) A.push({ l: 'warn', i: 'mdi:air-filter', t: `Polveri alte · ${p.nome}`, s: `PM2.5 ${fmt(v)} µg/m³`, id: p.pm25 }); });
    const low = this._batteries().filter((b) => b.v <= c.soglia_batteria);
    if (low.length) A.push({ l: 'info', i: 'mdi:battery-alert-variant-outline', t: `${low.length} ${low.length === 1 ? 'batteria scarica' : 'batterie scariche'}`, s: low.slice(0, 3).map((b) => `${b.name} ${fmt(b.v)}%`).join(', '), go: 'avvisi' });
    const off = this._configuredIds().filter((id) => !this._ok(id));
    if (off.length) A.push({ l: 'warn', i: 'mdi:lan-disconnect', t: `${off.length} ${off.length === 1 ? 'dispositivo non raggiungibile' : 'dispositivi non raggiungibili'}`, s: off.slice(0, 3).map((id) => this._name(id)).join(', '), go: 'avvisi' });
    const upd = Object.values(this._hass.states).filter((x) => x.entity_id.startsWith('update.') && x.state === 'on');
    const R = this._robot();
    if (R) {
      if (this._v(R.id) === 'error') A.push({ l: 'bad', i: 'mdi:robot-vacuum-alert', t: `${R.nome}: errore`, s: 'Controlla il robot', go: 'robot' });
      const worn = R.parts.filter((x) => x.v != null && x.v <= 10);
      if (worn.length) A.push({ l: 'info', i: 'mdi:wrench-outline', t: `${R.nome}: ${worn.length === 1 ? 'un ricambio' : worn.length + ' ricambi'} da sostituire`, s: worn.map((x) => `${x.nome} ${fmt(x.v)}%`).join(', '), go: 'robot' });
    }
    if (upd.length) A.push({ l: 'info', i: 'mdi:update', t: upd.length === 1 ? '1 aggiornamento disponibile' : `${upd.length} aggiornamenti disponibili`, s: upd.slice(0, 2).map((x) => x.attributes.friendly_name).join(', '), go: 'avvisi' });
    const rank = { bad: 0, warn: 1, info: 2 };
    return A.sort((a, b) => rank[a.l] - rank[b.l]);
  }

  /* ----- render ----- */
  _render(force = false) {
    if (!this._hass || !this._cfg || !this._root) return;
    this._lastRender = Date.now();
    const alerts = this._alerts();
    const tabs = [
      ['casa', 'mdi:home-outline', 'Casa'], ['clima', 'mdi:thermometer', 'Clima'], ['energia', 'mdi:lightning-bolt-outline', 'Energia'],
      ['telecamere', 'mdi:cctv', 'Telecamere'], ['aria', 'mdi:air-purifier', 'Purificatori'], ...(this._cfg.robot ? [['robot', 'mdi:robot-vacuum', 'Robot']] : []), ['musica', 'mdi:music', 'Musica'], ['comandi', 'mdi:gesture-tap-button', 'Comandi'],
    ];
    const lockIc = this._cfg.blocco ? (this._locked() ? 'mdi:lock-outline' : 'mdi:lock-open-variant-outline') : null;
    this._nav.innerHTML = tabs.map(([id, i, l]) => `<button class="tb ${this._tab === id ? 'on' : ''}" data-a="tab" data-t="${id}">${ic(i)}<span>${l}</span></button>`).join('')
      + `<span class="sp"></span>`
      + (lockIc ? `<button class="tb ico ${this._locked() ? '' : 'unl'}" data-a="${this._locked() ? 'unlock' : 'lock'}" title="${this._locked() ? 'Sblocca' : 'Blocca ora'}">${ic(lockIc)}</button>` : '')
      + `<button class="tb ico ${this._tab === 'avvisi' ? 'on' : ''}" data-a="tab" data-t="avvisi">${ic('mdi:bell-outline')}${alerts.length ? `<b class="badge ${alerts[0].l}">${alerts.length}</b>` : ''}</button>`;
    const fn = { casa: this._vCasa, clima: this._vClima, energia: this._vEnergia, telecamere: this._vCam, aria: this._vAria, comandi: this._vComandi, musica: this._vMusica, robot: this._vRobot, avvisi: this._vAvvisi }[this._tab] || this._vCasa;
    this._main.innerHTML = `<section class="view v-${this._tab}">${fn.call(this, alerts)}</section>`;
    this._fit();
  }

  /* ===== CASA ===== */
  _vCasa(alerts) {
    const c = this._cfg, now = new Date();
    const hhmm = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const people = c.persone ? c.persone.map((id) => this._st(id)).filter(Boolean) : Object.values(this._hass.states).filter((s) => s.entity_id.startsWith('person.') && !['unknown', 'unavailable'].includes(s.state));
    const ppl = people.map((p) => {
      const home = p.state === 'home';
      const pic = p.attributes.entity_picture;
      return `<div class="person ${home ? 'home' : ''}" data-a="more" data-id="${p.entity_id}">${pic ? `<img src="${esc(pic)}">` : `<span class="pi">${esc((p.attributes.friendly_name || '?')[0])}</span>`}
        <div><b>${esc(p.attributes.friendly_name)}</b><small>${home ? 'in casa' : p.state === 'not_home' ? 'fuori casa' : esc(p.state)}</small></div></div>`;
    }).join('');
    const greet = now.getHours() < 13 ? 'Buongiorno' : now.getHours() < 18 ? 'Buon pomeriggio' : 'Buonasera';

    // meteo
    const wid = this._weatherId(), w = this._st(wid);
    let meteo = `<div class="card wx"><div class="nodata">Meteo non configurato</div></div>`, giorni = '';
    if (w) {
      const [wi, wl] = WX[w.state] || ['mdi:weather-cloudy', w.state];
      const tExt = c.esterno ? this._n(c.esterno.temperatura) : null;
      const hrs = (this._fcH || []).slice(0, 5).map((f) => {
        const d = new Date(f.datetime); const [fi] = WX[f.condition] || ['mdi:weather-cloudy'];
        return `<div class="hr"><small>${String(d.getHours()).padStart(2, '0')}</small>${ic(fi, 'wsm')}<b>${fmt(f.temperature)}°</b></div>`;
      }).join('');
      meteo = `<div class="card wx" data-a="more" data-id="${wid}"><div class="wxnow">${ic(wi, 'wbig')}<div><div class="wt">${fmt(tExt ?? w.attributes.temperature, tExt != null ? 1 : 0)}°</div><div class="wl">${esc(wl)}</div>
        ${c.esterno && this._n(c.esterno.umidita) != null ? `<small class="sub">${ic('mdi:water-percent', 'xs')} ${fmt(this._n(c.esterno.umidita))}% fuori</small>` : ''}</div></div>
        <div class="wxh"><div class="ctl">Prossime ore</div><div class="hrs">${hrs || '<span class="sub">…</span>'}</div></div></div>`;
      giorni = (this._fcD || []).slice(1, 5).map((f) => {
        const d = new Date(f.datetime); const [fi] = WX[f.condition] || ['mdi:weather-cloudy'];
        return `<div class="day"><small>${GG[d.getDay()]}</small>${ic(fi, 'wmd')}<b>${fmt(f.temperature)}°<span class="sub">/${fmt(f.templow)}°</span></b>${f.precipitation ? `<small class="rain">${fmt(f.precipitation, 0)} mm</small>` : '<small>&nbsp;</small>'}</div>`;
      }).join('');
    }

    // avvisi
    const strip = alerts.length
      ? `<div class="strip ${alerts[0].l}" data-a="tab" data-t="avvisi">${ic(alerts[0].i)}<b>${esc(alerts[0].t)}</b><span class="sub">${esc(alerts[0].s || '')}</span><span class="sp"></span>${alerts.length > 1 ? `<span class="more">e altri ${alerts.length - 1}</span>` : ''}${ic('mdi:chevron-right')}</div>`
      : `<div class="strip ok">${ic('mdi:shield-check-outline')}<b>Tutto in ordine</b><span class="sub">nessun avviso attivo</span></div>`;

    // consumi
    const pw = c.consumi.map((x) => ({ ...x, v: this._n(x.entita) ?? 0 }));
    const tot = pw.reduce((a, b) => a + b.v, 0);
    const mx = Math.max(...pw.map((p) => p.v), 1);
    const st = this._stats; let oggiKwh = null;
    if (st) { const d0 = new Date(); d0.setHours(0, 0, 0, 0); oggiKwh = st.days[d0.getTime()] ?? 0; }
    this._energyStats();
    const bars = [...pw].sort((a, b) => b.v - a.v).map((p) => `<div class="pbar" data-a="more" data-id="${p.entita}"><span>${esc(p.nome)}</span><div class="track"><i style="width:${(p.v / mx) * 100}%"></i></div><b>${fmt(p.v)} W</b></div>`).join('');
    const power = `<div class="card power"><div class="pleft"><div class="ring">${ic('mdi:lightning-bolt')}</div><div><div class="big">${tot >= 1000 ? fmt(tot / 1000, 1) : fmt(tot)}<small>${tot >= 1000 ? 'kW' : 'W'}</small></div><div class="sub">Potenza istantanea · prese monitorate</div></div>
      <div class="kv"><span>Consumo oggi</span><b>${oggiKwh == null ? '…' : fmt(oggiKwh, 2) + ' kWh'}</b></div><div class="kv"><span>Costo stimato oggi</span><b>${oggiKwh == null ? '…' : fmt(oggiKwh * c.prezzo_kwh, 2) + ' €'}</b></div></div>
      <div class="pright">${bars}</div></div>`;

    // elettrodomestici
    this._history(c.elettrodomestici.map((a) => a.potenza), 12);
    const app = c.elettrodomestici.map((a) => {
      const p = this._n(a.potenza) ?? 0, run = p > (a.soglia ?? 5);
      let mins = null;
      const hs = this._h(a.potenza, 12);
      if (run && hs) { let start = null; for (let i = hs.length - 1; i > 0; i--) { if (hs[i].v > (a.soglia ?? 5) && hs[i - 1].v <= (a.soglia ?? 5)) { start = hs[i].t; break; } } if (start) mins = Math.round((Date.now() - start) / 60000); }
      return `<div class="card app ${run ? 'run' : ''}" data-a="more" data-id="${a.potenza}"><div class="drum">${ic(a.icona || 'mdi:washing-machine')}</div>
        <div><div class="an">${esc(a.nome)}</div><div class="as">${run ? `In funzione${mins != null ? ` · ${mins}'` : ''}` : this._ok(a.potenza) ? 'Spento' : 'Non raggiungibile'}</div></div><span class="sp"></span>${run ? `<b class="aw">${fmt(p)} W</b>` : ''}</div>`;
    }).join('');

    // stanze
    const rooms = c.stanze.map((r, i) => {
      const t = this._n(r.temperatura), u = this._n(r.umidita), co = this._n(r.co2);
      const tl = t == null ? 'sub' : t < 18 ? 'blue' : t <= 24 ? 'ok' : 'warn';
      return `<div class="card room" data-a="tab" data-t="clima">${ic(r.icona || 'mdi:home', 'rwm')}<div class="rn">${ic('mdi:thermometer', 'xs')} ${esc(r.nome)}</div>
        <div class="rt">${fmt(t, 1)}°</div><div class="rm"><span>${ic('mdi:water-outline', 'xs')}${fmt(u)}%</span>${co != null ? `<span class="${lvl(co, 800, 1200)}">${ic('mdi:molecule-co2', 'xs')}${fmt(co)}</span>` : ''}</div>
        <div class="rbar"><i class="${tl}" style="width:${t == null ? 0 : Math.min(100, Math.max(5, ((t - 10) / 20) * 100))}%"></i></div></div>`;
    }).join('');

    // comandi rapidi
    const quick = c.comandi_rapidi.map((q) => this._quick(q)).join('');

    return `<div class="g casa">
      <div class="card clock"><div><div class="dn">${GIORNI[now.getDay()]}</div><div class="dd">${now.getDate()} ${MESI[now.getMonth()]}</div><div class="tm">${hhmm}</div></div>
        <div class="greet"><div class="gh">${greet}${c.nome ? ', ' + esc(c.nome) : ''}</div><div class="ppl">${ppl}</div></div></div>
      ${meteo}
      <div class="card days"><div class="ctl">Prossimi giorni</div><div class="drow">${giorni || '<span class="sub">…</span>'}</div></div>
      <div class="span2">${strip}</div>
      <div class="apps">${app}${this._robotMini()}</div>
      <div class="span2">${power}</div>
      <div class="rooms span3">${rooms}</div>
      <div class="quick span3">${quick}</div>
    </div>`;
  }

  _quick(q) {
    const s = this._st(q.entita); const on = s && ['on', 'open', 'unlocked', 'cleaning'].includes(s.state);
    const lab = !s || !this._ok(q.entita) ? this._stLabel(q.entita) : q.stato === false ? '' : on ? (q.testo_on || this._stLabel(q.entita)) : (q.testo_off || this._stLabel(q.entita));
    return `<button class="qb ${on ? 'on' : ''} ${!this._ok(q.entita) ? 'dis' : ''}" data-a="toggle" data-id="${q.entita}" data-conf="${q.conferma ? 1 : 0}" data-label="${esc(q.conferma_testo || (q.nome + '?'))}">
      ${ic(q.icona || 'mdi:gesture-tap')}<b>${esc(q.nome)}</b>${lab ? `<small>${esc(lab)}</small>` : ''}</button>`;
  }

  /* ===== CLIMA ===== */
  _vClima() {
    const c = this._cfg, ids = [];
    c.stanze.forEach((r) => ['temperatura', 'umidita', 'co2'].forEach((k) => r[k] && ids.push(r[k])));
    if (c.esterno) ids.push(c.esterno.temperatura, c.esterno.umidita);
    this._history(ids, 24);
    this._history([c.sicurezza.radon], 168);
    const metrics = [['temperatura', 'Temp.', COL.orange, '°', 'Temperatura'], ['umidita', 'Umidità', COL.blue, '%', 'Umidità'], ['co2', 'CO₂', COL.ok, ' ppm', 'CO₂']];
    const card = (r, key, ext = false) => {
      const avail = metrics.filter(([k]) => r[k]);
      const m = this._metric[key] && r[this._metric[key]] ? this._metric[key] : avail[0][0];
      const [, , mc, mu, ml] = metrics.find(([k]) => k === m);
      const t = this._n(r.temperatura), u = this._n(r.umidita), co = this._n(r.co2);
      const hist = this._h(r[m], 24);
      const vals = hist ? hist.map((p) => p.v) : [];
      const mn = vals.length ? Math.min(...vals) : null, mx2 = vals.length ? Math.max(...vals) : null;
      return `<div class="card clima"><div class="ch"><div class="cn">${ic(r.icona || 'mdi:home', 'xs')} ${esc(r.nome)}</div><span class="sp"></span>
        <div class="seg">${avail.map(([k, l]) => `<button class="${k === m ? 'on' : ''}" data-a="metric" data-r="${key}" data-m="${k}">${l}</button>`).join('')}</div></div>
        <div class="cbig"><div class="ct">${fmt(t, 1)}°</div><div class="cside">
          ${u != null ? `<div>${ic('mdi:water-outline', 'xs')} <b>${fmt(u)}%</b> <span class="dots3">${[30, 40, 60, 70].map((x, i) => `<i class="${(i < 2 ? u >= x : u >= x) ? (u > 60 || u < 35 ? 'warn' : 'ok') : ''}"></i>`).join('')}</span></div>` : ''}
          ${co != null ? `<div class="${lvl(co, 800, 1200)}">${ic('mdi:molecule-co2', 'xs')} <b>${fmt(co)} ppm</b> <span class="sub">${co < 800 ? 'aria buona' : co < 1200 ? 'arieggiare presto' : 'arieggiare ora'}</span></div>` : ''}
          ${ext ? `<div class="sub">${ic('mdi:home-export-outline', 'xs')} esterno</div>` : ''}</div></div>
        <div class="chart">${spark(hist, { color: mc })}</div>
        <div class="cfoot"><span>${ml} · 24 ore</span><span class="sp"></span>${mn != null ? `<span>min ${fmt(mn, m === 'temperatura' ? 1 : 0)}${mu} · max ${fmt(mx2, m === 'temperatura' ? 1 : 0)}${mu}</span>` : ''}</div></div>`;
    };
    const s = c.sicurezza;
    const rn = this._n(s.radon);
    const radon = s.radon ? `<div class="card radon" data-a="more" data-id="${s.radon}"><div class="ch"><div class="cn">${ic('mdi:radioactive', 'xs')} Radon · cantina</div><span class="sp"></span><span class="pill ${lvl(rn, 100, 300)}">${rn == null ? '—' : rn < 100 ? 'nella norma' : rn < 300 ? 'sopra i 100' : 'alto'}</span></div>
      <div class="cbig"><div class="ct">${fmt(rn)}<small> Bq/m³</small></div><div class="cside sub"><div>Riferimento OMS 100</div><div>Limite UE/Italia 300</div></div></div>
      <div class="chart">${spark(this._h(s.radon, 168), { color: COL.purple, lo: 0 })}</div><div class="cfoot"><span>ultimi 7 giorni</span></div></div>` : '';
    const coA = s.co_allarme, coL = this._n(s.co_livello);
    const leaks = s.perdite.map((id) => `<div class="kv" data-a="more" data-id="${id}"><span>${ic('mdi:water-alert-outline', 'xs')} ${esc(this._name(id))}</span><b class="${this._on(id) ? 'bad' : this._ok(id) ? 'ok' : 'sub'}">${this._on(id) ? 'PERDITA' : this._ok(id) ? 'Asciutto' : 'Non disponibile'}</b></div>`).join('');
    const sic = `<div class="card sic"><div class="cn">${ic('mdi:shield-home-outline', 'xs')} Sicurezza</div>
      ${coA ? `<div class="kv" data-a="more" data-id="${coA}"><span>${ic('mdi:molecule-co', 'xs')} Monossido (CO)</span><b class="${this._on(coA) ? 'bad' : 'ok'}">${this._on(coA) ? 'ALLARME' : 'Nessun allarme'}${coL != null ? ` · ${fmt(coL)} ppm` : ''}</b></div>` : ''}${leaks}</div>`;
    return `<div class="g clima-g">${c.stanze.map((r, i) => card(r, 'r' + i)).join('')}${c.esterno ? card({ nome: 'Esterno', icona: 'mdi:balcony', ...c.esterno }, 'ext', true) : ''}${radon}${sic}</div>`;
  }

  /* ===== ENERGIA ===== */
  _vEnergia() {
    const c = this._cfg; this._energyStats();
    const pw = c.consumi.map((x) => ({ ...x, v: this._n(x.entita) ?? 0 }));
    const tot = pw.reduce((a, b) => a + b.v, 0), mx = Math.max(...pw.map((p) => p.v), 1);
    const st = this._stats, d0 = new Date(); d0.setHours(0, 0, 0, 0);
    const oggi = st ? st.days[d0.getTime()] ?? 0 : null;
    const mese = st ? Object.entries(st.days).filter(([k]) => +k >= st.monthStart).reduce((a, [, v]) => a + v, 0) : null;
    const pr = c.prezzo_kwh;
    const days = [];
    for (let i = 29; i >= 0; i--) { const d = new Date(d0.getTime() - i * 86400e3); const v = st ? st.days[d.getTime()] || 0 : 0; days.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, short: `${d.getDate()}/${d.getMonth() + 1}`, v: this._eUnit === '€' ? v * pr : v }); }
    const perApp = c.energia.map((e) => ({ ...e, v: st?.perId[e.entita] ?? null })).sort((a, b) => (b.v || 0) - (a.v || 0));
    const pmx = Math.max(...perApp.map((p) => p.v || 0), 0.001);
    return `<div class="g energia-g">
      <div class="card"><div class="cn">${ic('mdi:flash-outline', 'xs')} Adesso</div><div class="big">${fmt(tot)}<small>W</small></div><div class="sub">somma delle prese monitorate</div>
        <div class="plist">${[...pw].sort((a, b) => b.v - a.v).map((p) => `<div class="pbar" data-a="more" data-id="${p.entita}"><span>${esc(p.nome)}</span><div class="track"><i style="width:${(p.v / mx) * 100}%"></i></div><b>${fmt(p.v)} W</b></div>`).join('')}</div></div>
      <div class="card cost"><div class="ctab"><span></span><b>Oggi</b><b>${MESI[d0.getMonth()][0].toUpperCase() + MESI[d0.getMonth()].slice(1)}</b>
        <span>Consumo</span><div><big>${oggi == null ? '…' : fmt(oggi, 2)}</big><small>kWh</small></div><div><big>${mese == null ? '…' : fmt(mese, 1)}</big><small>kWh</small></div>
        <span>Costo stimato</span><div><big class="cost-v">${oggi == null ? '…' : fmt(oggi * pr, 2) + ' €'}</big></div><div><big class="cost-v">${mese == null ? '…' : fmt(mese * pr, 2) + ' €'}</big></div></div>
        <div class="sub small">Prezzo: ${fmt(pr, 2)} €/kWh · solo prese con contatore</div>
        <div class="cn mt">Per apparecchio · mese</div>${perApp.map((p) => `<div class="pbar" data-a="more" data-id="${p.entita}"><span>${esc(p.nome)}</span><div class="track"><i style="width:${((p.v || 0) / pmx) * 100}%;background:${COL.orange}"></i></div><b>${p.v == null ? '—' : fmt(p.v, 1) + ' kWh'}</b></div>`).join('')}</div>
      <div class="card span2"><div class="ch"><div class="cn">${ic('mdi:chart-bar', 'xs')} Ultimi 30 giorni</div><span class="sp"></span><div class="seg">${['kWh', '€'].map((u) => `<button class="${this._eUnit === u ? 'on' : ''}" data-a="eunit" data-u="${u}">${u}</button>`).join('')}</div></div>
        ${barChart(days, { h: 190, color: 'rgba(79,209,232,.55)', unit: this._eUnit, dec: 2 })}
        <div class="cfoot"><span>Oggi ${oggi == null ? '…' : fmt(this._eUnit === '€' ? oggi * pr : oggi, 2) + ' ' + this._eUnit}</span></div></div>
    </div>`;
  }

  /* ===== TELECAMERE ===== */
  _vCam() {
    let cams = this._cfg.telecamere;
    if (!cams.length) cams = Object.keys(this._hass.states).filter((k) => k.startsWith('camera.')).map((k) => ({ entita: k }));
    const t = Math.floor(Date.now() / 10000);
    return `<div class="g cam-g">${cams.map((cm) => {
      const s = this._st(cm.entita); const nm = cm.nome || this._name(cm.entita);
      const pic = s && s.attributes.entity_picture;
      const okCam = pic && s.state !== 'unavailable';
      const url = okCam ? `${pic}${pic.includes('?') ? '&' : '?'}t=${t}` : '';
      this._camPrev = this._camPrev || {};
      const prev = this._camPrev[cm.entita]; if (okCam) this._camPrev[cm.entita] = url;
      return `<div class="card cam" data-a="more" data-id="${cm.entita}" ${prev && okCam ? `style="background:#050a14 url('${esc(prev)}') center/cover"` : ''}>${okCam ? `<img src="${esc(url)}">` : `<div class="nocam">${ic('mdi:cctv-off')}<span>Non disponibile</span></div>`}
        <div class="camlab"><span class="live ${okCam ? '' : 'off'}"></span><b>${esc(nm)}</b><span class="sp"></span>${ic('mdi:fullscreen', 'xs')}</div></div>`;
    }).join('')}</div><div class="sub center small">Tocca una telecamera per la diretta a tutto schermo</div>`;
  }

  /* ===== PURIFICATORI ===== */
  _vAria() {
    const c = this._cfg;
    this._history(c.purificatori.map((p) => p.pm25), 24);
    return `<div class="g aria-g">${c.purificatori.map((p) => {
      const s = this._st(p.ventola); const on = s && s.state === 'on';
      const pm = this._n(p.pm25); const L = lvl(pm, 12, 35);
      const presets = (s && s.attributes.preset_modes) || [];
      const pct = s && s.attributes.percentage;
      const fl = this._n(p.filtro);
      return `<div class="card pur ${on ? 'on' : ''}"><div class="ch"><div class="cn">${ic(p.icona || 'mdi:air-purifier', 'xs')} ${esc(p.nome)}</div><span class="sp"></span>
        <button class="pwr ${on ? 'on' : ''}" data-a="toggle" data-id="${p.ventola}">${ic('mdi:power')}</button></div>
        ${p.pm25 ? `<div class="cbig"><div class="ct ${L}">${fmt(pm)}<small> µg/m³</small></div><div class="cside sub"><div>PM2.5</div><div class="${L}">${pm == null ? '' : pm < 12 ? 'aria pulita' : pm < 35 ? 'moderata' : 'scadente'}</div></div></div>
        <div class="chart sm">${spark(this._h(p.pm25, 24), { color: COL.ok, lo: 0 })}</div>` : `<div class="fanbig ${on ? 'on' : ''}">${ic(p.icona || 'mdi:fan')}</div>`}
        <div class="prow">${pct != null ? `<span class="sub">Velocità</span><button class="kbtn" data-a="speed" data-id="${p.ventola}" data-dir="-">−</button><b>${fmt(pct)}%</b><button class="kbtn" data-a="speed" data-id="${p.ventola}" data-dir="+">+</button>` : `<span class="sub">${!s ? 'Non trovato' : s.state === 'unavailable' ? 'Non raggiungibile' : on ? 'In funzione' : 'Spento'}</span>`}</div>
        ${presets.length ? `<div class="seg wide">${presets.map((m) => `<button class="${s.attributes.preset_mode === m ? 'on' : ''}" data-a="preset" data-id="${p.ventola}" data-m="${esc(m)}">${esc(m.charAt(0).toUpperCase() + m.slice(1))}</button>`).join('')}</div>` : ''}
        ${p.filtro ? `<div class="pbar"><span>Filtro</span><div class="track"><i style="width:${Math.min(100, fl ?? 0)}%;background:${(fl ?? 100) < 15 ? COL.bad : COL.ok}"></i></div><b>${fmt(fl)}${esc(this._u(p.filtro))}</b></div>` : ''}
      </div>`;
    }).join('')}</div>`;
  }

  /* ===== COMANDI ===== */
  _vComandi() {
    const c = this._cfg;
    if (this._locked()) {
      return `<div class="lockview card">${ic('mdi:lock-outline', 'lbig')}<div class="dt">Comandi bloccati</div><div class="ds">Per accendere, spegnere o aprire serve il codice.</div>
        <button class="btn pri" data-a="unlock">${ic('mdi:dialpad')} Inserisci codice</button></div>`;
    }
    const quickIds = new Set(c.comandi_rapidi.map((q) => q.entita));
    const ents = Object.keys(this._hass.states).filter((id) => /^(light|switch|fan|cover|vacuum|lock)\./.test(id)
      && !quickIds.has(id) && !this._excluded(id) && !c.escludi_comandi.some((r) => r.test(id)));
    const areaOf = (id) => {
      const e = this._hass.entities?.[id]; if (!e) return 'Altro';
      const aid = e.area_id || (e.device_id && this._hass.devices?.[e.device_id]?.area_id);
      return (aid && this._hass.areas?.[aid]?.name) || 'Altro';
    };
    const groups = {};
    ents.forEach((id) => { const a = areaOf(id); (groups[a] = groups[a] || []).push(id); });
    const domIc = { light: 'mdi:lightbulb-outline', switch: 'mdi:power-socket-eu', fan: 'mdi:fan', cover: 'mdi:blinds', vacuum: 'mdi:robot-vacuum', lock: 'mdi:lock' };
    const tile = (id) => {
      const s = this._st(id); const on = ['on', 'open', 'unlocked', 'cleaning'].includes(s.state);
      const icon = s.attributes.icon || domIc[id.split('.')[0]];
      const nm = (s.attributes.friendly_name || id);
      return `<button class="ctl-t ${on ? 'on' : ''} ${!this._ok(id) ? 'dis' : ''}" data-a="toggle" data-id="${id}">${ic(icon)}<div><b>${esc(nm)}</b><small>${esc(this._stLabel(id))}</small></div></button>`;
    };
    const areas = Object.keys(groups).sort((a, b) => (a === 'Altro') - (b === 'Altro') || a.localeCompare(b));
    return `<div class="g com-g">
      <div class="card span3"><div class="ch"><div class="cn">${ic('mdi:star-outline', 'xs')} Rapidi</div><span class="sp"></span><button class="btn ghost sm" data-a="lock">${ic('mdi:lock-outline')} Blocca ora</button></div>
        <div class="quick">${c.comandi_rapidi.map((q) => this._quick(q)).join('')}</div></div>
      ${areas.map((a) => `<div class="card"><div class="cn">${esc(a)}</div><div class="ctl-list">${groups[a].map(tile).join('')}</div></div>`).join('')}
    </div>`;
  }

  /* ===== ROBOT ===== */
  _robot() {
    const c = this._cfg.robot; if (!c || !this._hass) return null;
    const v = this._st(c.entita); if (!v) return { id: c.entita, nome: c.nome || 'Robot', missing: true, parts: [], rooms: {} };
    const obj = c.entita.split('.')[1], P = (dom) => Object.keys(this._hass.states).filter((k) => k.startsWith(`${dom}.${obj}_`));
    const find = (dom, suf) => (c[suf] || `${dom}.${obj}_${suf}`);
    const sens = P('sensor');
    const parts = sens.filter((k) => this._u(k) === '%' && !/batteria|battery/.test(k)).map((k) => {
      const suf = k.slice(`sensor.${obj}_`.length);
      let n = PART_LBL[suf] || (this._name(k) || suf).replace(new RegExp('^' + (v.attributes.friendly_name || '') + '\\s*', 'i'), '').replace(/^durata (della |del |dello |dell')?/i, '').replace(/ lifespan$/i, '');
      return { id: k, nome: n.charAt(0).toUpperCase() + n.slice(1), v: this._n(k) };
    }).sort((a, b) => (a.v ?? 999) - (b.v ?? 999));
    return {
      id: c.entita, nome: c.nome || v.attributes.friendly_name || 'Robot', st: v, rooms: v.attributes.rooms || {},
      bat: c.batteria || sens.find((k) => /batteria|battery/.test(k)),
      map: c.mappa || P('image')[0], station: c.stazione || sens.find((k) => /station_state|stato_stazione/.test(k)),
      mop: c.mocio || P('binary_sensor')[0], water: c.acqua || P('number')[0],
      buttons: P('button'), switches: P('switch'), selects: P('select'),
      area: find('sensor', 'area_pulita'), dur: find('sensor', 'durata_pulizia'), tArea: find('sensor', 'area_totale_pulita'), tDur: find('sensor', 'total_cleaning_duration'), tN: find('sensor', 'pulizie_totali'),
      parts,
    };
  }
  _robotMini() {
    const R = this._robot(); if (!R || R.missing) return '';
    const s = R.st.state, run = ['cleaning', 'returning'].includes(s), b = this._n(R.bat);
    const err = s === 'error';
    return `<div class="card app ${run ? 'run' : ''} ${err ? 'err' : ''}" data-a="tab" data-t="robot"><div class="drum">${ic('mdi:robot-vacuum')}</div>
      <div><div class="an">${esc(R.nome)}</div><div class="as">${esc(VAC_ST[s] || s)}</div></div><span class="sp"></span>${b != null ? `<b class="aw">${ic(b > 20 ? 'mdi:battery-high' : 'mdi:battery-low', 'xs')} ${fmt(b)}%</b>` : ''}</div>`;
  }
  _vRobot() {
    const R = this._robot();
    if (!R || R.missing) return `<div class="lockview card">${ic('mdi:robot-vacuum-off', 'lbig')}<div class="dt">Robot non trovato</div><div class="ds">Controlla "robot → entita" nella configurazione.</div></div>`;
    const a = R.st.attributes, s = R.st.state, id = R.id;
    const b = this._n(R.bat), run = s === 'cleaning', bc = b == null ? COL.sub : b <= 20 ? COL.bad : b <= 40 ? COL.warn : COL.ok;
    const stn = this._v(R.station);
    const fanL = (a.fan_speed_list || []);
    const wt = this._st(R.water);
    const btn = (svc, icon, label, cls = '') => `<button class="rb ${cls}" data-a="vac" data-s="${svc}" data-id="${id}">${ic(icon)}<span>${label}</span></button>`;
    const status = `<div class="card rstat ${run ? 'run' : ''} ${s === 'error' ? 'err' : ''}">
      <div class="rhead"><div class="rbot">${ic('mdi:robot-vacuum')}</div><div><div class="cn">${esc(R.nome)}</div><div class="rst">${esc(VAC_ST[s] || s)}</div>
        <div class="sub small">${stn ? `Stazione: ${esc(STATION_ST[stn] || stn)}` : ''}${R.mop && this._st(R.mop) ? ` · Mocio ${this._on(R.mop) ? 'montato' : 'non montato'}` : ''}</div></div>
        <span class="sp"></span><div class="rbat"><div class="rbv" style="color:${bc}">${fmt(b)}<small>%</small></div><div class="track thin"><i style="width:${b || 0}%;background:${bc}"></i></div></div></div>
      <div class="rbtns">${run ? btn('pause', 'mdi:pause', 'Pausa', 'pri') : btn('start', 'mdi:play', s === 'paused' ? 'Riprendi' : 'Pulisci tutto', 'pri')}
        ${btn('return_to_base', 'mdi:home-import-outline', 'Alla base')}${btn('stop', 'mdi:stop', 'Stop')}${btn('locate', 'mdi:map-marker-radius-outline', 'Trova')}</div>
      ${fanL.length ? `<div class="rrow col"><span class="sub">Aspirazione</span><div class="seg">${fanL.map((f) => `<button class="${a.fan_speed === f ? 'on' : ''}" data-a="vac" data-s="set_fan_speed" data-id="${id}" data-v='${JSON.stringify({ fan_speed: f })}'>${esc(FAN_LBL[f] || f)}</button>`).join('')}</div></div>` : ''}
      ${wt ? `<div class="rrow"><span class="sub">Acqua mocio</span><div class="wctl"><button class="kbtn" data-a="num" data-id="${R.water}" data-d="-5">−</button><b>${fmt(this._n(R.water))}</b><button class="kbtn" data-a="num" data-id="${R.water}" data-d="5">+</button><span class="sub small">/ ${fmt(wt.attributes.max)}</span></div></div>` : ''}
    </div>`;
    const mp = this._st(R.map);
    const map = `<div class="card rmap" ${R.map ? `data-a="more" data-id="${R.map}"` : ''}><div class="cn">${ic('mdi:map-outline', 'xs')} Mappa${mp && mp.attributes.map_name ? ` · ${esc(mp.attributes.map_name)}` : ''}</div>
      <div class="mapbox">${mp && mp.attributes.entity_picture ? `<img src="${esc(mp.attributes.entity_picture.startsWith('data:') ? mp.attributes.entity_picture : `${mp.attributes.entity_picture}${mp.attributes.entity_picture.includes('?') ? '&' : '?'}v=${encodeURIComponent(mp.state)}`)}">` : `<div class="nodata">Mappa non disponibile</div>`}</div></div>`;
    const rk = Object.keys(R.rooms);
    const rooms = `<div class="card"><div class="ch"><div class="cn">${ic('mdi:floor-plan', 'xs')} Pulisci stanze</div><span class="sp"></span><button class="pill pbtn" data-a="passes">${this._passes}× passata</button></div>
      <div class="rgrid">${rk.map((k) => `<button class="rchip ${this._rooms.has(k) ? 'on' : ''}" data-a="room" data-k="${esc(k)}">${ic(ROOM_IC[k] || 'mdi:floor-plan')}<span>${esc(k.replace(/_/g, ' ').replace(/^./, (x) => x.toUpperCase()))}</span></button>`).join('') || '<div class="sub">Nessuna stanza dalla mappa</div>'}</div>
      <button class="btn pri wide" data-a="rooms-go" ${this._rooms.size ? '' : 'disabled'}>${ic('mdi:robot-vacuum')} ${this._rooms.size ? `Pulisci ${this._rooms.size} ${this._rooms.size === 1 ? 'stanza' : 'stanze'}` : 'Seleziona le stanze'}</button></div>`;
    const bts = R.buttons.map((k) => { const suf = k.slice(`button.${id.split('.')[1]}_`.length); const [l, i] = BTN_LBL[suf] || [this._name(k).replace(R.nome + ' ', ''), 'mdi:gesture-tap'];
      return `<button class="sbtn" data-a="press" data-id="${k}" data-conf="0" data-label="${esc(l)}?">${ic(i)}<span>${esc(l)}</span></button>`; }).join('');
    const sws = R.switches.map((k) => `<div class="kv"><span>${esc(this._name(k).replace(R.nome + ' ', ''))}</span><button class="tgl ${this._on(k) ? 'on' : ''}" data-a="toggle" data-id="${k}"><i></i></button></div>`).join('');
    const sels = R.selects.map((k) => { const st = this._st(k); return `<div class="kv"><span>${esc(this._name(k).replace(R.nome + ' ', ''))}</span><div class="seg">${(st.attributes.options || []).map((o) => `<button class="${st.state === o ? 'on' : ''}" data-a="sel" data-id="${k}" data-o="${esc(o)}">${esc(o === 'auto' ? 'Sempre' : o === 'smart' ? 'Smart' : o)}</button>`).join('')}</div></div>`; }).join('');
    const station = `<div class="card"><div class="cn">${ic('mdi:home-roof', 'xs')} Stazione</div><div class="sgrid">${bts}</div>${sws}${sels}</div>`;
    const stat = (k, l, d = 0, u = '') => this._st(k) ? `<div class="st1"><b>${fmt(this._n(k), d)}<small>${u || esc(this._u(k))}</small></b><span>${l}</span></div>` : '';
    const stats = `<div class="card"><div class="cn">${ic('mdi:chart-box-outline', 'xs')} Pulizie</div>
      <div class="ctl sub small mt">Ultima</div><div class="sts">${stat(R.area, 'area')}${stat(R.dur, 'durata', 0, ' min')}</div>
      <div class="ctl sub small">Totale</div><div class="sts">${stat(R.tArea, 'area')}${stat(R.tDur, 'ore', 0, ' h')}${stat(R.tN, 'pulizie', 0, ' ')}</div></div>`;
    const colP = (v) => (v == null ? COL.sub : v <= 10 ? COL.bad : v <= 25 ? COL.warn : COL.ok);
    const parts = `<div class="card rparts"><div class="cn">${ic('mdi:wrench-outline', 'xs')} Ricambi e manutenzione</div><div class="plist3">
      ${R.parts.map((x) => `<div class="bat" data-a="more" data-id="${x.id}"><div class="bt"><span>${esc(x.nome)}</span><b style="color:${colP(x.v)}">${fmt(x.v)}%</b></div><div class="track thin"><i style="width:${x.v || 0}%;background:${colP(x.v)}"></i></div></div>`).join('')}</div></div>`;
    return `<div class="g robot-g">${status}${map}${rooms}${station}${stats}${parts}</div>`;
  }

  /* ===== MUSICA ===== */
  _spotifyId() { return this._cfg.musica.spotify || Object.keys(this._hass.states).find((k) => k.startsWith('media_player.spotify')); }
  _playSpotify(uri) {
    const id = this._spotifyId(); if (!id || !uri) return;
    const type = uri.split(':')[1] || 'playlist';
    const src = this._cfg.musica.dispositivo_predefinito;
    const st = this._st(id);
    const go = () => this._hass.callService('media_player', 'play_media', { entity_id: id, media_content_id: uri, media_content_type: type === 'track' ? 'music' : type });
    if (src && st && st.attributes.source !== src && (st.attributes.source_list || []).includes(src)) this._hass.callService('media_player', 'select_source', { entity_id: id, source: src }).then(() => setTimeout(go, 1200));
    else go();
  }
  _openRadio(i) {
    const r = this._cfg.musica.radio[i]; if (!r) return;
    // stop Spotify se sta suonando, per non sovrapporre
    const sp = this._spotifyId(); if (sp && this._v(sp) === 'playing' && this._cfg.musica.pausa_spotify_con_radio !== false) this._hass.callService('media_player', 'media_pause', { entity_id: sp });
    this._radio = i;
    this._dock.className = 'dock on';
    this._dock.innerHTML = `<div class="dk-h">${ic('mdi:radio')}<b>${esc(r.nome)}</b><span class="sub dk-s">sul tablet</span><span class="sp"></span><button class="dk-x" data-a="radio-min" title="Riduci">${ic('mdi:chevron-down')}</button><button class="dk-x" data-a="radio-close" title="Stop">${ic('mdi:stop')}</button></div>
      <iframe src="${esc(r.player)}" allow="autoplay; encrypted-media" referrerpolicy="no-referrer-when-downgrade" scrolling="no"></iframe>`;
    if (this._tab === 'musica') this._render(true);
  }
  _vMusica() {
    const m = this._cfg.musica, id = this._spotifyId(), s = this._st(id);
    let sp;
    if (!s) {
      sp = `<div class="card np empty">${ic('mdi:spotify', 'spbig')}<div class="dt">Spotify non collegato</div>
        <div class="ds">Impostazioni → Dispositivi e servizi → Aggiungi integrazione → Spotify (serve un'app su developer.spotify.com, account Premium).</div></div>`;
    } else {
      const a = s.attributes, playing = s.state === 'playing', idle = !['playing', 'paused'].includes(s.state);
      let pos = a.media_position || 0; const dur = a.media_duration || 0;
      if (playing && a.media_position_updated_at) pos += (Date.now() - Date.parse(a.media_position_updated_at)) / 1000;
      pos = Math.min(pos, dur || pos);
      const mmss = (x) => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}`;
      const vol = a.volume_level;
      const srcs = (a.source_list || []);
      sp = `<div class="card np">
        <div class="art">${a.entity_picture && !idle ? `<img src="${esc(a.entity_picture)}">` : ic('mdi:spotify', 'spbig')}</div>
        <div class="npi">
          <div class="npk">${ic('mdi:spotify', 'xs')} Spotify${a.source ? ` · ${esc(a.source)}` : ''}</div>
          <div class="npt">${idle ? 'Niente in riproduzione' : esc(a.media_title || '')}</div>
          <div class="npa">${idle ? 'Scegli una playlist o un dispositivo' : esc([a.media_artist, a.media_album_name].filter(Boolean).join(' · '))}</div>
          ${dur && !idle ? `<div class="prog"><div class="track thin"><i style="width:${(pos / dur) * 100}%"></i></div><div class="pt"><span>${mmss(pos)}</span><span>${mmss(dur)}</span></div></div>` : ''}
          ${idle ? `<div class="ctrl idle">${m.playlist.length ? `<button class="btn pri" data-a="pl" data-uri="${esc(m.playlist[0].uri)}">${ic('mdi:play')} ${esc(m.playlist[0].nome)}</button>` : ''}<span class="sub small">${m.playlist.length ? 'oppure tocca una playlist' : 'Avvia la musica dall\'app Spotify o aggiungi delle playlist'}</span></div>` : `<div class="ctrl">
            <button class="cb sm ${a.shuffle ? 'on' : ''}" data-a="mp" data-s="shuffle_set" data-id="${id}" data-v='${JSON.stringify({ shuffle: !a.shuffle })}'>${ic('mdi:shuffle-variant')}</button>
            <button class="cb" data-a="mp" data-s="media_previous_track" data-id="${id}">${ic('mdi:skip-previous')}</button>
            <button class="cb play" data-a="mp" data-s="media_play_pause" data-id="${id}">${ic(playing ? 'mdi:pause' : 'mdi:play')}</button>
            <button class="cb" data-a="mp" data-s="media_next_track" data-id="${id}">${ic('mdi:skip-next')}</button>
            <button class="cb sm ${a.repeat && a.repeat !== 'off' ? 'on' : ''}" data-a="mp" data-s="repeat_set" data-id="${id}" data-v='${JSON.stringify({ repeat: a.repeat === 'off' || !a.repeat ? 'all' : a.repeat === 'all' ? 'one' : 'off' })}'>${ic(a.repeat === 'one' ? 'mdi:repeat-once' : 'mdi:repeat')}</button>
          </div>`}
          ${vol != null && !idle ? `<div class="volr"><button class="cb sm" data-a="vol" data-id="${id}" data-d="-0.05">${ic('mdi:volume-minus')}</button><div class="track"><i style="width:${vol * 100}%"></i></div><button class="cb sm" data-a="vol" data-id="${id}" data-d="0.05">${ic('mdi:volume-plus')}</button><b>${fmt(vol * 100)}%</b></div>` : ''}
        </div></div>`;
      if (srcs.length) sp += `<div class="card"><div class="cn">${ic('mdi:speaker-multiple', 'xs')} Riproduci su</div><div class="chips">${srcs.map((x) => `<button class="chip ${a.source === x ? 'on' : ''}" data-a="src" data-id="${id}" data-src="${esc(x)}">${ic(/echo|alexa/i.test(x) ? 'mdi:speaker' : /tv|fire/i.test(x) ? 'mdi:television' : /iphone/i.test(x) ? 'mdi:cellphone' : /ipad/i.test(x) ? 'mdi:tablet' : /mac|pc|web/i.test(x) ? 'mdi:laptop' : 'mdi:speaker-wireless', 'xs')}${esc(x)}</button>`).join('')}</div>
        <div class="sub small mt0">Se un dispositivo non compare, apri Spotify sul telefono e seleziona una volta quel dispositivo.</div></div>`;
    }
    const pls = m.playlist.length
      ? `<div class="plg">${m.playlist.map((x) => `<button class="pl" data-a="pl" data-uri="${esc(x.uri)}">${x.immagine ? `<img src="${esc(x.immagine)}">` : `<span class="plic" style="background:${esc(x.colore || 'linear-gradient(135deg,#1db954,#0f5f33)')}">${ic(x.icona || 'mdi:playlist-music')}</span>`}<b>${esc(x.nome)}</b></button>`).join('')}</div>`
      : `<div class="sub">Aggiungi le tue playlist in <b>musica → playlist</b> nella configurazione (basta incollare il link "Condividi" di Spotify).</div>`;
    const radios = m.radio.map((r, i) => {
      const on = this._radio === i;
      return `<div class="radio ${on ? 'on' : ''}"><div class="rlogo">${r.logo ? `<img src="${esc(r.logo)}">` : ic('mdi:radio-tower')}</div>
        <div class="rinfo"><b>${esc(r.nome)}</b><small>${on ? 'In ascolto sul tablet' : esc(r.descrizione || 'Diretta')}</small></div><span class="sp"></span>
        ${on ? `<button class="btn ghost sm" data-a="radio-close">${ic('mdi:stop')} Stop</button>` : `<button class="btn pri sm" data-a="radio" data-i="${i}">${ic('mdi:tablet')} Tablet</button>`}
        ${m.alexa ? `<button class="btn ghost sm" data-a="radio-alexa" data-i="${i}">${ic('mdi:speaker')} Echo</button>` : ''}</div>`;
    }).join('');
    return `<div class="g mus-g">
      <div class="mcol">${sp}</div>
      <div class="mcol">
        <div class="card"><div class="cn">${ic('mdi:playlist-music', 'xs')} Playlist</div>${pls}</div>
        ${m.radio.length ? `<div class="card"><div class="cn">${ic('mdi:radio', 'xs')} Radio</div>${radios}</div>` : ''}
      </div></div>`;
  }

  /* ===== AVVISI ===== */
  _vAvvisi(alerts) {
    const bats = this._batteries();
    const off = this._configuredIds().filter((id) => !this._ok(id));
    const unav = Object.values(this._hass.states).filter((s) => s.state === 'unavailable').length;
    const upd = Object.values(this._hass.states).filter((x) => x.entity_id.startsWith('update.') && x.state === 'on');
    const colB = (v) => (v <= 15 ? COL.bad : v <= 30 ? COL.warn : COL.ok);
    return `<div class="g avv-g">
      <div class="card"><div class="cn">Avvisi attivi <span class="cnt">${alerts.length}</span></div>
        ${alerts.length ? alerts.map((a) => `<div class="alert ${a.l}" ${a.id ? `data-a="more" data-id="${a.id}"` : a.go && a.go !== 'avvisi' ? `data-a="tab" data-t="${a.go}"` : ''}>${ic(a.i)}<div><b>${esc(a.t)}</b><small>${esc(a.s || '')}</small></div></div>`).join('') : `<div class="alert ok">${ic('mdi:check-circle-outline')}<div><b>Nessun avviso</b><small>tutto regolare</small></div></div>`}</div>
      <div class="card"><div class="cn">Batterie <span class="cnt">${bats.length}</span></div><div class="blist">
        ${bats.map((b) => `<div class="bat" data-a="more" data-id="${b.id}"><div class="bt"><span class="${b.v <= 15 ? 'bad' : ''}">${esc(b.name)}</span><b style="color:${colB(b.v)}">${fmt(b.v)}%</b></div><div class="track thin"><i style="width:${b.v}%;background:${colB(b.v)}"></i></div></div>`).join('') || '<div class="sub">Nessun sensore con batteria</div>'}</div></div>
      <div class="card"><div class="cn">Salute della casa</div>
        <div class="kv"><span>Aggiornamenti</span><b class="${upd.length ? 'warn' : 'ok'}">${upd.length ? upd.length + ' disponibili' : 'tutto aggiornato'}</b></div>
        ${upd.map((u) => `<div class="kv sm" data-a="more" data-id="${u.entity_id}"><span>${esc(u.attributes.friendly_name)}</span><b class="sub">${esc(u.attributes.latest_version || '')}</b></div>`).join('')}
        <div class="kv"><span>Dispositivi della dashboard non raggiungibili</span><b class="${off.length ? 'warn' : 'ok'}">${off.length}</b></div>
        ${off.map((id) => `<div class="kv sm" data-a="more" data-id="${id}"><span>${esc(this._name(id))}</span><b class="sub">${this._v(id) === 'unavailable' ? 'non raggiungibile' : this._v(id) === 'unknown' ? 'sconosciuto' : 'non trovato'}</b></div>`).join('')}
        <div class="bignum"><b>${unav}</b><span>entità non disponibili in tutto Home Assistant<br><small class="sub">molte sono normali: doppioni disattivati, dispositivi spenti</small></span></div>
        <div class="sub small">casa-panel v${CP_VERSION}</div></div>
    </div>`;
  }
}

/* ---------- stile ---------- */
const CSS = `
:host{display:block;width:100%;max-width:100%;min-width:0;contain:inline-size;--bg:#0a1426;--line:rgba(120,170,230,.14);--txt:#e9f2ff;--sub:#8ea3c0;--acc:#4fd1e8;--ok:#3ddc97;--warn:#f6b93b;--bad:#ff5d6c;--blue:#5aa9ff;
  font-family:'Barlow','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:var(--txt);-webkit-font-smoothing:antialiased}
*{box-sizing:border-box}
.wrap{height:100vh;display:flex;flex-direction:column;padding:14px;gap:14px;
  background:radial-gradient(1100px 600px at 15% -10%,#17325c 0%,transparent 60%),radial-gradient(900px 500px at 110% 110%,#0f2b45 0%,transparent 60%),linear-gradient(180deg,#0b1629,#070f1d)}
.main{flex:1;min-width:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.main::-webkit-scrollbar{display:none}
ha-icon{--mdc-icon-size:22px;display:inline-flex}
ha-icon.xs{--mdc-icon-size:16px;opacity:.85;vertical-align:-2px}
.sub{color:var(--sub)} .small{font-size:12px} .center{text-align:center;margin-top:10px}
.ok{color:var(--ok)} .warn{color:var(--warn)} .bad{color:var(--bad)} .blue{color:var(--blue)}
.sp{flex:1}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
/* nav */
.nav{display:flex;align-items:center;gap:4px;padding:7px;border-radius:24px;background:rgba(14,26,46,.85);border:1px solid var(--line);
  box-shadow:0 8px 30px rgba(0,0,0,.3);overflow-x:auto;scrollbar-width:none;flex-shrink:0}
.nav::-webkit-scrollbar{display:none}
.tb{display:flex;align-items:center;gap:9px;padding:11px 18px;border-radius:16px;font-size:17px;font-weight:500;color:#cfe0f5;white-space:nowrap;border:1px solid transparent;position:relative;transition:.2s}
.tb ha-icon{color:var(--acc)}
.tb.on{background:rgba(79,209,232,.1);border-color:rgba(79,209,232,.55);box-shadow:0 0 18px rgba(79,209,232,.18) inset}
.tb.ico{padding:11px 13px} .tb.unl ha-icon{color:var(--warn)}
.badge{position:absolute;top:3px;right:3px;min-width:19px;height:19px;border-radius:10px;font-size:11px;display:flex;align-items:center;justify-content:center;padding:0 5px;color:#111;background:var(--warn)}
.badge.bad{background:var(--bad);color:#fff} .badge.info{background:var(--acc)}
/* layout */
.g{display:grid;gap:14px;grid-template-columns:repeat(3,minmax(0,1fr))}
.span2{grid-column:span 2} .span3{grid-column:1/-1}
.card{position:relative;background:linear-gradient(180deg,rgba(27,44,73,.78),rgba(15,27,47,.78));border:1px solid var(--line);border-radius:22px;padding:18px 20px;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 10px 30px rgba(0,0,0,.22);overflow:hidden}
.card[data-a]{cursor:pointer}
.cn{font-size:17px;font-weight:600;color:#d9e8fb;display:flex;align-items:center;gap:7px;white-space:nowrap;min-width:0}
.cn .cnt{font-size:13px;background:rgba(255,255,255,.08);padding:2px 9px;border-radius:9px;color:var(--sub)}
.ctl{font-size:16px;font-weight:600;margin-bottom:10px}
.ch{display:flex;align-items:center;gap:10px;margin-bottom:6px}
.big{font-size:60px;font-weight:700;line-height:1;letter-spacing:-1px}
.big small{font-size:26px;font-weight:500;margin-left:6px;color:#bcd2ec}
.nodata{color:var(--sub);font-size:13px;padding:20px 0;text-align:center}
.mt{margin-top:16px}
/* casa */
.casa{grid-template-columns:minmax(0,1.35fr) minmax(0,1fr) minmax(0,1fr)}
.clock{display:flex;gap:20px;align-items:stretch}
.dn{font-size:20px;font-weight:600} .dd{color:var(--sub);font-size:16px}
.tm{font-size:84px;font-weight:700;line-height:1;letter-spacing:-2px;margin-top:10px}
.greet{flex:1;border-left:1px solid var(--line);padding-left:18px;display:flex;flex-direction:column;gap:10px}
.gh{font-size:17px;color:#cfe0f5}
.ppl{display:flex;flex-direction:column;gap:8px}
.person{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:14px;background:rgba(255,255,255,.04);cursor:pointer}
.person img,.person .pi{width:34px;height:34px;border-radius:50%;object-fit:cover;background:#22385a;display:flex;align-items:center;justify-content:center;font-weight:700;border:2px solid #3b4f6d}
.person.home img,.person.home .pi{border-color:var(--ok)}
.person b{display:block;font-size:15px} .person small{color:var(--sub);font-size:12px}
.wx{display:flex;gap:16px;align-items:center}
.wxnow{display:flex;align-items:center;gap:12px;padding-right:16px;border-right:1px solid var(--line)}
ha-icon.wbig{--mdc-icon-size:56px;color:#ffd166}
.wt{font-size:54px;font-weight:700;line-height:1} .wl{font-size:15px;color:#cfe0f5}
.wxh{flex:1;min-width:0;overflow:hidden} .hrs{display:flex;justify-content:space-between;gap:6px}
.hr{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:14px} .hr small{color:var(--sub)}
ha-icon.wsm{--mdc-icon-size:22px;color:#ffd166} ha-icon.wmd{--mdc-icon-size:30px;color:#cfe0f5}
.drow{display:flex;justify-content:space-between}
.day{display:flex;flex-direction:column;align-items:center;gap:5px;font-size:15px} .day small{color:var(--sub)} .day .rain{color:var(--blue);font-size:12px}
.strip{display:flex;align-items:center;gap:12px;padding:14px 18px;border-radius:18px;border:1px solid var(--line);background:rgba(20,34,58,.8);cursor:pointer;font-size:16px;min-height:100%}
.strip.warn{background:linear-gradient(90deg,rgba(246,185,59,.18),rgba(246,185,59,.05));border-color:rgba(246,185,59,.4);border-left:4px solid var(--warn)}
.strip.bad{background:linear-gradient(90deg,rgba(255,93,108,.25),rgba(255,93,108,.06));border-color:rgba(255,93,108,.5);border-left:4px solid var(--bad);animation:pulse 2s infinite}
.strip.info{border-left:4px solid var(--acc)} .strip.ok{border-left:4px solid var(--ok);cursor:default} .strip.ok>ha-icon{color:var(--ok)}
.strip .more{color:var(--sub);font-size:14px}
@keyframes pulse{50%{box-shadow:0 0 0 6px rgba(255,93,108,.15)}}
.apps{grid-row:span 2;display:flex;flex-direction:column;gap:14px}
.app{display:flex;align-items:center;gap:16px;flex:1;min-height:96px}
.drum{width:62px;height:62px;border-radius:16px;background:linear-gradient(180deg,#3a4a63,#26344b);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.drum ha-icon{--mdc-icon-size:36px;color:#9fb3cf}
.app.run{border-color:rgba(79,209,232,.6);box-shadow:0 0 24px rgba(79,209,232,.15),inset 0 1px 0 rgba(255,255,255,.05)}
.app.run .drum{background:linear-gradient(180deg,#e8f3ff,#b9d3ef)} .app.run .drum ha-icon{color:#1d5fa8;animation:spin 2.4s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.an{font-size:19px;font-weight:600} .as{font-size:21px;font-weight:700;color:#9fb3cf;white-space:nowrap} .app.run .as{color:var(--acc)} .aw{font-size:21px;white-space:nowrap}
.app>div:nth-child(2){min-width:0}
.power{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:22px}
.pleft{display:flex;flex-direction:column;gap:10px}
.pleft>div:nth-child(2){display:flex;flex-direction:column;gap:6px}
.ring{width:64px;height:64px;border-radius:50%;border:3px solid var(--acc);display:flex;align-items:center;justify-content:center;box-shadow:0 0 20px rgba(79,209,232,.25)}
.ring ha-icon{--mdc-icon-size:30px;color:var(--acc)}
.pleft{flex-direction:column}
.kv{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:15px}
.kv[data-a]{cursor:pointer} .kv.sm{font-size:13px;padding:4px 0 4px 12px} .kv span{color:#c5d6ec}
.pright{display:flex;flex-direction:column;justify-content:center;gap:10px;border-left:1px solid var(--line);padding-left:20px}
.pbar{display:grid;grid-template-columns:120px minmax(0,1fr) 70px;align-items:center;gap:12px;font-size:15px;cursor:pointer;padding:4px 0}
.pbar span{color:#c5d6ec;white-space:nowrap;overflow:hidden;text-overflow:ellipsis} .pbar b{text-align:right}
.track{height:9px;border-radius:6px;background:rgba(255,255,255,.07);overflow:hidden}
.track.thin{height:4px}
.track i{display:block;height:100%;border-radius:6px;background:linear-gradient(90deg,#33b5d6,#5ee3f5);transition:width .6s}
.rooms{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px}
.room{min-height:150px;cursor:pointer;background:linear-gradient(160deg,rgba(40,64,102,.75),rgba(15,27,47,.85))}
ha-icon.rwm{position:absolute;right:-10px;bottom:-14px;--mdc-icon-size:110px;opacity:.07}
.rn{font-size:17px;font-weight:600} .rt{font-size:46px;font-weight:700;margin:6px 0 4px;letter-spacing:-1px}
.rm{display:flex;gap:14px;font-size:14px;color:#c5d6ec} .rm span{display:flex;align-items:center;gap:3px}
.rbar{height:4px;border-radius:3px;background:rgba(255,255,255,.08);margin-top:12px;overflow:hidden}
.rbar i{display:block;height:100%;background:var(--acc)} .rbar i.ok{background:var(--ok)} .rbar i.warn{background:var(--warn)} .rbar i.blue{background:var(--blue)}
.quick{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.qb{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:96px;border-radius:20px;border:1px solid var(--line);
  background:linear-gradient(180deg,rgba(27,44,73,.85),rgba(15,27,47,.85));transition:.15s}
.qb ha-icon{--mdc-icon-size:30px;color:#cfe0f5} .qb b{font-size:17px} .qb small{font-size:12px;color:var(--sub)}
.qb.on{border-color:rgba(61,220,151,.6);background:linear-gradient(180deg,rgba(30,90,72,.6),rgba(15,40,40,.75));box-shadow:0 0 22px rgba(61,220,151,.15)}
.qb.on ha-icon{color:var(--ok)} .qb:active,.ctl-t:active{transform:scale(.97)} .dis{opacity:.45}
/* clima */
.clima-g{grid-template-columns:repeat(auto-fit,minmax(330px,1fr))}
.seg{display:flex;gap:2px;padding:3px;border-radius:12px;background:rgba(255,255,255,.05)}
.seg button{padding:6px 11px;border-radius:9px;font-size:13px;color:var(--sub)}
.seg button.on{background:rgba(79,209,232,.14);color:var(--txt);box-shadow:inset 0 0 0 1px rgba(79,209,232,.5)}
.seg.wide{margin-top:12px;flex-wrap:wrap}
.cbig{display:flex;align-items:center;gap:20px;margin:6px 0 10px}
.ct{font-size:58px;font-weight:700;line-height:1;letter-spacing:-1px} .ct small{font-size:18px;font-weight:500;color:var(--sub)}
.cside{display:flex;flex-direction:column;gap:6px;font-size:15px}
.dots3{display:inline-flex;gap:3px;margin-left:4px} .dots3 i{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.12)} .dots3 i.ok{background:var(--ok)} .dots3 i.warn{background:var(--warn)}
.chart{height:90px;margin:0 -4px} .chart.sm{height:60px}
.spark{width:100%;height:100%;display:block}
.cfoot{display:flex;font-size:12px;color:var(--sub);margin-top:6px}
.pill{font-size:12px;padding:4px 10px;border-radius:10px;background:rgba(255,255,255,.07)}
.pill.ok{background:rgba(61,220,151,.15)} .pill.warn{background:rgba(246,185,59,.15)} .pill.bad{background:rgba(255,93,108,.18)}
.sic .kv b{font-size:14px}
/* energia */
.energia-g{grid-template-columns:minmax(0,1fr) minmax(0,1.2fr)}
.plist{margin-top:16px;display:flex;flex-direction:column;gap:8px}
.ctab{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr) minmax(0,1fr);row-gap:16px;align-items:end;margin-bottom:12px}
.ctab b{color:var(--sub);font-weight:500;text-align:right} .ctab>span{color:#c5d6ec;font-size:16px}
.ctab div{text-align:right} .ctab .cost-v{color:#ff9f43} .ctab big{font-size:30px;font-weight:700;display:block} .ctab small{color:var(--sub);font-size:12px}
.bchart{display:flex;align-items:flex-end;gap:4px;margin-top:14px;padding:0 2px;border-bottom:1px solid var(--line)}
.bcol{flex:1;height:100%;display:flex;align-items:flex-end} .bbar{width:100%;border-radius:4px 4px 0 0;transition:height .5s}
.bbar.last{box-shadow:0 0 12px rgba(79,209,232,.5)}
.blabels{display:flex;gap:4px;font-size:11px;color:var(--sub);margin-top:6px} .blabels span{flex:1;white-space:nowrap;overflow:visible}
/* telecamere */
.cam-g{grid-template-columns:repeat(2,minmax(0,1fr))}
.cam{padding:0;aspect-ratio:16/9;cursor:pointer;background:#050a14}
.cam img{width:100%;height:100%;object-fit:cover;display:block}
.nocam{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--sub)}
.camlab{position:absolute;left:0;right:0;bottom:0;display:flex;align-items:center;gap:8px;padding:28px 16px 12px;background:linear-gradient(0deg,rgba(0,0,0,.75),transparent);font-size:17px}
.live{width:9px;height:9px;border-radius:50%;background:var(--bad);box-shadow:0 0 8px var(--bad)} .live.off{background:#5b6f8c;box-shadow:none}
/* purificatori */
.aria-g{grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}
.pur.on{border-color:rgba(61,220,151,.35)}
ha-icon.lbig{}
.fanbig{display:flex;justify-content:center;padding:18px 0 8px} .fanbig ha-icon{--mdc-icon-size:96px;color:#5b6f8c} .fanbig.on ha-icon{color:var(--ok);animation:spin 1.6s linear infinite}
.pwr{width:46px;height:46px;border-radius:50%;border:1px solid var(--line);background:rgba(255,255,255,.04);display:flex;align-items:center;justify-content:center}
.pwr.on{background:rgba(61,220,151,.18);border-color:var(--ok)} .pwr.on ha-icon{color:var(--ok)}
.prow{display:flex;align-items:center;gap:12px;margin-top:10px;font-size:16px}
.kbtn{width:40px;height:40px;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid var(--line);font-size:22px}
.pur .pbar{grid-template-columns:60px minmax(0,1fr) 60px;margin-top:12px}
.energia-g .pbar{grid-template-columns:110px minmax(0,1fr) 92px}
/* comandi */
.com-g{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
.ctl-list{display:flex;flex-direction:column;gap:8px;margin-top:12px}
.ctl-t{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid var(--line);text-align:left;transition:.15s}
.ctl-t b{display:block;font-size:15px} .ctl-t small{color:var(--sub);font-size:12px}
.ctl-t ha-icon{color:#9fb3cf} .ctl-t.on{border-color:rgba(61,220,151,.5);background:rgba(61,220,151,.08)} .ctl-t.on ha-icon{color:var(--ok)}
.lockview{max-width:460px;margin:40px auto;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;padding:40px}
ha-icon.lbig{--mdc-icon-size:64px;color:var(--acc)}
.btn{display:inline-flex;align-items:center;gap:8px;padding:13px 22px;border-radius:14px;font-size:16px;font-weight:600}
.btn.pri{background:linear-gradient(180deg,#4fd1e8,#2aa6c4);color:#06202a}
.btn.ghost{border:1px solid var(--line);background:rgba(255,255,255,.04)}
.btn.sm{padding:8px 14px;font-size:14px}
/* avvisi */
.avv-g{grid-template-columns:minmax(0,1fr) minmax(0,1.3fr) minmax(0,1.2fr)}
.alert{display:flex;gap:12px;align-items:center;padding:14px;border-radius:16px;margin-top:12px;background:rgba(255,255,255,.04);border:1px solid var(--line);border-left:4px solid var(--acc)}
.alert b{display:block;font-size:16px} .alert small{color:var(--sub);font-size:13px}
.alert.warn{border-left-color:var(--warn);background:rgba(246,185,59,.09)} .alert.warn ha-icon{color:var(--warn)}
.alert.bad{border-left-color:var(--bad);background:rgba(255,93,108,.12)} .alert.bad ha-icon{color:var(--bad)}
.alert.ok{border-left-color:var(--ok)} .alert.ok ha-icon{color:var(--ok)}
.blist{display:flex;flex-direction:column;gap:9px;margin-top:12px;max-height:70vh;overflow:auto}
.bat{cursor:pointer} .bt{display:flex;justify-content:space-between;font-size:15px;margin-bottom:4px}
.bignum{display:flex;gap:14px;align-items:center;margin:20px 0 10px} .bignum b{font-size:48px} .bignum span{font-size:14px}
/* robot */
.robot-g{grid-template-columns:minmax(0,1fr) minmax(0,1.15fr) minmax(0,1fr)}
.rstat{grid-column:1;grid-row:1} .rmap{grid-column:2;grid-row:1/3;display:flex;flex-direction:column} .rparts{grid-column:1/-1}
.rstat.run{border-color:rgba(79,209,232,.6);box-shadow:0 0 24px rgba(79,209,232,.15)} .rstat.err,.app.err{border-color:rgba(255,93,108,.6)}
.rhead{display:flex;gap:14px;align-items:center}
.rbot{width:58px;height:58px;border-radius:50%;background:linear-gradient(180deg,#e8f3ff,#b9d3ef);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.rbot ha-icon{--mdc-icon-size:34px;color:#1d5fa8} .rstat.run .rbot ha-icon{animation:spin 3s linear infinite}
.rst{font-size:22px;font-weight:700;color:var(--acc);margin:2px 0}
.rbat{width:84px;text-align:right} .rbv{font-size:34px;font-weight:700;line-height:1} .rbv small{font-size:16px} .rbat .track{margin-top:6px}
.rbtns{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:16px 0 6px}
.rb{display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 4px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid var(--line);font-size:12px}
.rb ha-icon{--mdc-icon-size:24px} .rb.pri{background:linear-gradient(180deg,#4fd1e8,#2aa6c4);color:#06202a;border-color:transparent;font-weight:600}
.rrow{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;font-size:14px}
.rrow.col{flex-direction:column;align-items:stretch;gap:6px} .rrow.col .seg button{flex:1}
.wctl{display:flex;align-items:center;gap:10px} .wctl .kbtn{width:36px;height:36px;font-size:20px}
.mapbox{flex:1;min-height:220px;margin-top:10px;border-radius:14px;background:#0a1322;display:flex;align-items:center;justify-content:center;overflow:hidden}
.mapbox img{max-width:100%;max-height:100%;object-fit:contain}
.pbtn{cursor:pointer;color:var(--txt)}
.rgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;margin:12px 0}
.rchip{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid var(--line);font-size:14px;text-align:left}
.rchip span{line-height:1.15} .rchip ha-icon{--mdc-icon-size:20px;color:var(--sub);flex-shrink:0}
.rchip.on{border-color:var(--acc);background:rgba(79,209,232,.12)} .rchip.on ha-icon{color:var(--acc)}
.btn.wide{width:100%;justify-content:center} .btn[disabled]{opacity:.4}
.sgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0 6px}
.sbtn{display:flex;align-items:center;gap:8px;padding:11px 12px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid var(--line);font-size:14px;text-align:left}
.sbtn ha-icon{--mdc-icon-size:20px;color:var(--acc)} .sbtn:active,.rb:active,.rchip:active{transform:scale(.97)}
.tgl{width:50px;height:30px;border-radius:15px;background:rgba(255,255,255,.12);position:relative;flex-shrink:0}
.tgl i{position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;background:#cfe0f5;transition:.2s} .tgl.on{background:var(--ok)} .tgl.on i{left:23px;background:#fff}
.sts{display:flex;gap:18px;margin:4px 0 12px;flex-wrap:wrap}
.st1 b{font-size:28px;display:block;line-height:1.1} .st1 b small{font-size:14px;color:var(--sub);margin-left:3px;font-weight:500} .st1 span{font-size:12px;color:var(--sub)}
.plist3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 26px;margin-top:12px}
@media (max-width:1000px){.robot-g{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.rstat{grid-column:1;grid-row:auto}.rmap{grid-column:2;grid-row:auto}.plist3{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:700px){.robot-g{grid-template-columns:minmax(0,1fr)}.rstat,.rmap{grid-column:auto}.plist3{grid-template-columns:minmax(0,1fr)}}
/* musica */
.mus-g{grid-template-columns:minmax(0,1.15fr) minmax(0,1fr)}
.mcol{display:flex;flex-direction:column;gap:14px;min-width:0}
.np{display:flex;gap:22px;align-items:stretch}
.np.empty{flex-direction:column;align-items:center;text-align:center;padding:40px 30px;gap:10px}
ha-icon.spbig{--mdc-icon-size:72px;color:#1db954}
.art{width:230px;height:230px;flex-shrink:0;border-radius:18px;overflow:hidden;background:#0c1626;display:flex;align-items:center;justify-content:center;box-shadow:0 14px 40px rgba(0,0,0,.45)}
.art img{width:100%;height:100%;object-fit:cover}
.npi{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:6px}
.npk{color:var(--sub);font-size:13px} .npk ha-icon{color:#1db954}
.npt{font-size:26px;font-weight:700;line-height:1.15;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.npa{color:#bcd2ec;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.prog{margin-top:8px} .pt{display:flex;justify-content:space-between;font-size:12px;color:var(--sub);margin-top:5px}
.ctrl{display:flex;align-items:center;justify-content:space-between;margin-top:8px;max-width:340px}
.cb{width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.05);border:1px solid var(--line)}
.cb ha-icon{--mdc-icon-size:28px} .cb.sm{width:40px;height:40px} .cb.sm ha-icon{--mdc-icon-size:20px;color:var(--sub)} .cb.sm.on ha-icon{color:#1db954}
.cb.play{width:66px;height:66px;background:#1db954;border-color:#1db954} .cb.play ha-icon{--mdc-icon-size:34px;color:#04130a}
.volr{display:grid;grid-template-columns:40px minmax(0,1fr) 40px 46px;align-items:center;gap:10px;margin-top:10px;max-width:400px} .volr b{font-size:14px;text-align:right}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 8px}
.chip{display:inline-flex;align-items:center;gap:6px;padding:10px 14px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid var(--line);font-size:14px}
.chip.on{border-color:#1db954;background:rgba(29,185,84,.14)} .chip.on ha-icon{color:#1db954}
.mt0{margin-top:4px} .ctrl.idle{justify-content:flex-start;gap:14px;flex-wrap:wrap;max-width:none}
.plg{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin-top:12px}
.pl{display:flex;flex-direction:column;gap:8px;padding:10px;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid var(--line);text-align:left}
.pl img,.plic{width:100%;aspect-ratio:1;border-radius:12px;object-fit:cover;display:flex;align-items:center;justify-content:center}
.plic ha-icon{--mdc-icon-size:40px;color:#fff;opacity:.9}
.pl b{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pl:active{transform:scale(.97)}
.radio{display:flex;align-items:center;gap:12px;padding:12px;border-radius:16px;margin-top:12px;background:rgba(255,255,255,.04);border:1px solid var(--line)}
.radio.on{border-color:rgba(79,209,232,.6);box-shadow:0 0 20px rgba(79,209,232,.15)}
.rlogo{width:54px;height:54px;border-radius:12px;overflow:hidden;background:linear-gradient(135deg,#ff5d8f,#7b2ff7);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.rlogo img{width:100%;height:100%;object-fit:cover} .rlogo ha-icon{--mdc-icon-size:30px;color:#fff}
.rinfo b{display:block;font-size:17px} .rinfo small{color:var(--sub)}
.dock{display:none}
.dock.on{display:block;position:fixed;right:18px;bottom:18px;width:min(420px,calc(100vw - 36px));z-index:5;border-radius:20px;overflow:hidden;
  background:linear-gradient(180deg,#1b2c49,#0f1b2f);border:1px solid rgba(79,209,232,.45);box-shadow:0 20px 60px rgba(0,0,0,.55)}
.dk-h{display:flex;align-items:center;gap:8px;padding:10px 12px 8px 16px;font-size:14px} .dk-h ha-icon{color:var(--acc)}
.dk-x{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center}
.dock iframe{display:block;width:100%;height:150px;border:0;background:#fff;transition:height .25s}
.dk-h b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis} .dk-s{white-space:nowrap}
.dock.on.min{width:auto;max-width:320px} .dock.min iframe{height:0} .dock.min .dk-x:first-of-type ha-icon{transform:rotate(180deg)}
.dock.on .dk-x{margin-left:4px}
/* modal */
.modal{position:fixed;inset:0;background:rgba(3,8,16,.72);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;z-index:10}
.dlg{width:min(360px,92vw);padding:26px;border-radius:26px;background:linear-gradient(180deg,#1b2c49,#0f1b2f);border:1px solid var(--line);display:flex;flex-direction:column;align-items:center;gap:8px;box-shadow:0 30px 80px rgba(0,0,0,.5)}
ha-icon.dlg-ic{--mdc-icon-size:40px;color:var(--acc)}
.dt{font-size:22px;font-weight:700} .ds{color:var(--sub);font-size:14px;text-align:center}
.dots{display:flex;gap:12px;margin:12px 0 2px} .dots i{width:14px;height:14px;border-radius:50%;border:2px solid #5a7091} .dots i.f{background:var(--acc);border-color:var(--acc)}
.err{min-height:18px;color:var(--bad);font-size:13px;text-align:center;max-width:300px}
.kp{display:grid;grid-template-columns:repeat(3,74px);gap:12px;margin:4px 0 12px}
.key{height:74px;border-radius:50%;background:rgba(255,255,255,.06);border:1px solid var(--line);font-size:28px;font-weight:600;display:flex;align-items:center;justify-content:center}
.key:active{background:rgba(79,209,232,.25)} .key.kok{background:rgba(79,209,232,.2);border-color:rgba(79,209,232,.6)}
.row2{display:flex;gap:12px;margin-top:14px}
/* responsive */
@media (max-width:1250px){.tb span{display:none}.tb{padding:11px 14px}.avv-g{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}
@media (max-width:1000px){.casa{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.casa .span3,.casa .span2{grid-column:1/-1}.apps{grid-row:auto;grid-column:1/-1;flex-direction:row}.apps>.app{flex:1;min-width:0}.casa .clock{grid-column:1/-1}.rooms{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.cam-g{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}
@media (max-width:700px){.wrap{padding:8px;gap:10px}.apps{flex-direction:column}.g,.casa,.energia-g,.avv-g,.cam-g{grid-template-columns:minmax(0,1fr)}.span2,.span3{grid-column:auto}
  .power{grid-template-columns:minmax(0,1fr)}.pright{border-left:0;padding-left:0}.clock{flex-direction:column}.greet{border-left:0;padding-left:0;border-top:1px solid var(--line);padding-top:12px}
  .tm{font-size:64px}.big{font-size:48px}.wx{flex-direction:column;align-items:stretch}.wxnow{border-right:0;padding-right:0}.pbar{grid-template-columns:100px minmax(0,1fr) 64px}
  .nav{justify-content:space-between}.tb{padding:10px}}
/* ===== iPad Air 10,5" (1112x834) e iPad 10,2"/10,9" in orizzontale ===== */
@media (min-width:1001px) and (max-width:1199px){
  .wrap{padding:10px;gap:10px} .g{gap:12px}
  .tb span{display:inline} .tb{padding:9px 11px;font-size:15px;gap:6px} .tb ha-icon{--mdc-icon-size:20px} .tb.ico{padding:9px 10px}
  .card{padding:14px 16px;border-radius:20px}
  .casa{grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) minmax(0,.95fr)}
  .clock{gap:14px} .tm{font-size:66px;margin-top:6px} .dn{font-size:18px} .dd{font-size:14px} .greet{padding-left:14px;gap:8px} .gh{font-size:15px}
  .person{padding:6px 8px} .person img,.person .pi{width:30px;height:30px}
  .wx{gap:12px} .wxnow{gap:8px;padding-right:12px} .wt{font-size:42px} ha-icon.wbig{--mdc-icon-size:44px} .hr{font-size:13px} ha-icon.wsm{--mdc-icon-size:20px}
  .hrs .hr:nth-child(n+5){display:none}
  .day{font-size:14px} ha-icon.wmd{--mdc-icon-size:26px}
  .strip{padding:11px 14px;font-size:15px}
  .apps{gap:12px} .app{min-height:0;gap:12px} .drum{width:50px;height:50px} .drum ha-icon{--mdc-icon-size:30px} .an{font-size:16px} .as{font-size:18px} .aw{font-size:17px}
  .power{gap:16px} .ring{width:48px;height:48px} .ring ha-icon{--mdc-icon-size:24px} .big{font-size:48px} .big small{font-size:22px} .kv{font-size:14px;padding:6px 0}
  .pbar{grid-template-columns:96px minmax(0,1fr) 62px;font-size:14px;gap:10px} .pright{padding-left:16px;gap:8px}
  .rooms{gap:12px} .room{min-height:118px;padding:12px 14px} .rn{font-size:15px} .rt{font-size:36px;margin:4px 0 2px} .rm{font-size:13px;gap:10px} ha-icon.rwm{--mdc-icon-size:86px}
  .quick{gap:12px} .qb{min-height:72px;border-radius:18px} .qb ha-icon{--mdc-icon-size:24px} .qb b{font-size:15px}
  .clima-g{grid-template-columns:repeat(3,minmax(0,1fr))} .ct{font-size:46px} .cbig{gap:14px;margin:4px 0 6px} .cside{font-size:13px} .chart{height:72px} .seg button{padding:5px 8px;font-size:12px}
  .energia-g .pbar{grid-template-columns:96px minmax(0,1fr) 84px} .ctab big{font-size:26px}
  .aria-g{grid-template-columns:repeat(2,minmax(0,1fr))}
  .com-g{grid-template-columns:repeat(3,minmax(0,1fr))}
  .art{width:180px;height:180px} .npt{font-size:22px} .cb{width:46px;height:46px} .cb.play{width:58px;height:58px}
  .plg{grid-template-columns:repeat(4,minmax(0,1fr))}
  .plist3{grid-template-columns:repeat(4,minmax(0,1fr));gap:8px 20px} .rbtns{margin:12px 0 4px} .rb{padding:8px 4px} .mapbox{min-height:180px} .st1 b{font-size:24px} .sts{margin:2px 0 8px}
}
/* iPad in verticale (834x1112) */
@media (min-width:701px) and (max-width:1000px){
  .mus-g{grid-template-columns:minmax(0,1fr)} .clima-g,.aria-g{grid-template-columns:minmax(0,1fr) minmax(0,1fr)} .com-g{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
  .tm{font-size:72px}
}
@media (max-width:700px){.mus-g{grid-template-columns:minmax(0,1fr)}.np{flex-direction:column;align-items:center}.art{width:100%;height:auto;aspect-ratio:1}}

`;

if (!customElements.get('casa-panel')) customElements.define('casa-panel', CasaPanel);
window.customCards = window.customCards || [];
window.customCards.push({ type: 'casa-panel', name: 'Casa Panel', description: 'Dashboard su misura stile blu notte' });
console.info(`%c CASA-PANEL %c v${CP_VERSION} `, 'background:#4fd1e8;color:#06202a;font-weight:700', 'background:#0b1629;color:#4fd1e8');
