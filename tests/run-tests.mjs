// Minimaler Testläufer ohne Framework: node tests/run-tests.mjs
import assert from 'node:assert/strict';
import { buildPlan, locate, soundEvents, normalizeConfig, DEFAULTS } from '../js/plan.js';
import { fmtValue, fmtClock, fmtStopwatch } from '../js/format.js';
import { IntervalRun } from '../js/engine.js';
import { Stopwatch } from '../js/stopwatch.js';
import { renderWav, planChunks, synth, FORMAT, CHUNK_MS, TAIL_MS, SOUND_MS } from '../js/sounds.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✓', name);
  } catch (err) {
    failed++;
    console.log('  ✗', name);
    console.log('    ', err.message.split('\n').join('\n     '));
  }
}
const fakeClock = (start = 1_000_000) => {
  const c = { t: start, now: () => c.t };
  return c;
};

console.log('Phasenplan');

test('Standard RUNDEN: 10 Runden, Reihenfolge und Anzahl der Segmente', () => {
  const p = buildPlan(DEFAULTS.runden);
  // 1 Vorbereitung + 10 Aktivität + 9 Pausen + 1 Abklingzeit
  assert.equal(p.segments.length, 21);
  assert.deepEqual(p.segments.slice(0, 4).map((s) => s.type), ['prep', 'work', 'rest', 'work']);
  assert.equal(p.segments.filter((s) => s.type === 'work').length, 10);
  assert.equal(p.segments.filter((s) => s.type === 'rest').length, 9);
});

test('letzte Runde ohne Pause: auf die 10. Aktivität folgt die Abklingzeit', () => {
  const p = buildPlan(DEFAULTS.runden);
  const lastWork = p.segments.findLastIndex((s) => s.type === 'work');
  assert.equal(p.segments[lastWork].round, 10);
  assert.equal(p.segments[lastWork + 1].type, 'cool');
});

test('Gesamtdauer RUNDEN = 10 + 10·180 + 9·60 + 30 s = 39:40', () => {
  const p = buildPlan(DEFAULTS.runden);
  assert.equal(p.total, (10 + 1800 + 540 + 30) * 1000);
  assert.equal(fmtClock(p.total), '39:40');
});

test('Gesamtdauer TABATA = 10 + 8·20 + 7·10 + 30 s = 4:30', () => {
  const p = buildPlan(DEFAULTS.tabata);
  assert.equal(p.total, 270_000);
  assert.equal(p.segments.length, 1 + 8 + 7 + 1);
});

test('Segmente lückenlos: start = vorheriges end, Summe = total', () => {
  const p = buildPlan(DEFAULTS.runden);
  let t = 0;
  for (const s of p.segments) {
    assert.equal(s.start, t);
    assert.equal(s.end - s.start, s.duration);
    t = s.end;
  }
  assert.equal(t, p.total);
});

test('Rundennummern laufen 1..N, Pause gehört zur Runde davor', () => {
  const p = buildPlan({ prep: 0, work: 5, rest: 5, rounds: 3, cool: 0 });
  assert.deepEqual(p.segments.map((s) => `${s.type}${s.round}`), ['work1', 'rest1', 'work2', 'rest2', 'work3']);
});

test('Nullwerte: Vorbereitung 0 und Abklingzeit 0 entfallen', () => {
  const p = buildPlan({ prep: 0, work: 30, rest: 10, rounds: 2, cool: 0 });
  assert.deepEqual(p.segments.map((s) => s.type), ['work', 'rest', 'work']);
  assert.equal(p.total, 70_000);
});

test('Nullwerte: Pause 0 → Aktivitäten folgen direkt aufeinander', () => {
  const p = buildPlan({ prep: 5, work: 20, rest: 0, rounds: 3, cool: 0 });
  assert.deepEqual(p.segments.map((s) => s.type), ['prep', 'work', 'work', 'work']);
});

test('Nullwerte: 0 Runden → nur Vorbereitung und Abklingzeit', () => {
  const p = buildPlan({ prep: 10, work: 20, rest: 10, rounds: 0, cool: 30 });
  assert.deepEqual(p.segments.map((s) => s.type), ['prep', 'cool']);
});

test('Nullwerte: alles 0 → leerer Plan mit Dauer 0', () => {
  const p = buildPlan({ prep: 0, work: 0, rest: 0, rounds: 0, cool: 0 });
  assert.equal(p.segments.length, 0);
  assert.equal(p.total, 0);
  assert.equal(locate(p, 0).done, true);
});

test('1 Runde: keine Pause', () => {
  const p = buildPlan({ prep: 0, work: 60, rest: 30, rounds: 1, cool: 0 });
  assert.deepEqual(p.segments.map((s) => s.type), ['work']);
});

test('normalizeConfig: Unsinn, negative und zu große Werte werden begrenzt', () => {
  const c = normalizeConfig({ prep: -5, work: 'abc', rest: 1e9, rounds: 12.6, cool: null });
  assert.deepEqual(c, { prep: 0, work: DEFAULTS.runden.work, rest: 99 * 60 + 59, rounds: 13, cool: 0 });
  assert.deepEqual(normalizeConfig(undefined), { ...DEFAULTS.runden });
});

test('locate: Grenzen gehören zur nächsten Phase, Ende = done', () => {
  const p = buildPlan(DEFAULTS.tabata);
  assert.equal(locate(p, 0).segment.type, 'prep');
  assert.equal(locate(p, 9_999).segment.type, 'prep');
  const at10 = locate(p, 10_000);
  assert.equal(at10.segment.type, 'work');
  assert.equal(at10.segment.round, 1);
  assert.equal(at10.segRemaining, 20_000);
  assert.equal(locate(p, 269_999).segment.type, 'cool');
  assert.equal(locate(p, 270_000).done, true);
  assert.equal(locate(p, -50).segment.type, 'prep');
});

console.log('Signale');

test('Signale TABATA: 8 Aktivitäts-Töne, 7 Pausen-Töne + 1 Abklingzeit-Ton, 1 Gong', () => {
  const ev = soundEvents(buildPlan(DEFAULTS.tabata));
  const count = (s) => ev.filter((e) => e.sound === s).length;
  assert.equal(count('work'), 8);
  assert.equal(count('rest'), 8);
  assert.equal(count('end'), 1);
  // Jede der 17 Phasen hat 3 Ticks vor ihrem Ende (alle Phasen > 3 s).
  assert.equal(count('tick'), 17 * 3);
  assert.equal(ev.at(-1).at, 270_000);
});

test('Ticks 3-2-1 vor Phasenende; erster Aktivitäts-Ton direkt nach Vorbereitung', () => {
  const ev = soundEvents(buildPlan(DEFAULTS.tabata));
  assert.deepEqual(ev.slice(0, 4), [
    { at: 7000, sound: 'tick' }, { at: 8000, sound: 'tick' }, { at: 9000, sound: 'tick' }, { at: 10_000, sound: 'work' },
  ]);
});

test('Kurze Phasen: keine Ticks auf oder vor dem Phasenstart', () => {
  const ev = soundEvents(buildPlan({ prep: 0, work: 2, rest: 0, rounds: 1, cool: 0 }));
  assert.deepEqual(ev, [{ at: 0, sound: 'work' }, { at: 1000, sound: 'tick' }, { at: 2000, sound: 'end' }]);
});

console.log('Laufzeit (Zeitstempel)');

test('Fortschritt kommt aus der Uhr, nicht aus Ticks', () => {
  const clk = fakeClock();
  const run = new IntervalRun(DEFAULTS.tabata, { now: clk.now });
  clk.t += 12_345;
  assert.equal(run.elapsed(), 12_345);
  assert.equal(run.status().segment.type, 'work');
});

test('Pause friert ein, Weiter setzt fort (Pausenzeit zählt nicht)', () => {
  const clk = fakeClock();
  const run = new IntervalRun(DEFAULTS.tabata, { now: clk.now });
  clk.t += 5000;
  run.pause();
  clk.t += 60_000;
  assert.equal(run.elapsed(), 5000);
  run.resume();
  clk.t += 1000;
  assert.equal(run.elapsed(), 6000);
});

test('Überspringen springt an den Anfang der nächsten Phase, auch pausiert', () => {
  const clk = fakeClock();
  const run = new IntervalRun(DEFAULTS.tabata, { now: clk.now });
  clk.t += 3000;
  run.skip();
  assert.equal(run.elapsed(), 10_000);
  run.pause();
  run.skip();
  assert.equal(run.elapsed(), 30_000);
  assert.equal(run.status().segment.type, 'rest');
  clk.t += 99_999;
  assert.equal(run.elapsed(), 30_000);
});

test('Ende: elapsed bleibt bei total, Überspringen am Ende ist harmlos', () => {
  const clk = fakeClock();
  const run = new IntervalRun({ prep: 0, work: 5, rest: 0, rounds: 1, cool: 0 }, { now: clk.now });
  clk.t += 999_999;
  assert.equal(run.done, true);
  assert.equal(run.elapsed(), 5000);
  assert.equal(run.skip().done, true);
});

test('Sitzung überlebt Neustart (toJSON/fromJSON)', () => {
  const clk = fakeClock();
  const run = new IntervalRun(DEFAULTS.runden, { now: clk.now });
  clk.t += 70_000;
  const saved = JSON.parse(JSON.stringify(run.toJSON()));
  clk.t += 30_000;
  const back = IntervalRun.fromJSON(saved, { now: clk.now });
  assert.equal(back.elapsed(), 100_000);
});

console.log('Stoppuhr');

test('Stoppuhr: Start/Stopp/Runden über Zeitstempel', () => {
  const clk = fakeClock();
  const sw = new Stopwatch({ now: clk.now });
  sw.start();
  clk.t += 1234;
  sw.lap();
  clk.t += 1000;
  sw.stop();
  clk.t += 5000;
  assert.equal(sw.elapsed(), 2234);
  sw.start();
  clk.t += 766;
  sw.lap();
  assert.deepEqual(sw.lapRows(), [{ n: 1, lap: 1234, total: 1234 }, { n: 2, lap: 1766, total: 3000 }]);
  sw.reset();
  assert.equal(sw.elapsed(), 0);
});

console.log('Formatierung');

test('Formate', () => {
  assert.equal(fmtValue(10), ':10');
  assert.equal(fmtValue(0), ':00');
  assert.equal(fmtValue(180), '03:00');
  assert.equal(fmtClock(2001), '00:03');
  assert.equal(fmtClock(3000), '00:03');
  assert.equal(fmtClock(0), '00:00');
  assert.equal(fmtClock(3_723_000), '1:02:03');
  assert.equal(fmtStopwatch(62_345), '01:02,34');
  assert.equal(fmtStopwatch(3_600_000), '1:00:00,00');
});

console.log('Audio (WAV)');

const readHeader = (u8) => {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const s = (o, n) => String.fromCharCode(...u8.slice(o, o + n));
  return { riff: s(0, 4), wave: s(8, 4), fmt: s(12, 4), pcm: dv.getUint16(20, true), ch: dv.getUint16(22, true),
    rate: dv.getUint32(24, true), bits: dv.getUint16(34, true), data: s(36, 4), dataLen: dv.getUint32(40, true), riffLen: dv.getUint32(4, true) };
};

test('WAV-Header: PCM mono 16 Bit 11,025 kHz, Längen stimmen', () => {
  const wav = renderWav(2000, []);
  const hd = readHeader(wav);
  assert.equal(hd.riff + hd.wave + hd.fmt + hd.data, 'RIFFWAVEfmt data');
  assert.deepEqual([hd.pcm, hd.ch, hd.rate, hd.bits], [1, 1, 11025, 16]);
  assert.equal(hd.dataLen, 2 * 11025 * 2);
  assert.equal(hd.riffLen, wav.length - 8);
});

test('WAV: Klang genau an der Ereignis-Position, sonst Stille', () => {
  const wav = renderWav(3000, [{ offsetMs: 1000, sound: 'tick' }]);
  const pcm = new Int16Array(wav.buffer, 44);
  const pos = 11025;
  const energy = (a, b) => { let m = 0; for (let i = a; i < b; i++) m = Math.max(m, Math.abs(pcm[i])); return m; };
  assert.equal(energy(0, pos), 0);
  assert.ok(energy(pos, pos + 500) > 20_000, 'Tick zu leise');
  assert.equal(energy(pos + 2000, pcm.length), 0);
});

test('WAV: Lautstärke 0 → nur Stille; 8-Bit-Variante liegt bei 128', () => {
  const wav = renderWav(1000, [{ offsetMs: 0, sound: 'end' }], 0);
  assert.ok(new Int16Array(wav.buffer, 44).every((v) => v === 0));
  const w8 = renderWav(500, [], 1, { sampleRate: 11025, bits: 8 });
  assert.ok(w8.slice(44).every((v) => v === 128));
});

test('Klänge sind normalisiert und haben die angegebene Länge', () => {
  for (const s of ['tick', 'work', 'rest', 'end']) {
    const a = synth(s);
    const peak = a.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    assert.ok(Math.abs(peak - 1) < 1e-6, s);
    assert.equal(a.length, Math.ceil((SOUND_MS[s] / 1000) * FORMAT.sampleRate));
  }
});

console.log('Audio-Chunks');

test('Kurzes Training (Tabata) = genau eine Datei mit allen Signalen und Gong-Ausklang', () => {
  const plan = buildPlan(DEFAULTS.tabata);
  const ev = soundEvents(plan);
  const chunks = planChunks(0, plan.total, ev);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].endMs, plan.total + TAIL_MS);
  assert.equal(chunks[0].events.length, ev.length);
});

test('Langes Training (39:40) → ~10-min-Chunks, lückenlos, kein Signal verloren oder doppelt', () => {
  const plan = buildPlan(DEFAULTS.runden);
  const ev = soundEvents(plan);
  const chunks = planChunks(0, plan.total, ev);
  assert.ok(chunks.length >= 3 && chunks.length <= 4, `Chunks: ${chunks.length}`);
  for (let i = 1; i < chunks.length; i++) assert.equal(chunks[i].startMs, chunks[i - 1].endMs);
  const all = chunks.flatMap((c) => c.events.map((e) => c.startMs + e.offsetMs));
  assert.deepEqual(all, ev.map((e) => e.at));
  for (const c of chunks.slice(0, -1)) assert.ok(c.endMs - c.startMs >= CHUNK_MS);
});

test('Chunk-Grenzen liegen nie in einem Klang', () => {
  // Signale genau an der 10-Minuten-Marke erzwingen.
  const plan = buildPlan({ prep: 0, work: 300, rest: 0, rounds: 6, cool: 0 });
  const ev = soundEvents(plan);
  const chunks = planChunks(0, plan.total, ev);
  for (const c of chunks.slice(0, -1)) {
    for (const e of ev) assert.ok(!(c.endMs > e.at - 100 && c.endMs < e.at + SOUND_MS[e.sound] + 100), `Grenze ${c.endMs} schneidet ${e.sound}@${e.at}`);
  }
});

test('Restplan ab Mitte einer Phase: nur zukünftige Signale, Offsets relativ', () => {
  const plan = buildPlan(DEFAULTS.tabata);
  const chunks = planChunks(15_500, plan.total, soundEvents(plan));
  assert.deepEqual(chunks[0].events[0], { offsetMs: 11_500, sound: 'tick' }); // 27 s − 15,5 s
  assert.equal(chunks[0].startMs, 15_500);
});

test('Überspringen auf Phasenstart: Start-Ton der neuen Phase ist an Position 0', () => {
  const plan = buildPlan(DEFAULTS.tabata);
  const chunks = planChunks(30_000, plan.total, soundEvents(plan));
  assert.deepEqual(chunks[0].events[0], { offsetMs: 0, sound: 'rest' });
});

test('Speicherbedarf: 60-min-Training hat Chunks von max. ~13,3 MB', () => {
  const plan = buildPlan({ prep: 0, work: 60, rest: 0, rounds: 60, cool: 0 });
  const chunks = planChunks(0, plan.total, soundEvents(plan));
  const maxMs = Math.max(...chunks.map((c) => c.endMs - c.startMs));
  const bytes = (maxMs / 1000) * FORMAT.sampleRate * 2;
  assert.ok(bytes < 14e6, `${(bytes / 1e6).toFixed(1)} MB`);
});

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
process.exit(failed ? 1 : 0);
