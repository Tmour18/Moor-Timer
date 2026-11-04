import { buildPlan, locate, normalizeConfig } from './plan.js';

/**
 * Laufendes Intervall-Training. Der Stand wird nie hochgezählt, sondern immer aus
 * Zeitstempeln abgeleitet: elapsed = baseElapsed + (jetzt − anchor), solange es läuft.
 * Pause friert baseElapsed ein, Überspringen setzt es auf das Phasenende.
 * Date.now statt performance.now, weil der Stand einen App-Neustart überleben soll.
 */
export class IntervalRun {
  constructor(config, { now = Date.now, state = null } = {}) {
    this.now = now;
    this.config = normalizeConfig(config);
    this.plan = buildPlan(this.config);
    this.baseElapsed = Number.isFinite(state?.baseElapsed) ? state.baseElapsed : 0;
    this.running = typeof state?.running === 'boolean' ? state.running : true;
    this.anchor = Number.isFinite(state?.anchor) ? state.anchor : now();
  }

  elapsed() {
    const e = this.running ? this.baseElapsed + (this.now() - this.anchor) : this.baseElapsed;
    return Math.min(Math.max(e, 0), this.plan.total);
  }

  status() {
    return locate(this.plan, this.elapsed());
  }

  get done() {
    return this.elapsed() >= this.plan.total;
  }

  pause() {
    if (!this.running) return;
    this.baseElapsed = this.elapsed();
    this.running = false;
  }

  resume() {
    if (this.running) return;
    this.anchor = this.now();
    this.running = true;
  }

  /** Springt an den Anfang der nächsten Phase (bzw. ans Ende). */
  skip() {
    const st = this.status();
    if (st.done) return st;
    this.baseElapsed = st.segment.end;
    this.anchor = this.now();
    return this.status();
  }

  toJSON() {
    return { config: this.config, baseElapsed: this.baseElapsed, running: this.running, anchor: this.anchor };
  }

  static fromJSON(data, opts = {}) {
    return new IntervalRun(data?.config, { ...opts, state: data });
  }
}
