// Persistenz in localStorage. Jeder Lesezugriff ist fehlertolerant: kaputte oder
// fehlende Daten liefern Standardwerte; ohne localStorage (privater Modus) wird
// im Speicher weitergearbeitet.
import { DEFAULTS, normalizeConfig } from './plan.js';

const PREFIX = 'moortimer.';
const memory = new Map();

const store = (() => {
  try {
    const s = window.localStorage;
    s.setItem(PREFIX + '_probe', '1');
    s.removeItem(PREFIX + '_probe');
    return s;
  } catch {
    return null;
  }
})();

function readRaw(key) {
  try {
    return store ? store.getItem(PREFIX + key) : memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

function read(key, fallback, validate = (v) => v) {
  const raw = readRaw(key);
  if (raw == null) return fallback;
  try {
    const v = validate(JSON.parse(raw));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  const raw = JSON.stringify(value);
  memory.set(key, raw);
  try { store?.setItem(PREFIX + key, raw); } catch { /* voll oder gesperrt: Speicher-Kopie reicht */ }
}

function remove(key) {
  memory.delete(key);
  try { store?.removeItem(PREFIX + key); } catch { /* egal */ }
}

export function clearAll() {
  memory.clear();
  if (!store) return;
  try {
    const keys = [];
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => store.removeItem(k));
  } catch { /* egal */ }
}

export const DEFAULT_SETTINGS = Object.freeze({ sound: true, volume: 80, keepAwake: true });

export function loadSettings() {
  return read('settings', { ...DEFAULT_SETTINGS }, (v) => ({
    sound: typeof v?.sound === 'boolean' ? v.sound : DEFAULT_SETTINGS.sound,
    volume: Number.isFinite(v?.volume) ? Math.min(100, Math.max(0, Math.round(v.volume))) : DEFAULT_SETTINGS.volume,
    keepAwake: typeof v?.keepAwake === 'boolean' ? v.keepAwake : DEFAULT_SETTINGS.keepAwake,
  }));
}
export const saveSettings = (s) => write('settings', s);

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function validPreset(p) {
  if (!p || typeof p !== 'object' || typeof p.name !== 'string') return null;
  const mode = p.mode === 'tabata' ? 'tabata' : 'runden';
  return {
    id: typeof p.id === 'string' && p.id ? p.id : uid(),
    name: p.name.slice(0, 40) || 'VORLAGE',
    mode,
    config: normalizeConfig(p.config, DEFAULTS[mode]),
    created: Number.isFinite(p.created) ? p.created : Date.now(),
    lastUsed: Number.isFinite(p.lastUsed) ? p.lastUsed : 0,
  };
}

export function loadPresets() {
  return read('presets', [], (v) => (Array.isArray(v) ? v.map(validPreset).filter(Boolean) : null));
}
export const savePresets = (list) => write('presets', list);

export function loadEditors() {
  const fresh = () => ({
    runden: { config: { ...DEFAULTS.runden }, presetId: null },
    tabata: { config: { ...DEFAULTS.tabata }, presetId: null },
  });
  return read('editors', fresh(), (v) => {
    const out = fresh();
    for (const mode of ['runden', 'tabata']) {
      if (v?.[mode]?.config) out[mode].config = normalizeConfig(v[mode].config, DEFAULTS[mode]);
      if (typeof v?.[mode]?.presetId === 'string') out[mode].presetId = v[mode].presetId;
    }
    return out;
  });
}
export const saveEditors = (e) => write('editors', e);

export const loadTab = () => read('tab', 'runden', (v) => (['tabata', 'runden', 'stoppuhr', 'mehr'].includes(v) ? v : null));
export const saveTab = (t) => write('tab', t);

export const loadSession = () => read('session', null, (v) => (v && v.config && Number.isFinite(v.anchor) ? v : null));
export const saveSession = (s) => write('session', s);
export const clearSession = () => remove('session');

export const loadStopwatch = () => read('stopwatch', null, (v) => (v && typeof v === 'object' ? v : null));
export const saveStopwatch = (s) => write('stopwatch', s);
