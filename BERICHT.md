# MoorTimer 1.0 – Abschlussbericht

## Aufbau

| Datei | Aufgabe |
|---|---|
| `js/plan.js` | Phasenplan als Segmentliste, Position im Plan, Signal-Zeitpunkte (rein, ohne DOM) |
| `js/engine.js` | Laufendes Training: Stand nur aus Zeitstempeln (Basis + jetzt − Anker), Pause/Weiter/Überspringen |
| `js/sounds.js` | Ton-Synthese, WAV-Encoder, Aufteilung in Audio-Chunks |
| `js/player.js` | Abspielen über zwei `<audio>`-Elemente, Chunk-Wechsel, Drift-Korrektur |
| `js/storage.js` | localStorage, fehlertolerant (kaputte Daten → Standardwerte; ohne localStorage → im Speicher) |
| `js/stopwatch.js`, `js/format.js`, `js/wheel.js`, `js/ui.js`, `js/icons.js` | Stoppuhr, Zeitformate, Scroll-Rad, Dialoge, Icons |
| `app.js` | Oberfläche und Zusammenspiel |
| `service-worker.js` | Cache-First mit Versionsnummer |
| `tools/make-icons.mjs` | Erzeugt die PNG-Icons (Node, nur eingebaute Module, eigener PNG-Encoder) |
| `tests/run-tests.mjs` | 33 Tests (Phasenplan, Laufzeit, Stoppuhr, WAV, Chunks): `node tests/run-tests.mjs` |

## Getroffene Annahmen und Entscheidungen

- **Name:** „MoorTimer“ (statt „More Timer“), Ordner und Repository `moor-timer`.
- **Ablauf:** Die Vorbereitung hat keinen Start-Ton, denn du hast gerade erst auf START getippt.
  Aktivität startet mit hellem Doppelton, Pause und Abklingzeit mit dem tieferen Ton.
  Vor **jedem** Phasenende kommen die Ticks 3-2-1, am Schluss der Gong. Ein Tick, der auf den
  Phasenbeginn fallen würde (Phasen ≤ 3 s), entfällt.
- **Nullwerte:** Runden = 0 → nur Vorbereitung und Abklingzeit. Pause = 0 → die Aktivitäten
  folgen direkt aufeinander, jede Runde mit eigenem Start-Ton. Alles 0 → Hinweis „ALLE WERTE SIND 0“.
- **Grenzen:** Zeiten 0:00–99:59, Runden 0–99.
- **Audioformat:** Mono, **16 Bit, 11,025 kHz** (22 KB/s), ein Mittelweg aus den beiden
  Vorschlägen. Bei 8 Bit rauscht der ausklingende Gong hörbar. Trainings bis 15 Minuten
  sind eine einzige Datei. Längere werden in Chunks von ca. 10 Minuten (≈ 13 MB) geteilt,
  deren Grenzen nie in einen Ton fallen. Höchstens zwei Chunks liegen gleichzeitig im Speicher.
  Der nächste wird im zweiten Element vorgeladen, abgespielte werden freigegeben.
- **Lautstärke:** iOS ignoriert `audio.volume`. Der Regler wird deshalb direkt in die erzeugte
  Datei eingerechnet und gilt ab dem nächsten Start, Weiter oder Überspringen.
- **Wahrheit = Uhr der App.** Die Audio-Position wird ihr nachgeführt: jede Sekunde im
  Vordergrund, beim Start der Wiedergabe und beim Zurückkehren aus dem Hintergrund
  (Abweichung > 150 ms → `currentTime` korrigieren, falscher Chunk → richtigen laden).
- **Weiter nach Pause / Überspringen:** Für den Restplan wird eine neue Audiodatei erzeugt
  und ab Position 0 gestartet. Nach dem Überspringen hörst du sofort den Start-Ton der neuen Phase.
- **Vorlagen:** Die Liste unter VORLAGEN hat eine feste Reihenfolge, die du mit den Pfeilen änderst.
  Darüber zeigt **ZULETZT BENUTZT** die 3 zuletzt gestarteten. So widersprechen sich „zuletzt
  benutzt oben“ und „Reihenfolge änderbar“ nicht. Löschen geht über den ⋯-Button
  (Swipe wurde weggelassen, weil er auf iOS leicht mit dem Scrollen kollidiert).
- **SPEICHERN vs. NEUEN TIMER HINZUFÜGEN:** SPEICHERN überschreibt die gerade bearbeitete
  Vorlage (oder legt die erste an). NEUEN TIMER HINZUFÜGEN legt immer eine neue Vorlage an.
  ABBRUCH setzt den Editor auf die Standardwerte zurück (mit Rückfrage).
- **Neustart während des Trainings:** Wird die App von iOS beendet, läuft die Zeit trotzdem
  korrekt weiter (Zeitstempel in localStorage). Beim Öffnen erscheint „TIPPEN FÜR SIGNALE“,
  weil iOS Ton erst nach einem Tipp erlaubt.
- **Updates:** Ein neuer Service Worker lädt die App automatisch neu, aber nie während eines Trainings.
- **Schrift:** Auf dem iPhone wird „Helvetica Neue Condensed Black“ verwendet (vorinstalliert).
  Fehlt eine schmale Schrift, verkleinert die App Phasenname und Restzeit automatisch, damit nichts abgeschnitten wird.

## Bekannte Einschränkungen

- **Keine Mitteilungen auf dem Sperrbildschirm.** Web-Apps können auf iOS keine zeitgesteuerten
  Benachrichtigungen planen. Die Signale kommen ausschließlich aus der laufenden Audiodatei.
- **Keine Vibration.** `navigator.vibrate` gibt es auf iOS nicht. Stattdessen blitzt der
  Bildschirm beim Phasenwechsel weiß auf (nur sichtbar, wenn er an ist).
- **Lautlos-Schalter:** Normale `<audio>`-Wiedergabe ignoriert ihn in der Regel. Apple
  garantiert das aber nicht. Daher bitte selbst testen (siehe Checkliste).
- **Andere Musik:** Startet ein Training mit Ton, pausiert iOS laufende Musik aus anderen Apps
  (Spotify usw.). Mischen ist für Web-Apps im Hintergrund nicht zuverlässig möglich.
  Wer Musik hören will, schaltet unter MEHR die Töne aus. Dann gibt es aber keine Signale bei gesperrtem Bildschirm.
- **Sehr lange Trainings (> 15 min):** Der Wechsel zum nächsten 10-Minuten-Chunk braucht
  einen kurzen JavaScript-Moment. Safari erlaubt das bei laufender Wiedergabe normalerweise
  auch im Hintergrund. Falls iOS die App dabei einfriert, verstummen die Signale nach dem
  aktuellen Chunk. Beim Entsperren korrigiert sich alles sofort. Am Wechsel kann eine Lücke
  von einigen Millisekunden Stille entstehen, die nicht hörbar ist, weil dort nie ein Ton liegt.
- **Wegwischen beendet alles:** Wird die App im App-Umschalter weggewischt, stoppt der Ton.
  Die Zeit selbst stimmt beim nächsten Öffnen trotzdem.
- **Bildschirm anlassen** braucht iOS 16.4+ (Wake Lock API). Im Stromsparmodus kann iOS das ignorieren.
- **Lock-Screen-Anzeige:** Titel wie „MoorTimer – AKTIVITÄT · Runde 3/10“ wird nur aktualisiert,
  während die App im Vordergrund ist. Gesperrt bleibt der Titel der Phase stehen, in der gesperrt wurde.
- **Getestet** wurde automatisiert in Chromium mit iPhone-Bildschirmgröße (33 Unit-Tests,
  36 Browser-Prüfungen inkl. Offline-Start, Drift-Korrektur, Neustart, kaputte Daten).
  Ein echtes iPhone stand nicht zur Verfügung. Die folgende Checkliste deckt den Rest ab.

## Checkliste für deinen Test auf dem iPhone

**Installation**
- [ ] Safari → Teilen → Zum Home-Bildschirm. Das Icon ist eine grüne Stoppuhr auf Dunkelgrau.
- [ ] App startet ohne Browserleiste. Die Uhrzeit oben ist lesbar, nichts liegt unter der Notch oder dem Home-Balken.
- [ ] Einmal online öffnen, dann Flugmodus an, App schließen und wieder öffnen. Sie startet trotzdem.

**Bedienung**
- [ ] Werte per Scroll-Rad ändern. Kein Zoomen bei Doppeltipp oder Zwei-Finger-Geste, kein „Gummiband“ beim Ziehen.
- [ ] Vorlage speichern, umbenennen, duplizieren, verschieben, löschen. App schließen und öffnen: Alles ist noch da.
- [ ] Stoppuhr: Start, Runde, Stopp, Reset. Die Zeit läuft nach App-Wechsel korrekt weiter.

**Töne und Hintergrund (das Wichtigste)**
- [ ] MEHR → TÖNE TESTEN: Tick, Doppelton, tiefer Ton und Gong sind hörbar.
- [ ] TABATA starten. Nach 7 s kommen 3 Ticks, bei 10 s der Doppelton. Die Anzeige stimmt mit den Tönen überein.
- [ ] **Bildschirm sperren** (Seitentaste) während des Tabata. Alle Ticks, Wechsel-Töne und am Ende der Gong sind weiter zu hören.
- [ ] Gleicher Test mit **Lautlos-Schalter auf lautlos**. Hörst du die Signale? (Wenn nicht: Schalter beim Training auf laut.)
- [ ] Auf dem Sperrbildschirm erscheint „MoorTimer – …“ mit Pause/Play. Pause dort tippen, entsperren: Der Timer steht. Weiter: Ton und Anzeige laufen synchron weiter.
- [ ] Während des Trainings in eine andere App wechseln, 1 Minute warten, zurück: Die Restzeit stimmt sofort, der nächste Ton kommt pünktlich.
- [ ] Pause → 30 s warten → Weiter: Die Töne passen danach weiter exakt zur Anzeige.
- [ ] Überspringen: Der Bildschirm wechselt Farbe und blitzt, der Start-Ton der neuen Phase kommt sofort.
- [ ] STOPP fragt nach. Nach „BEENDEN“ ist Ruhe.
- [ ] Bildschirm bleibt während des Trainings an (Einstellung „Bildschirm anlassen“).

**Langes Training**
- [ ] RUNDEN mit Standardwerten (39:40) starten, Bildschirm sperren und mindestens bis über die
      10-Minuten-Marke hinaus warten. Die Signale gehen nach Minute 10 weiter.
      Das ist der Chunk-Wechsel im Hintergrund, also der kritischste Punkt.
