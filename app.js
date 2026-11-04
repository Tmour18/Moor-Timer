import { DEFAULTS, PHASES, buildPlan, sameConfig, normalizeConfig, LIMITS } from './js/plan.js';
import { fmtValue, fmtClock, fmtStopwatch, configSummary } from './js/format.js';
import { IntervalRun } from './js/engine.js';
import { Stopwatch } from './js/stopwatch.js';
import { SignalPlayer } from './js/player.js';
import { createWheel } from './js/wheel.js';
import { ICONS } from './js/icons.js';
import { h, icon, dialog, sheet, toast, flash } from './js/ui.js';
import * as store from './js/storage.js';

const APP_VERSION = '1.0';
const $ = (sel) => document.querySelector(sel);

const FIELDS = [
  { key: 'prep', title: 'VORBEREITUNG', desc: 'COUNTDOWN VOR DEM START', color: 'var(--yellow)', kind: 'time' },
  { key: 'work', title: 'AKTIVITÄT', desc: 'ÜBUNGEN SOLANGE AUSFÜHREN', color: 'var(--lime)', kind: 'time' },
  { key: 'rest', title: 'PAUSE', desc: 'PAUSE FÜR SOLANGE', color: 'var(--red)', kind: 'time' },
  { key: 'rounds', title: 'RUNDEN', desc: 'EINE RUNDE IST ÜBUNG + PAUSE', color: 'var(--blue)', kind: 'count' },
  { key: 'cool', title: 'ABKLINGZEIT', desc: 'ABKLINGZEIT NACH DEM TRAINING', color: 'var(--blue)', kind: 'time' },
];
const TEXT_ON = { prep: '#111', work: '#111', rest: '#fff', cool: '#fff' };

const state = {
  tab: store.loadTab(),
  settings: store.loadSettings(),
  presets: store.loadPresets(),
  editors: store.loadEditors(),
  sw: new Stopwatch({ state: store.loadStopwatch() }),
  run: null,
  runName: null,
  finished: false,
  lastIndex: -1,
  lastSync: 0,
  fitIndex: -1,
  audioStarted: false,
  raf: 0,
  swRaf: 0,
  pendingReload: false,
};

const player = new SignalPlayer();
player.onBlocked = () => {
  state.audioStarted = false;
  if (state.run && !state.finished) $('#run-audio').hidden = false;
};

const volumeAmp = () => Math.pow(state.settings.volume / 100, 1.5);
const findPreset = (id) => state.presets.find((p) => p.id === id) || null;
const persistPresets = () => store.savePresets(state.presets);
const persistEditors = () => store.saveEditors(state.editors);

/* ================= Tabs ================= */

function showTab(tab) {
  state.tab = tab;
  store.saveTab(tab);
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.dataset.tab === tab));
  document.querySelectorAll('.tab').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tab);
    b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false');
  });
  if (tab === 'mehr') renderMore();
  if (tab === 'tabata' || tab === 'runden') renderEditor(tab);
  if (tab === 'stoppuhr') { renderStopwatch(); swLoop(); }
}

/* ================= Editor (RUNDEN / TABATA) ================= */

function topbar(left, title, right) {
  return h('header', { class: 'topbar' },
    left || h('span'), h('div', { class: 'title', text: title }), right || h('span'));
}

function renderEditor(mode) {
  const view = $(`#view-${mode}`);
  const ed = state.editors[mode];
  if (ed.presetId && !findPreset(ed.presetId)) ed.presetId = null;
  const preset = ed.presetId ? findPreset(ed.presetId) : null;
  const plan = buildPlan(ed.config);
  const scroll = view.scrollTop;

  view.replaceChildren(
    topbar(
      h('button', { class: 'hbtn left', type: 'button', text: 'ABBRUCH', onclick: () => cancelEditor(mode) }),
      preset ? preset.name : mode === 'tabata' ? 'TABATA' : 'RUNDEN',
      h('button', { class: 'hbtn right accent', type: 'button', text: 'SPEICHERN', onclick: () => saveEditor(mode) })),
    h('div', { class: 'section-label', text: 'INTERVALLE' }),
    h('div', { class: 'rows' }, FIELDS.map((f) => {
      const v = ed.config[f.key];
      return h('button', { class: 'row', type: 'button', onclick: () => openValueSheet(mode, f) },
        h('span', { class: 'dot' }),
        h('span', { class: 'row-text' },
          h('div', { class: 'row-title', text: f.title }),
          h('div', { class: 'row-desc', text: f.desc })),
        h('span', { class: 'row-value' + (v === 0 ? ' zero' : ''), text: f.kind === 'time' ? fmtValue(v) : String(v) }),
        icon('chevron', 'ico chev'));
    })),
    h('button', { class: 'add-btn', type: 'button', onclick: () => addTimer(mode) }, icon('stoppuhr'), 'NEUEN TIMER HINZUFÜGEN'),
    h('div', { class: 'total-line' }, 'GESAMTDAUER ', h('b', { text: fmtClock(plan.total) })),
    h('button', { class: 'start-btn', type: 'button', text: 'START', onclick: () => startRun(ed.config, ed.presetId) }),
  );
  view.querySelectorAll('.dot').forEach((d, i) => d.style.setProperty('--c', FIELDS[i].color));
  view.scrollTop = scroll;
}

function openValueSheet(mode, field) {
  const ed = state.editors[mode];
  const current = ed.config[field.key];
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  let wheels;
  let read;
  let body;
  if (field.kind === 'time') {
    const m = createWheel({ values: range(0, Math.floor(LIMITS.maxSeconds / 60)), value: Math.floor(current / 60), label: 'MIN' });
    const s = createWheel({ values: range(0, 59), value: current % 60, label: 'SEK' });
    wheels = [m, s];
    read = () => m.value * 60 + s.value;
    body = h('div', { class: 'wheels' }, m.root, h('div', { class: 'wheel-sep', text: ':' }), s.root);
  } else {
    const r = createWheel({ values: range(0, LIMITS.maxRounds), value: current, label: 'RUNDEN', format: String });
    wheels = [r];
    read = () => r.value;
    body = h('div', { class: 'wheels' }, r.root);
  }
  sheet({
    title: field.title,
    body,
    onShown: () => wheels.forEach((w) => w.show()),
    onDone: () => {
      ed.config = normalizeConfig({ ...ed.config, [field.key]: read() }, DEFAULTS[mode]);
      persistEditors();
      renderEditor(mode);
    },
  });
}

function cancelEditor(mode) {
  const ed = state.editors[mode];
  const reset = () => {
    ed.config = { ...DEFAULTS[mode] };
    ed.presetId = null;
    persistEditors();
    renderEditor(mode);
    toast('ZURÜCKGESETZT');
  };
  if (!ed.presetId && sameConfig(ed.config, DEFAULTS[mode])) { toast('KEINE ÄNDERUNGEN'); return; }
  dialog({
    title: ed.presetId ? 'BEARBEITEN BEENDEN?' : 'ÄNDERUNGEN VERWERFEN?',
    message: ed.presetId
      ? 'Nicht gespeicherte Änderungen gehen verloren. Der Editor zeigt danach wieder die Standardwerte.'
      : 'Alle Werte werden auf die Standardwerte zurückgesetzt.',
    buttons: [{ label: 'NEIN' }, { label: 'VERWERFEN', kind: 'danger', action: reset }],
  });
}

function suggestName(mode, c) {
  if (mode === 'tabata' && sameConfig(c, DEFAULTS.tabata)) return 'TABATA';
  return `${c.rounds}× ${fmtValue(c.work)}`.replace(/^:/, '');
}

function createPreset(mode, name) {
  const ed = state.editors[mode];
  const p = {
    id: store.uid(),
    name: (name || suggestName(mode, ed.config)).toUpperCase().slice(0, 40),
    mode,
    config: { ...ed.config },
    created: Date.now(),
    lastUsed: 0,
  };
  state.presets.unshift(p);
  persistPresets();
  ed.presetId = p.id;
  persistEditors();
  renderEditor(mode);
  toast('VORLAGE GESPEICHERT');
}

function saveEditor(mode) {
  const ed = state.editors[mode];
  const preset = ed.presetId ? findPreset(ed.presetId) : null;
  const input = { value: preset ? preset.name : suggestName(mode, ed.config), placeholder: 'Z. B. BOXEN 3X3' };
  if (!preset) {
    dialog({
      title: 'ALS VORLAGE SPEICHERN',
      message: 'Name der Vorlage, z. B. „Boxen 3x3“.',
      input,
      buttons: [{ label: 'ABBRECHEN' }, { label: 'SPEICHERN', kind: 'primary', action: (n) => createPreset(mode, n) }],
    });
    return;
  }
  dialog({
    title: 'VORLAGE SPEICHERN',
    message: 'Änderungen in die Vorlage übernehmen oder als neue Vorlage anlegen.',
    input,
    buttons: [
      { label: 'ALS NEU', action: (n) => createPreset(mode, n) },
      {
        label: 'SPEICHERN', kind: 'primary', action: (n) => {
          preset.name = (n || preset.name).toUpperCase().slice(0, 40);
          preset.config = { ...ed.config };
          persistPresets();
          renderEditor(mode);
          toast('VORLAGE AKTUALISIERT');
        },
      },
    ],
  });
}

function addTimer(mode) {
  const ed = state.editors[mode];
  dialog({
    title: 'NEUEN TIMER HINZUFÜGEN',
    message: 'Die aktuellen Werte werden als neue Vorlage gespeichert.',
    input: { value: suggestName(mode, ed.config), placeholder: 'NAME' },
    buttons: [{ label: 'ABBRECHEN' }, { label: 'HINZUFÜGEN', kind: 'primary', action: (n) => createPreset(mode, n) }],
  });
}

/* ================= Laufendes Training ================= */

function startRun(config, presetId = null) {
  const plan = buildPlan(config);
  if (plan.total <= 0) { toast('ALLE WERTE SIND 0'); return; }
  const preset = presetId ? findPreset(presetId) : null;
  if (preset) { preset.lastUsed = Date.now(); persistPresets(); }
  state.run = new IntervalRun(config);
  state.runName = preset ? preset.name : null;
  state.finished = false;
  startAudio(); // synchron in der Tipp-Geste
  openRunScreen();
  saveSession();
}

function startAudio() {
  const run = state.run;
  state.audioStarted = false;
  $('#run-audio').hidden = true;
  if (!run || !run.running || !state.settings.sound) { player.stop(); return; }
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
  } catch { /* ältere iOS-Versionen */ }
  try {
    player.start(run.plan, run.elapsed(), volumeAmp(), () => (state.run ? state.run.elapsed() : 0));
    state.audioStarted = true;
    state.lastSync = performance.now();
  } catch (err) {
    console.error(err);
    toast('TON KONNTE NICHT ERZEUGT WERDEN');
  }
}

function openRunScreen() {
  const runEl = $('#run');
  runEl.hidden = false;
  $('#run-done').hidden = true;
  $('#btn-pause-ico').replaceChildren();
  state.lastIndex = -1;
  state.fitIndex = -1;
  cancelAnimationFrame(state.raf);
  renderRun();
  state.raf = requestAnimationFrame(runLoop);
  requestWakeLock();
}

function runLoop() {
  renderRun();
  if (state.run && !state.finished) state.raf = requestAnimationFrame(runLoop);
}

function roundLabel(seg, plan) {
  if (seg.type === 'prep') return plan.rounds ? `GLEICH GEHT’S LOS · ${plan.rounds} RUNDEN` : 'GLEICH GEHT’S LOS';
  if (seg.type === 'cool') return 'ALLE RUNDEN GESCHAFFT';
  return `RUNDE ${seg.round} / ${plan.rounds}`;
}

const setText = (el, text) => { if (el.textContent !== text) el.textContent = text; };

/** Verkleinert die Schrift, falls der Text breiter als sein Container ist (z. B. ohne schmale Schrift). */
function fitText(el) {
  el.style.fontSize = '';
  const avail = el.parentElement.clientWidth;
  const w = el.scrollWidth;
  if (w > avail && avail > 0) el.style.fontSize = `${(parseFloat(getComputedStyle(el).fontSize) * avail * 0.97) / w}px`;
}
function fitRunTexts() {
  if ($('#run').hidden) return;
  fitText($('#run-phase'));
  fitText($('#run-round'));
  fitText($('#run-time'));
}

function renderRun() {
  const run = state.run;
  if (!run || state.finished) return;
  const st = run.status();
  if (st.done) { finishRun(); return; }
  const seg = st.segment;
  const runEl = $('#run');
  if (st.index !== state.lastIndex) {
    const first = state.lastIndex === -1;
    state.lastIndex = st.index;
    runEl.style.setProperty('--phase', PHASES[seg.type].color);
    runEl.style.setProperty('--on', TEXT_ON[seg.type]);
    setText($('#run-phase'), PHASES[seg.type].name);
    setText($('#run-round'), roundLabel(seg, run.plan));
    const next = run.plan.segments[st.index + 1];
    setText($('#run-next'), next ? `DANACH: ${PHASES[next.type].name} ${fmtValue(next.duration / 1000)}` : 'DANACH: FERTIG');
    if (!first) flash();
    updateMediaSession(seg);
  }
  const timeEl = $('#run-time');
  const timeText = fmtClock(st.segRemaining);
  const relayout = timeEl.textContent.length !== timeText.length || state.fitIndex !== st.index;
  setText(timeEl, timeText);
  if (relayout) { state.fitIndex = st.index; fitRunTexts(); }
  setText($('#run-total'), fmtClock(st.totalRemaining));
  $('#run-bar').style.transform = `scaleX(${st.progress.toFixed(4)})`;
  const paused = !run.running;
  if (runEl.classList.contains('paused') !== paused || !$('#btn-pause-ico').firstChild) {
    runEl.classList.toggle('paused', paused);
    $('#btn-pause-ico').innerHTML = `<span class="ico">${ICONS[paused ? 'play' : 'pause']}</span>`;
    setText($('#btn-pause-label'), paused ? 'WEITER' : 'PAUSE');
    setPlaybackState(paused ? 'paused' : 'playing');
  }
  const now = performance.now();
  if (!paused && state.audioStarted && now - state.lastSync > 1000) {
    state.lastSync = now;
    player.sync();
  }
}

function pauseRun() {
  const run = state.run;
  if (!run || state.finished || !run.running) return;
  run.pause();
  player.pause();
  saveSession();
  renderRun();
}

function resumeRun() {
  const run = state.run;
  if (!run || state.finished || run.running) return;
  run.resume();
  startAudio(); // Restplan neu erzeugen und ab aktueller Position starten
  saveSession();
  renderRun();
}

function togglePause() {
  if (!state.run) return;
  if (state.run.running) pauseRun();
  else resumeRun();
}

function skipRun() {
  const run = state.run;
  if (!run || state.finished) return;
  run.skip();
  if (run.running) startAudio();
  saveSession();
  renderRun();
}

function confirmStop() {
  if (!state.run) return;
  dialog({
    title: 'TRAINING BEENDEN?',
    message: 'Der aktuelle Fortschritt geht verloren.',
    buttons: [{ label: 'WEITERMACHEN' }, { label: 'BEENDEN', kind: 'danger', action: endRun }],
  });
}

function finishRun() {
  const run = state.run;
  state.finished = true;
  cancelAnimationFrame(state.raf);
  store.clearSession();
  releaseWakeLock();
  flash();
  setText($('#done-name'), state.runName || '');
  setText($('#done-time'), fmtClock(run.plan.total));
  $('#run-done').hidden = false;
  updateMediaSession(null);
  setPlaybackState('none');
  // Der Gong steckt bereits in der Audiodatei und klingt von selbst aus.
}

function endRun() {
  cancelAnimationFrame(state.raf);
  player.stop();
  state.run = null;
  state.finished = false;
  state.audioStarted = false;
  store.clearSession();
  releaseWakeLock();
  $('#run').hidden = true;
  $('#run').classList.remove('paused');
  clearMediaSession();
  if (state.pendingReload) location.reload();
  if (state.tab === 'mehr') renderMore();
}

function saveSession() {
  if (state.run && !state.finished) store.saveSession({ ...state.run.toJSON(), name: state.runName });
}

function restoreSession() {
  const saved = store.loadSession();
  if (!saved) return;
  try {
    const run = IntervalRun.fromJSON(saved);
    if (run.plan.total <= 0 || run.done) { store.clearSession(); return; }
    state.run = run;
    state.runName = typeof saved.name === 'string' ? saved.name : null;
    state.finished = false;
    openRunScreen();
    // Nach einem Neustart darf iOS erst nach einem Tipp wieder Ton abspielen.
    if (run.running && state.settings.sound) $('#run-audio').hidden = false;
  } catch {
    store.clearSession();
  }
}

/* ================= Media Session & Wake Lock ================= */

function updateMediaSession(seg) {
  if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
  const run = state.run;
  let title = 'MoorTimer – FERTIG';
  if (seg) {
    title = `MoorTimer – ${PHASES[seg.type].name}`;
    if (seg.round) title += ` · Runde ${seg.round}/${run.plan.rounds}`;
  }
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist: state.runName || 'Intervall-Timer',
      album: 'MoorTimer',
      artwork: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    });
  } catch { /* nicht unterstützt */ }
}

function setPlaybackState(s) {
  try { if ('mediaSession' in navigator) navigator.mediaSession.playbackState = s; } catch { /* egal */ }
}

function clearMediaSession() {
  try {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
    }
  } catch { /* egal */ }
}

function initMediaSession() {
  if (!('mediaSession' in navigator)) return;
  const set = (action, fn) => { try { navigator.mediaSession.setActionHandler(action, fn); } catch { /* nicht unterstützt */ } };
  set('play', () => resumeRun());
  set('pause', () => pauseRun());
  set('nexttrack', () => skipRun());
}

let wakeLock = null;
async function requestWakeLock() {
  if (!state.settings.keepAwake || !state.run || state.finished) return;
  if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  if (wakeLock && !wakeLock.released) return;
  try { wakeLock = await navigator.wakeLock.request('screen'); } catch { wakeLock = null; }
}
function releaseWakeLock() {
  try { wakeLock?.release(); } catch { /* egal */ }
  wakeLock = null;
}

/* ================= Stoppuhr ================= */

function renderStopwatch() {
  const view = $('#view-stoppuhr');
  if (!view.firstChild) {
    view.append(
      topbar(null, 'STOPPUHR', null),
      h('div', { class: 'sw-display', id: 'sw-display', text: '00:00,00' }),
      h('div', { class: 'sw-btns' },
        h('button', { class: 'sw-btn', id: 'sw-left', type: 'button', onclick: swLeft }),
        h('button', { class: 'sw-btn', id: 'sw-right', type: 'button', onclick: swRight })),
      h('div', { class: 'laps-head', id: 'sw-head' }, h('span', { text: 'RUNDE' }), h('span', { text: 'RUNDENZEIT' }), h('span', { text: 'GESAMT' })),
      h('div', { class: 'laps', id: 'sw-laps' }));
  }
  updateStopwatch(true);
}

function updateStopwatch(full = false) {
  const sw = state.sw;
  const e = sw.elapsed();
  const disp = $('#sw-display');
  if (!disp) return;
  setText(disp, fmtStopwatch(e));
  disp.classList.toggle('long', e >= 3600000);
  if (!full) {
    const cur = document.querySelector('#sw-laps .current .lt');
    if (cur) setText(cur, fmtStopwatch(sw.currentLap()));
    const curTot = document.querySelector('#sw-laps .current .tot');
    if (curTot) setText(curTot, fmtStopwatch(e));
    return;
  }
  const left = $('#sw-left');
  const right = $('#sw-right');
  left.textContent = sw.running || e === 0 ? 'RUNDE' : 'RESET';
  left.disabled = !sw.running && e === 0;
  right.textContent = sw.running ? 'STOPP' : 'START';
  right.className = 'sw-btn ' + (sw.running ? 'halt' : 'go');
  const rows = sw.lapRows();
  const times = rows.map((r) => r.lap);
  const best = rows.length > 1 ? Math.min(...times) : null;
  const worst = rows.length > 1 ? Math.max(...times) : null;
  const lapEl = (n, lap, tot, cls) => h('div', { class: 'lap ' + cls },
    h('span', { text: `RUNDE ${n}` }), h('span', { class: 'lt', text: fmtStopwatch(lap) }), h('span', { class: 'tot', text: fmtStopwatch(tot) }));
  const list = [];
  if (e > 0) list.push(lapEl(rows.length + 1, sw.currentLap(), e, 'current'));
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    list.push(lapEl(r.n, r.lap, r.total, r.lap === best ? 'best' : r.lap === worst ? 'worst' : ''));
  }
  $('#sw-laps').replaceChildren(...list);
  $('#sw-head').hidden = list.length === 0;
}

function swLeft() {
  const sw = state.sw;
  if (sw.running) sw.lap();
  else sw.reset();
  store.saveStopwatch(sw.toJSON());
  updateStopwatch(true);
}

function swRight() {
  const sw = state.sw;
  if (sw.running) sw.stop();
  else sw.start();
  store.saveStopwatch(sw.toJSON());
  updateStopwatch(true);
  swLoop();
}

function swLoop() {
  cancelAnimationFrame(state.swRaf);
  const tick = () => {
    if (state.tab !== 'stoppuhr' || !state.sw.running) return;
    updateStopwatch();
    state.swRaf = requestAnimationFrame(tick);
  };
  state.swRaf = requestAnimationFrame(tick);
}

/* ================= Mehr ================= */

function presetRow(p, i, list) {
  const move = (dir) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    persistPresets();
    renderMore();
  };
  return h('div', { class: 'preset' },
    h('button', { class: 'preset-main', type: 'button', 'aria-label': `${p.name} starten`, onclick: () => startRun(p.config, p.id) },
      icon('play'),
      h('span', { class: 'preset-text' },
        h('div', { class: 'preset-name', text: p.name }),
        h('div', { class: 'preset-sum', text: configSummary(p.config) }))),
    h('button', { class: 'ibtn', type: 'button', 'aria-label': 'Nach oben', disabled: i === 0, onclick: () => move(-1) }, icon('up')),
    h('button', { class: 'ibtn', type: 'button', 'aria-label': 'Nach unten', disabled: i === list.length - 1, onclick: () => move(1) }, icon('down')),
    h('button', { class: 'ibtn', type: 'button', 'aria-label': 'Aktionen', onclick: () => presetActions(p) }, icon('dots')));
}

function presetActions(p) {
  dialog({
    title: p.name,
    message: configSummary(p.config),
    vertical: true,
    buttons: [
      { label: 'STARTEN', kind: 'primary', action: () => startRun(p.config, p.id) },
      { label: 'BEARBEITEN', action: () => editPreset(p) },
      { label: 'UMBENENNEN', action: () => renamePreset(p) },
      { label: 'DUPLIZIEREN', action: () => duplicatePreset(p) },
      { label: 'LÖSCHEN', kind: 'danger', action: () => deletePreset(p) },
      { label: 'ABBRECHEN' },
    ],
  });
}

function editPreset(p) {
  const ed = state.editors[p.mode];
  ed.config = { ...p.config };
  ed.presetId = p.id;
  persistEditors();
  showTab(p.mode);
}

function renamePreset(p) {
  dialog({
    title: 'UMBENENNEN',
    input: { value: p.name, placeholder: 'NAME' },
    buttons: [{ label: 'ABBRECHEN' }, {
      label: 'SPEICHERN', kind: 'primary', action: (n) => {
        if (!n) return;
        p.name = n.toUpperCase().slice(0, 40);
        persistPresets();
        renderMore();
      },
    }],
  });
}

function duplicatePreset(p) {
  const i = state.presets.indexOf(p);
  const copy = { ...p, id: store.uid(), name: `${p.name} KOPIE`.slice(0, 40), config: { ...p.config }, created: Date.now(), lastUsed: 0 };
  state.presets.splice(i + 1, 0, copy);
  persistPresets();
  renderMore();
  toast('DUPLIZIERT');
}

function deletePreset(p) {
  dialog({
    title: 'VORLAGE LÖSCHEN?',
    message: `„${p.name}“ wird endgültig gelöscht.`,
    buttons: [{ label: 'ABBRECHEN' }, {
      label: 'LÖSCHEN', kind: 'danger', action: () => {
        state.presets = state.presets.filter((x) => x !== p);
        for (const ed of Object.values(state.editors)) if (ed.presetId === p.id) ed.presetId = null;
        persistPresets();
        persistEditors();
        renderMore();
        toast('GELÖSCHT');
      },
    }],
  });
}

function toggleRow(title, desc, key, onChange) {
  const input = h('input', { type: 'checkbox', checked: !!state.settings[key], 'aria-label': title });
  input.addEventListener('change', () => {
    state.settings[key] = input.checked;
    store.saveSettings(state.settings);
    onChange?.();
  });
  return h('label', { class: 'set-row' },
    h('span', { class: 'row-text' }, h('div', { class: 'set-title', text: title }), desc && h('div', { class: 'row-desc', text: desc })),
    h('span', { class: 'switch' }, input, h('span')));
}

function volumeRow() {
  const val = h('span', { class: 'set-val', text: `${state.settings.volume} %` });
  const range = h('input', { type: 'range', min: '0', max: '100', step: '5', value: String(state.settings.volume), 'aria-label': 'Lautstärke' });
  const paint = () => range.style.setProperty('--p', `${range.value}%`);
  paint();
  range.addEventListener('input', () => {
    state.settings.volume = Number(range.value);
    val.textContent = `${range.value} %`;
    paint();
  });
  range.addEventListener('change', () => store.saveSettings(state.settings));
  return h('div', { class: 'set-row stack' },
    h('div', { class: 'set-head' }, h('span', { class: 'set-title', text: 'LAUTSTÄRKE' }), val),
    range,
    h('div', { class: 'row-desc', text: 'GILT AB DEM NÄCHSTEN START. IPHONE-LAUTSTÄRKE ZUSÄTZLICH HOCHDREHEN.' }));
}

function renderMore() {
  const view = $('#view-mehr');
  const scroll = view.scrollTop;
  const list = state.presets;
  const recents = list.filter((p) => p.lastUsed).sort((a, b) => b.lastUsed - a.lastUsed).slice(0, 3);
  view.replaceChildren(...[
    topbar(null, 'MEHR', null),
    recents.length ? [
      h('div', { class: 'section-label', text: 'ZULETZT BENUTZT' }),
      h('div', { class: 'rows' }, recents.map((p) => h('div', { class: 'preset' },
        h('button', { class: 'preset-main', type: 'button', onclick: () => startRun(p.config, p.id) },
          icon('play'),
          h('span', { class: 'preset-text' },
            h('div', { class: 'preset-name', text: p.name }),
            h('div', { class: 'preset-sum', text: configSummary(p.config) })))))),
    ] : null,
    h('div', { class: 'section-label', text: 'VORLAGEN' }),
    list.length
      ? h('div', { class: 'rows' }, list.map((p, i) => presetRow(p, i, list)))
      : h('div', { class: 'empty', text: 'NOCH KEINE VORLAGEN. IM TAB RUNDEN ODER TABATA AUF „SPEICHERN“ TIPPEN.' }),
    list.length ? h('div', { class: 'small-note', text: 'TIPPEN = STARTEN · PFEILE = REIHENFOLGE · ⋯ = BEARBEITEN, UMBENENNEN, DUPLIZIEREN, LÖSCHEN' }) : null,
    h('div', { class: 'section-label', text: 'EINSTELLUNGEN' }),
    h('div', { class: 'rows' },
      toggleRow('TÖNE', 'SIGNALE WÄHREND DES TRAININGS', 'sound'),
      volumeRow(),
      h('button', { class: 'set-row', type: 'button', onclick: () => player.preview(volumeAmp()) },
        h('span', { class: 'row-text' }, h('div', { class: 'set-title', text: 'TÖNE TESTEN' }), h('div', { class: 'row-desc', text: 'TICK · AKTIVITÄT · PAUSE · GONG' })),
        icon('sound')),
      toggleRow('BILDSCHIRM ANLASSEN', 'WÄHREND EIN TIMER LÄUFT', 'keepAwake')),
    h('div', { class: 'card' },
      h('b', { text: 'SIGNALE BEI GESPERRTEM BILDSCHIRM' }),
      'Lautlos-Schalter beachten, Lautstärke hochdrehen. Die App beim Training nicht aus dem App-Umschalter wegwischen – sonst verstummen die Signale.'),
    h('div', { class: 'section-label', text: 'INFO' }),
    h('div', { class: 'rows' },
      h('div', { class: 'set-row' },
        h('span', { class: 'row-text' }, h('div', { class: 'set-title', text: 'MOORTIMER' }), h('div', { class: 'row-desc', text: 'OFFLINE · OHNE WERBUNG · DATEN NUR AUF DIESEM GERÄT' })),
        h('span', { class: 'set-val', text: `VERSION ${APP_VERSION}` }))),
    h('button', { class: 'danger-btn', type: 'button', text: 'ALLE DATEN LÖSCHEN', onclick: wipeAll }),
  ].flat().filter(Boolean));
  view.scrollTop = scroll;
}

function wipeAll() {
  dialog({
    title: 'ALLE DATEN LÖSCHEN?',
    message: 'Vorlagen, Einstellungen und Stoppuhr werden von diesem Gerät gelöscht. Das kann nicht rückgängig gemacht werden.',
    buttons: [{ label: 'ABBRECHEN' }, {
      label: 'LÖSCHEN', kind: 'danger', action: () => {
        store.clearAll();
        state.settings = store.loadSettings();
        state.presets = [];
        state.editors = store.loadEditors();
        state.sw = new Stopwatch();
        $('#view-stoppuhr').replaceChildren();
        ['runden', 'tabata'].forEach(renderEditor);
        renderMore();
        toast('ALLE DATEN GELÖSCHT');
      },
    }],
  });
}

/* ================= Start ================= */

function initServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return; // Erstinstallation: nichts neu laden
    if (state.run) state.pendingReload = true; // Update erst nach dem Training
    else location.reload();
  });
}

function init() {
  document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = ICONS[el.dataset.icon]; });
  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
  $('#btn-pause').addEventListener('click', togglePause);
  $('#btn-skip').addEventListener('click', skipRun);
  $('#btn-stop').addEventListener('click', confirmStop);
  $('#btn-close').addEventListener('click', endRun);
  $('#run-audio').addEventListener('click', startAudio);

  // Zoom-Gesten und Doppeltipp-Zoom unterdrücken.
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (state.run && !state.finished) {
        renderRun();
        if (state.run && state.run.running && state.audioStarted) player.sync();
        requestWakeLock();
      }
      if (state.tab === 'stoppuhr') { updateStopwatch(true); swLoop(); }
    } else {
      saveSession();
    }
  });
  window.addEventListener('resize', fitRunTexts);
  window.addEventListener('pageshow', () => { if (state.run && !state.finished) renderRun(); });

  ['runden', 'tabata'].forEach(renderEditor);
  initMediaSession();
  showTab(state.tab);
  restoreSession();
  initServiceWorker();
}

init();
