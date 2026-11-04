/** Stoppuhr auf Zeitstempel-Basis; laps enthält die Gesamtzeit beim Rundenschnitt. */
export class Stopwatch {
  constructor({ now = Date.now, state = null } = {}) {
    this.now = now;
    this.acc = Number.isFinite(state?.acc) ? state.acc : 0;
    this.startWall = Number.isFinite(state?.startWall) ? state.startWall : null;
    this.laps = Array.isArray(state?.laps) ? state.laps.filter(Number.isFinite) : [];
  }

  get running() {
    return this.startWall !== null;
  }

  elapsed() {
    return this.acc + (this.running ? Math.max(0, this.now() - this.startWall) : 0);
  }

  start() {
    if (!this.running) this.startWall = this.now();
  }

  stop() {
    if (!this.running) return;
    this.acc = this.elapsed();
    this.startWall = null;
  }

  lap() {
    if (this.running) this.laps.push(this.elapsed());
  }

  reset() {
    this.acc = 0;
    this.startWall = null;
    this.laps = [];
  }

  /** Abgeschlossene Runden: { n, lap, total }. */
  lapRows() {
    return this.laps.map((total, i) => ({ n: i + 1, lap: total - (i ? this.laps[i - 1] : 0), total }));
  }

  currentLap() {
    return this.elapsed() - (this.laps.length ? this.laps[this.laps.length - 1] : 0);
  }

  toJSON() {
    return { acc: this.acc, startWall: this.startWall, laps: this.laps };
  }
}
