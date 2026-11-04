import { buildPlan } from './plan.js';

const pad = (n) => String(n).padStart(2, '0');

/** Editor-Wert in Sekunden: ":10", "03:00". */
export function fmtValue(sec) {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return ':' + pad(s);
  return pad(Math.floor(s / 60)) + ':' + pad(s % 60);
}

/** Countdown-Anzeige: angefangene Sekunden werden aufgerundet (3-2-1, dann Wechsel). */
export function fmtClock(ms) {
  const t = Math.max(0, Math.ceil(ms / 1000 - 1e-9));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Stoppuhr mit Hundertsteln: "01:02,34" bzw. "1:01:02,34". */
export function fmtStopwatch(ms) {
  const cs = Math.floor(Math.max(0, ms) / 10);
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  return `${h ? h + ':' : ''}${pad(m)}:${pad(s)},${pad(c)}`;
}

export function configSummary(config) {
  const plan = buildPlan(config);
  const c = plan.config;
  return `${c.rounds} × ${fmtValue(c.work)} / ${fmtValue(c.rest)} · ${fmtClock(plan.total)}`;
}
