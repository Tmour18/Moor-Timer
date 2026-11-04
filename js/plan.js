// Phasenplan: reine Logik ohne DOM, damit sie in Node testbar ist.

export const PHASES = Object.freeze({
  prep: { name: 'VORBEREITUNG', color: '#FFD60A', sound: null },
  work: { name: 'AKTIVITÄT', color: '#99FF33', sound: 'work' },
  rest: { name: 'PAUSE', color: '#FF3B30', sound: 'rest' },
  cool: { name: 'ABKLINGZEIT', color: '#2E9BFF', sound: 'rest' },
});

export const LIMITS = Object.freeze({ maxSeconds: 99 * 60 + 59, maxRounds: 99 });

export const DEFAULTS = Object.freeze({
  runden: Object.freeze({ prep: 10, work: 180, rest: 60, rounds: 10, cool: 30 }),
  tabata: Object.freeze({ prep: 10, work: 20, rest: 10, rounds: 8, cool: 30 }),
});

export const CONFIG_KEYS = ['prep', 'work', 'rest', 'rounds', 'cool'];

/** Anzahl der Tick-Signale vor jedem Phasenende (3-2-1). */
export const TICK_COUNT = 3;

function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Bringt eine (evtl. kaputte) Konfiguration in gültige Ganzzahl-Grenzen. */
export function normalizeConfig(config, fallback = DEFAULTS.runden) {
  const c = config && typeof config === 'object' ? config : {};
  return {
    prep: clampInt(c.prep, 0, LIMITS.maxSeconds, fallback.prep),
    work: clampInt(c.work, 0, LIMITS.maxSeconds, fallback.work),
    rest: clampInt(c.rest, 0, LIMITS.maxSeconds, fallback.rest),
    rounds: clampInt(c.rounds, 0, LIMITS.maxRounds, fallback.rounds),
    cool: clampInt(c.cool, 0, LIMITS.maxSeconds, fallback.cool),
  };
}

export function sameConfig(a, b) {
  return CONFIG_KEYS.every((k) => a[k] === b[k]);
}

/**
 * Ablauf: Vorbereitung → (Aktivität → Pause) × Runden → Abklingzeit.
 * In der letzten Runde entfällt die Pause; Dauer 0 = Phase entfällt.
 * Zeiten der Segmente in Millisekunden ab Trainingsbeginn.
 */
export function buildPlan(config) {
  const c = normalizeConfig(config);
  const segments = [];
  let t = 0;
  const push = (type, seconds, round) => {
    if (seconds <= 0) return;
    const duration = seconds * 1000;
    segments.push({ type, name: PHASES[type].name, color: PHASES[type].color, duration, start: t, end: t + duration, round });
    t += duration;
  };
  push('prep', c.prep, 0);
  for (let r = 1; r <= c.rounds; r++) {
    push('work', c.work, r);
    if (r < c.rounds) push('rest', c.rest, r);
  }
  push('cool', c.cool, 0);
  return { config: c, segments, total: t, rounds: c.rounds };
}

/** Wo im Plan stehen wir nach `elapsedMs`? */
export function locate(plan, elapsedMs) {
  const e = Math.max(0, elapsedMs);
  const segs = plan.segments;
  if (!segs.length || e >= plan.total) {
    return { done: true, index: segs.length, segment: null, segElapsed: 0, segRemaining: 0, totalRemaining: 0, progress: 1 };
  }
  let lo = 0;
  let hi = segs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (segs[mid].end <= e) lo = mid + 1;
    else hi = mid;
  }
  const s = segs[lo];
  return {
    done: false,
    index: lo,
    segment: s,
    segElapsed: e - s.start,
    segRemaining: s.end - e,
    totalRemaining: plan.total - e,
    progress: (e - s.start) / s.duration,
  };
}

/**
 * Alle akustischen Signale des Trainings, sortiert:
 * Start-Ton jeder Phase (außer Vorbereitung), Ticks 3-2-1 vor jedem Phasenende,
 * Gong am Ende. Ticks, die mit dem Phasenstart zusammenfielen, entfallen.
 */
export function soundEvents(plan) {
  const events = [];
  for (const s of plan.segments) {
    const sound = PHASES[s.type].sound;
    if (sound) events.push({ at: s.start, sound });
    for (let k = TICK_COUNT; k >= 1; k--) {
      const at = s.end - k * 1000;
      if (at > s.start) events.push({ at, sound: 'tick' });
    }
  }
  if (plan.total > 0) events.push({ at: plan.total, sound: 'end' });
  return events.sort((a, b) => a.at - b.at);
}
