# MoorTimer aufs iPhone bringen – Schritt für Schritt (Windows)

Du brauchst: einen Windows-PC mit Internet, dein iPhone mit Safari und etwa 20 Minuten.
Die App wird kostenlos über **GitHub Pages** veröffentlicht. Das ist ein Dienst, der
Webseiten aus einem GitHub-Ordner („Repository“) ins Internet stellt. Danach installierst
du die Seite auf dem iPhone wie eine App.

> Hinweis: Das Repository muss **öffentlich** sein (bei kostenlosen Konten verlangt GitHub
> Pages das). Jeder, der die Adresse kennt, kann den Timer öffnen. Deine Vorlagen und
> Einstellungen bleiben trotzdem nur auf deinem iPhone, sie werden nie hochgeladen.

---

## 1. GitHub-Konto anlegen

1. Öffne im Browser **https://github.com/signup**.
2. Gib E-Mail-Adresse, ein Passwort und einen **Benutzernamen** ein.
   Merke dir den Benutzernamen, er steht später in der Adresse deiner App
   (Beispiel: Benutzername `tmoor` → `https://tmoor.github.io/moor-timer/`).
3. Löse das kurze Rätsel, bestätige den Code aus der E-Mail. Fertig.

## 2. Neues Repository „moor-timer“ anlegen

1. Oben rechts auf **+** klicken → **New repository**.
2. **Repository name:** `moor-timer` (genau so, klein geschrieben).
3. **Public** auswählen.
4. Sonst nichts ankreuzen. Unten auf **Create repository** klicken.

## 3. Dateien hochladen

Lade den **Inhalt** des Ordners `moor-timer` hoch, nicht den Ordner selbst. Am Ende
müssen `index.html`, `app.js`, `service-worker.js` usw. **direkt** im Repository liegen,
dazu die Unterordner `js` und `icons`.

### Weg A: über die Weboberfläche (empfohlen, ohne Zusatzprogramm)

1. Entpacke die ZIP-Datei, falls du sie als ZIP bekommen hast (Rechtsklick → **Alle extrahieren**).
2. Öffne den entpackten Ordner `moor-timer` im Windows-Explorer.
3. In deinem neuen Repository auf GitHub: Link **uploading an existing file** anklicken
   (oder **Add file → Upload files**).
4. Im Explorer alles markieren (**Strg + A**) und mit der Maus in das Browserfenster ziehen.
   Ordner wie `js` und `icons` werden dabei samt Inhalt übernommen.
   *Wichtig:* Ziehe die Dateien hinein. Über „choose your files“ lassen sich keine Ordner auswählen.
5. Warte, bis alle Dateien in der Liste stehen. Unten auf **Commit changes** klicken.
6. Prüfe: Auf der Startseite des Repositorys siehst du `index.html` und die Ordner `icons`, `js`.

### Weg B: mit Git (für später, wenn du öfter Updates machst)

1. Installiere **Git für Windows** von https://git-scm.com/download/win (alle Voreinstellungen lassen).
2. Öffne im Ordner `moor-timer` einen Rechtsklick → **Open Git Bash here**.
3. Tippe nacheinander (statt `DEINNAME` deinen GitHub-Benutzernamen):

   ```bash
   git init
   git add .
   git commit -m "MoorTimer 1.0"
   git branch -M main
   git remote add origin https://github.com/DEINNAME/moor-timer.git
   git push -u origin main
   ```

   Beim ersten `git push` öffnet sich ein Anmeldefenster für GitHub. Melde dich dort an.
4. Spätere Updates: `git add .` → `git commit -m "Update"` → `git push`.

## 4. GitHub Pages einschalten

1. Im Repository oben auf **Settings** klicken.
2. Links im Menü **Pages** wählen.
3. Bei **Build and deployment → Source** die Option **Deploy from a branch** wählen.
4. Bei **Branch** die Auswahl **main** und den Ordner **/ (root)** einstellen, dann **Save** klicken.
5. Nach 1 bis 3 Minuten erscheint oben auf dieser Seite:
   „Your site is live at **https://DEINNAME.github.io/moor-timer/**“.
   Lade die Seite neu, falls die Meldung noch nicht da ist.
6. Öffne die Adresse zur Probe am PC. Du solltest den dunklen Timer mit den Reitern unten sehen.

## 5. Auf dem iPhone installieren

1. Öffne die Adresse `https://DEINNAME.github.io/moor-timer/` in **Safari**.
   Andere Browser (Chrome usw.) können auf dem iPhone nicht „Zum Home-Bildschirm“ als App installieren.
2. Tippe unten auf **Teilen** (Quadrat mit Pfeil nach oben).
3. Scrolle in der Liste und tippe auf **Zum Home-Bildschirm**.
4. Der Name „MoorTimer“ ist vorausgefüllt. Tippe auf **Hinzufügen**.
5. Auf dem Home-Bildschirm erscheint das grüne Stoppuhr-Icon.

## 6. Einmal online starten, danach geht es offline

1. Starte **MoorTimer** einmal über das neue Icon, solange das iPhone **Internet** hat.
   Dabei werden alle Dateien auf dem iPhone gespeichert.
2. Warte etwa 5 Sekunden und schließe die App wieder.
3. Ab jetzt läuft die App auch im **Flugmodus**. Probier es einmal aus.

## 7. Updates veröffentlichen

Wenn du später etwas an den Dateien änderst:

1. Öffne `service-worker.js` und erhöhe in der Zeile `const VERSION = '1.0.0';`
   die Nummer, z. B. auf `'1.0.1'`. **Ohne diesen Schritt bekommt das iPhone die Änderung nicht**,
   weil es sonst weiter die gespeicherten Dateien benutzt.
2. Lade die geänderten Dateien **und** `service-worker.js` erneut hoch
   (Weg A: wieder **Add file → Upload files**, gleiche Namen überschreiben die alten; Weg B: `git push`).
3. Warte 1 bis 2 Minuten, bis GitHub Pages aktualisiert hat.
4. Öffne die App auf dem iPhone mit Internet. Sie lädt im Hintergrund die neue Version und
   startet einmal kurz neu. Läuft gerade ein Training, wartet sie damit bis zum Ende.
   Falls nichts passiert: App schließen (im App-Umschalter nach oben wischen) und neu öffnen.

## Häufige Probleme

| Problem | Lösung |
|---|---|
| Seite zeigt „404“ | 2–3 Minuten warten. Prüfen, ob `index.html` direkt im Repository liegt und nicht in einem Unterordner. |
| Icon ist nur ein Screenshot / grau | Seite in Safari einmal neu laden und erneut „Zum Home-Bildschirm“ wählen. |
| Keine Töne | Lautstärke am iPhone hochdrehen; unter **MEHR → TÖNE TESTEN** prüfen; „Töne“ eingeschaltet? |
| Nach dem Update alte Version | `VERSION` in `service-worker.js` erhöht? App komplett schließen und neu öffnen. |

Die Datei `package.json` und die Ordner `tests` und `tools` braucht die App nicht. Sie stören aber
auch nicht und können mit hochgeladen werden. Sie enthalten die Tests und das Icon-Skript
(`node tests/run-tests.mjs`, `node tools/make-icons.mjs`).
