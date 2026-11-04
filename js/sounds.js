// Ton-Synthese und WAV-Erzeugung. Kein DOM, daher in Node testbar.

/**
 * Mono, 16 Bit, 11,025 kHz = 22 KB/s. 16 Bit statt 8 Bit, weil der Gong sonst
 * hörbar rauscht; Speicher bleibt klein, da höchstens zwei 10-Minuten-Chunks
 * (je ~13 MB) gleichzeitig existieren.
 */
export const FORMAT = Object.freeze({ sampleRate: 11025, bits: 16 });
export const CHUNK_MS = 10 * 60 * 1000;
/** Ein Rest unter 5 Minuten wird an den vorigen Chunk gehängt (≤ 15 min = eine Datei). */
export const MIN_LAST_CHUNK_MS = 5 * 60 * 1000;
/** Stille nach dem Gong, damit er vollständig ausklingt. */
export const TAIL_MS = 4000;

function addTone(out, sr, t0, dur, partials, { attack = 0.004, decay = 0.25, drive = 0 } = {}) {
  const s0 = Math.round(t0 * sr);
  const n = Math.round(dur * sr);
  const rel = Math.max(1, Math.round(0.012 * sr));
  for (let i = 0; i < n; i++) {
    const idx = s0 + i;
    if (idx >= out.length) break;
    const t = i / sr;
    let env = Math.min(1, t / attack) * Math.exp(-t / decay);
    if (n - i < rel) env *= (n - i) / rel;
    let v = 0;
    for (const [f, a] of partials) {
      let w = Math.sin(2 * Math.PI * f * t);
      // Weiche Rechteck-Annäherung: mehr Biss beim Tick.
      if (drive) w = Math.tanh(w * drive) / Math.tanh(drive);
      v += a * w;
    }
    out[idx] += v * env;
  }
}

const BUILDERS = {
  // Kurzer, trockener Tick für 3-2-1.
  tick: {
    len: 0.09,
    build: (o, sr) => addTone(o, sr, 0, 0.08, [[1200, 1]], { attack: 0.002, decay: 0.035, drive: 2.5 }),
  },
  // Heller Doppelton: Start der Aktivität.
  work: {
    len: 0.52,
    build: (o, sr) => {
      addTone(o, sr, 0, 0.17, [[1318.5, 1], [2637, 0.25]], { decay: 0.2 });
      addTone(o, sr, 0.21, 0.3, [[1760, 1], [3520, 0.2]], { decay: 0.25 });
    },
  },
  // Tieferer, weicher Ton: Start von Pause/Abklingzeit.
  rest: {
    len: 0.65,
    build: (o, sr) => addTone(o, sr, 0, 0.62, [[587.33, 1], [880, 0.3], [1174.66, 0.2]], { attack: 0.006, decay: 0.32 }),
  },
  // Langer, abklingender Gong (inharmonische Teiltöne wie bei einer Glocke).
  end: {
    len: 3.6,
    build: (o, sr) => {
      const base = 330;
      const partials = [[1, 1, 1.5], [2, 0.5, 0.9], [2.76, 0.4, 0.65], [5.4, 0.22, 0.32], [8.93, 0.1, 0.16]];
      const n = Math.min(o.length, Math.round(3.6 * sr));
      const rel = Math.round(0.08 * sr);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        let v = 0;
        for (const [ratio, a, d] of partials) v += a * Math.sin(2 * Math.PI * base * ratio * t) * Math.exp(-t / d);
        let env = Math.min(1, t / 0.003);
        if (n - i < rel) env *= (n - i) / rel;
        o[i] += v * env;
      }
    },
  },
};

export const SOUND_MS = Object.freeze(Object.fromEntries(Object.entries(BUILDERS).map(([k, b]) => [k, b.len * 1000])));

const cache = new Map();

/** Synthetisierter Klang, auf Spitze 1,0 normalisiert. */
export function synth(type, sampleRate = FORMAT.sampleRate) {
  const key = `${type}@${sampleRate}`;
  if (cache.has(key)) return cache.get(key);
  const b = BUILDERS[type];
  if (!b) throw new Error(`Unbekannter Klang: ${type}`);
  const out = new Float32Array(Math.ceil(b.len * sampleRate));
  b.build(out, sampleRate);
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] /= peak;
  cache.set(key, out);
  return out;
}

function writeHeader(dv, sampleRate, bits, dataBytes) {
  const str = (off, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i)); };
  const blockAlign = bits / 8;
  str(0, 'RIFF');
  dv.setUint32(4, 36 + dataBytes, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); // PCM
  dv.setUint16(22, 1, true); // mono
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * blockAlign, true);
  dv.setUint16(32, blockAlign, true);
  dv.setUint16(34, bits, true);
  str(36, 'data');
  dv.setUint32(40, dataBytes, true);
}

/**
 * Erzeugt eine WAV-Datei: Stille der Länge durationMs, an den Ereignis-Zeitpunkten
 * (offsetMs relativ zum Dateianfang) die Klänge. volume 0..1 wird fest eingerechnet,
 * weil iOS audio.volume ignoriert.
 */
export function renderWav(durationMs, events, volume = 1, fmt = FORMAT) {
  const { sampleRate: sr, bits } = fmt;
  if (bits !== 16 && bits !== 8) throw new Error('Nur 8 oder 16 Bit');
  const n = Math.max(1, Math.ceil((durationMs / 1000) * sr));
  const dataBytes = n * (bits / 8);
  const buf = new ArrayBuffer(44 + dataBytes);
  writeHeader(new DataView(buf), sr, bits, dataBytes);
  const amp = Math.max(0, Math.min(1, volume)) * 0.92;
  // Int16Array nutzt die Byte-Reihenfolge der Plattform; alle Zielgeräte sind Little-Endian wie WAV.
  const pcm = bits === 16 ? new Int16Array(buf, 44, n) : new Uint8Array(buf, 44, n);
  const full = bits === 16 ? 32767 : 127;
  const zero = bits === 16 ? 0 : 128;
  if (zero) pcm.fill(zero);
  if (amp > 0) {
    for (const ev of events) {
      const s = synth(ev.sound, sr);
      const pos = Math.round((ev.offsetMs / 1000) * sr);
      for (let i = 0; i < s.length; i++) {
        const idx = pos + i;
        if (idx < 0) continue;
        if (idx >= n) break;
        const v = pcm[idx] - zero + Math.round(s[i] * amp * full);
        pcm[idx] = Math.max(-full - 1, Math.min(full, v)) + zero;
      }
    }
  }
  return new Uint8Array(buf);
}

/**
 * Teilt den Restplan ab fromMs in Audio-Chunks (~10 min). Grenzen werden so
 * verschoben, dass sie nie in einen Klang fallen; der letzte Chunk enthält den
 * Gong samt Ausklingzeit.
 */
export function planChunks(fromMs, totalMs, events, chunkMs = CHUNK_MS) {
  const evs = events.filter((e) => e.at >= fromMs - 0.5 && e.at <= totalMs);
  const endMs = totalMs + TAIL_MS;
  const chunks = [];
  let cur = fromMs;
  while (cur < endMs) {
    let b = cur + chunkMs;
    if (endMs - b < MIN_LAST_CHUNK_MS) {
      b = endMs;
    } else {
      let moved = true;
      while (moved) {
        moved = false;
        for (const e of evs) {
          const s = e.at - 100;
          const en = e.at + SOUND_MS[e.sound] + 100;
          if (b > s && b < en) { b = en; moved = true; }
        }
      }
      b = Math.min(b, endMs);
    }
    chunks.push({
      startMs: cur,
      endMs: b,
      events: evs.filter((e) => e.at >= cur - 0.5 && e.at < b).map((e) => ({ offsetMs: Math.max(0, e.at - cur), sound: e.sound })),
    });
    cur = b;
  }
  return chunks;
}

/** Hörprobe aller Signale für die Einstellungen. */
export function previewEvents() {
  return [
    { offsetMs: 0, sound: 'tick' },
    { offsetMs: 1000, sound: 'tick' },
    { offsetMs: 2000, sound: 'tick' },
    { offsetMs: 3000, sound: 'work' },
    { offsetMs: 4400, sound: 'rest' },
    { offsetMs: 5600, sound: 'end' },
  ];
}
export const PREVIEW_MS = 5600 + 3800;
