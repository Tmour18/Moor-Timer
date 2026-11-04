import { soundEvents } from './plan.js';
import { planChunks, renderWav, previewEvents, PREVIEW_MS } from './sounds.js';

/**
 * Spielt das ganze Training als vorberechnete WAV-Datei(en) über <audio> ab –
 * das läuft auch bei gesperrtem Bildschirm weiter. Zwei Elemente wechseln sich ab:
 * eines spielt, das andere hat den nächsten Chunk schon geladen.
 * Die Wahrheit ist die Uhr der App; das Audio wird ihr nachgeführt (sync()).
 */
export class SignalPlayer {
  constructor() {
    this.els = [0, 1].map((i) => {
      const a = document.createElement('audio');
      a.preload = 'auto';
      a.setAttribute('playsinline', '');
      a.setAttribute('aria-hidden', 'true');
      a.dataset.slot = String(i);
      a._chunk = null;
      a.addEventListener('ended', () => this._onEnded(a));
      a.addEventListener('playing', () => { if (a === this.active) this.sync(); });
      document.body.appendChild(a);
      return a;
    });
    this.chunks = [];
    this.active = null;
    this.paused = false;
    this.volume = 1;
    this.getElapsed = null;
    this.onBlocked = null;
    this.previewUrl = null;
  }

  get isPlaying() {
    return !!this.active && !this.paused;
  }

  /**
   * Startet ab Planposition fromMs. Muss im Tipp-Handler aufgerufen werden
   * (iOS erlaubt play() nur nach einer Nutzergeste – pro Element einmalig).
   */
  start(plan, fromMs, volume, getElapsed) {
    this.stop();
    this.volume = volume;
    this.getElapsed = getElapsed;
    this.chunks = planChunks(fromMs, plan.total, soundEvents(plan));
    if (!this.chunks.length) return;
    const [a, b] = this.els;
    // Zweites Element in derselben Geste freischalten, damit der Chunk-Wechsel
    // später ohne Tipp (auch im Hintergrund) abspielen darf.
    this._unlock(b);
    this._load(a, 0);
    this.active = a;
    this.paused = false;
    this._play(a);
    if (this.chunks.length > 1) this._load(b, 1);
  }

  pause() {
    this.paused = true;
    for (const el of this.els) el.pause();
  }

  stop() {
    for (const el of this.els) {
      el.pause();
      el._chunk = null;
      el.removeAttribute('src');
      el.load();
    }
    for (const c of this.chunks) if (c.url) URL.revokeObjectURL(c.url);
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = null;
    this.chunks = [];
    this.active = null;
    this.paused = false;
  }

  /** Spielt alle Signale einmal vor (gleicher Pfad wie im Training). */
  preview(volume) {
    this.stop();
    const a = this.els[0];
    this.previewUrl = URL.createObjectURL(new Blob([renderWav(PREVIEW_MS, previewEvents(), volume)], { type: 'audio/wav' }));
    a.src = this.previewUrl;
    this._play(a);
  }

  /** Gleicht die Audio-Position mit der App-Uhr ab (Drift > 150 ms) und wählt ggf. den richtigen Chunk. */
  sync() {
    if (!this.active || this.paused || !this.getElapsed) return;
    const e = this.getElapsed();
    const idx = this.chunks.findIndex((c) => e < c.endMs);
    if (idx < 0) return;
    const c = this.chunks[idx];
    const expected = Math.max(0, (e - c.startMs) / 1000);
    let el = this.active;
    if (el._chunk !== idx) {
      // Falscher Chunk, z. B. weil der Wechsel im Hintergrund nicht geklappt hat.
      const other = this._other(el);
      el.pause();
      el = other._chunk === idx ? other : el;
      if (el._chunk !== idx) this._load(el, idx);
      this.active = el;
      this._freeBefore(idx);
      const spare = this._other(el);
      if (idx + 1 < this.chunks.length && spare._chunk !== idx + 1) this._load(spare, idx + 1);
      this._seek(el, expected);
      this._play(el);
      return;
    }
    if (el.paused) { this._seek(el, expected); this._play(el); return; }
    if (el.readyState < 2 || el.seeking) return;
    if (Math.abs(el.currentTime - expected) > 0.15) el.currentTime = expected;
  }

  _other(el) {
    return el === this.els[0] ? this.els[1] : this.els[0];
  }

  _unlock(el) {
    if (el._unlocked) return;
    el._unlocked = true;
    el.src = SILENT_URL();
    const p = el.play();
    if (p && p.then) p.then(() => { if (el._chunk === null) el.pause(); }).catch(() => {});
  }

  _play(el) {
    const p = el.play();
    if (p && p.catch) {
      p.catch((err) => {
        if (err && err.name === 'NotAllowedError' && this.onBlocked) this.onBlocked();
      });
    }
  }

  _seek(el, seconds) {
    if (el.readyState >= 1) {
      try { el.currentTime = seconds; } catch { /* noch nicht seekbar */ }
    } else {
      el.addEventListener('loadedmetadata', () => this.sync(), { once: true });
    }
  }

  _load(el, idx) {
    const c = this.chunks[idx];
    if (!c.url) {
      const wav = renderWav(c.endMs - c.startMs, c.events, this.volume);
      c.url = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
    }
    el._chunk = idx;
    el.src = c.url;
    el.load();
  }

  _freeBefore(idx) {
    for (let i = 0; i < idx; i++) {
      const c = this.chunks[i];
      if (c.url && this.els.every((el) => el._chunk !== i)) {
        URL.revokeObjectURL(c.url);
        c.url = null;
      }
    }
  }

  _onEnded(el) {
    if (el !== this.active || el._chunk === null) return;
    const next = el._chunk + 1;
    if (next >= this.chunks.length) return; // Training-Audio vollständig abgespielt
    const other = this._other(el);
    if (other._chunk !== next) this._load(other, next);
    this._play(other);
    this.active = other;
    // Altes Element sofort mit dem übernächsten Chunk vorladen.
    el._chunk = null;
    this._freeBefore(next);
    if (next + 1 < this.chunks.length) this._load(el, next + 1);
  }
}

let silentUrl = null;
function SILENT_URL() {
  if (!silentUrl) silentUrl = URL.createObjectURL(new Blob([renderWav(200, [])], { type: 'audio/wav' }));
  return silentUrl;
}
