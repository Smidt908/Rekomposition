# Mones Mümmelküche

Ein Kochbuch als App: Rezepte per Foto oder Link aufnehmen, nach Kategorien
sortiert wiederfinden, bewerten, mit Notizen versehen — und beim Kochen
automatisch auf die gewünschte Portionszahl umrechnen lassen.

Alles läuft im Browser. Die Rezepte bleiben auf dem Gerät und werden nirgends
hochgeladen.

---

## Was die App kann

**Rezepte aufnehmen — auf vier Wegen**

- **Fotos oder Screenshots.** Die Seite aus dem Kochbuch abfotografieren —
  **mehrere Bilder gehen**, sie werden zu einem Rezept zusammengesetzt (sortiert
  nach Dateinamen, also in Aufnahmereihenfolge). Das Ergebnis kommt zum Prüfen
  ins Formular. Zwei Verfahren, umschaltbar unter *Einstellungen*:
  - **Mit Claude-Schlüssel** (empfohlen): liest **auch Handschrift**, schiefe
    Fotos und Seiten im Schatten, erkennt Zutatengruppen und die Kategorie von
    allein. Kostet ~5 US-Cent pro Rezept, braucht Netz. Unsichere Stellen
    markiert Claude mit einem `?`.
  - **Ohne Schlüssel**: Texterkennung auf dem Gerät, kostenlos und offline —
    aber **Handschrift kann sie grundsätzlich nicht**.
- **Link.** Adresse einer Rezeptseite einfügen — **samt Zutatengruppen** („Für
  den Boden:", „Für die Füllung:"). Der Ablauf ist immer derselbe, egal ob ein
  Schlüssel hinterlegt ist:
  1. **Zuerst kostenlos.** Alle Weiterleitungsdienste werden gleichzeitig
     angerannt, der erste Treffer gewinnt. Klappt es, sind es die Angaben der
     Seite selbst — gratis **und** genauer als jedes Ablesen. Claude wird gar
     nicht erst gefragt.
  2. **Nur wenn das scheitert** und ein Schlüssel da ist, ruft Claude die Seite
     serverseitig ab (~9 US-Cent). Ohne Schlüssel kommt stattdessen der Hinweis
     auf „Rezepttext einfügen".
- **Rezepttext einfügen.** Auf der Rezeptseite alles markieren (Strg+A),
  kopieren, einfügen. Die App sucht sich Titel, Portionen, Zutaten und Schritte
  selbst heraus und wirft Navigation, Sternchen und Kommentare weg. Dieser Weg
  braucht **keine fremden Dienste** und funktioniert deshalb immer — die
  Rückfallebene, wenn der Link klemmt.
- **Von Hand.** Für Omas Rezepte, die nirgends stehen.

**Portionen umrechnen.** Beim Anlegen wird eingetragen, für wie viele das
Rezept reicht. Beim Kochen stellt man die gewünschte Zahl ein, und alle Mengen
rechnen sich mit. Die App rundet dabei auf küchentaugliche Werte und wechselt
die Einheit, wenn es sich besser liest:

| im Rezept (4 Portionen) | für 6 Portionen | für 1 Portion |
| ----------------------- | --------------- | ------------- |
| `1 kg Kürbis`           | `1,5 kg`        | `250 g`       |
| `800 ml Gemüsebrühe`    | `1,2 l`         | `200 ml`      |
| `2 Zehen Knoblauch`     | `3 Zehen`       | `½ Zehe`      |
| `1/2 TL Salz`           | `¾ TL`          | `⅛ TL`        |

Zeilen ohne Menge (`Salz und Pfeffer`) bleiben unangetastet. Eine Zeile mit
Doppelpunkt am Ende (`Für den Teig:`) wird zur Zwischenüberschrift und nicht
mitgerechnet — so bleibt beim Umrechnen erkennbar, welche Zutat zum Boden und
welche zur Füllung gehört.

**Kategorien.** Die App ordnet jedes Rezept selbst ein — von Frühstück über
Suppe, Eintopf, Braten und Auflauf bis Kuchen, Torte und Eingemachtes
(24 Kategorien). In der Leiste links erscheinen nur die Kategorien, in denen
auch etwas steht; innerhalb jeder Kategorie sind die Rezepte alphabetisch
sortiert. Die Zuordnung lässt sich beim Anlegen und später jederzeit ändern.

**Bewerten und notieren.** Ein bis fünf Sterne, von *Nicht unser Geschmack* bis
*Super lecker!* — noch einmal auf denselben Stern tippen nimmt die Bewertung
zurück. Das Notizfeld speichert von allein.

**Suchen.** Über Titel, Zutaten und Notizen.

**Teilen aus Chrome.** Auf dem Handy in Chrome auf „Teilen" tippen und die
Mümmelküche auswählen: Der Link landet direkt im Import.

---

## Einrichten auf GitHub Pages

Damit Android die App wirklich auf den Startbildschirm legt, braucht sie eine
echte `https://`-Adresse. Aus einer lokalen Datei (`file://`) heraus geht das
nicht.

1. Auf GitHub ein **öffentliches** Repository anlegen (Pages ist im Gratis-Tarif
   nur für öffentliche Repos verfügbar).
2. **Den ganzen Ordner hochladen — alles, auch `ocr/`.** Der wiegt 10 MB und
   sieht nach Ballast aus, ist aber die Texterkennung: Ohne ihn startet die App
   zwar, aber Foto- und Screenshot-Import sind tot. `git add .` erwischt alles;
   die versteckten `.nojekyll` und `.gitattributes` gehören ebenfalls dazu.

   ```bash
   git init
   git add .
   git commit -m "Mones Mümmelküche"
   git branch -M main
   git remote add origin https://github.com/<name>/<repo>.git
   git push -u origin main
   ```

   Gegenprobe vor dem Hochladen — hier müssen **13 Dateien** stehen, darunter
   die vier aus `ocr/`:

   ```bash
   git status --short
   ```

3. Im Repository unter **Settings → Pages** als Quelle `main` / `/ (root)`
   wählen.
4. Nach ein bis zwei Minuten ist die App unter
   `https://<name>.github.io/<repo>/` erreichbar.
5. Gegenprobe, dass die Texterkennung wirklich mitgekommen ist: die Adresse
   `https://<name>.github.io/<repo>/ocr/tesseract.min.js` im Browser aufrufen.
   Kommt JavaScript-Text, ist alles da. Kommt „404", fehlt der Ordner — dann
   scheitert später der Foto-Import mit „Die Texterkennung konnte nicht geladen
   werden".
6. Die Seite in Chrome öffnen → Menü → **Zum Startbildschirm hinzufügen**.

Alle Pfade im Code sind relativ (`./`), die App läuft deshalb auch im
Unterordner.

> **Das Repository ist öffentlich lesbar.** Der Code steht darin — die Rezepte
> nicht. Die liegen ausschließlich auf dem Gerät.

---

## Wo die Rezepte liegen

In der **IndexedDB des Browsers**, also auf dem Gerät. Kein Konto, keine Cloud,
kein Server. Das hat zwei Folgen:

- **Handy und Tablet haben getrennte Bestände.** Wer beide nutzt, tauscht über
  *Sicherung speichern* / *Sicherung laden* aus.
- **Die Sicherung ist die einzige Sicherung.** Wird der Browser-Speicher
  gelöscht („Browserdaten löschen", App deinstallieren), sind die Rezepte weg.
  Die App bittet Android zwar, den Speicher zu schützen (`storage.persist()`),
  aber verlassen sollte man sich darauf nicht.

*Sicherung speichern* schreibt eine JSON-Datei mit allen Rezepten samt Bildern.
Auf dem Handy öffnet sich dabei der Teilen-Dialog, die Datei kann also mit einem
Tipp nach Google Drive oder in eine Mail — dort liegt sie sicherer als im
Download-Ordner desselben Geräts. *Sicherung laden* fügt sie wieder ein:
Bekanntes wird aufgefrischt, Neues kommt dazu — es geht nichts verloren.

**Die App erinnert von selbst.** Über der Rezeptliste erscheint ein Hinweis,
sobald es etwas zu sichern gibt: beim allerersten Rezept, danach ab drei
Änderungen oder wenn die letzte Sicherung zwei Wochen her ist. Hat sich seit der
Sicherung nichts getan, bleibt er still. „Später" blendet ihn bis zum nächsten
Öffnen aus.

> **Warum nicht automatisch?** Weil kein Browser das darf. Eine Webseite kann
> nicht ungefragt Dateien aufs Gerät schreiben — das ist Absicht, kein Mangel.
> Die *File System Access API*, mit der eine App nach einmaliger Auswahl still
> in dieselbe Datei schreiben könnte, unterstützt **kein einziger mobiler
> Browser** (Chrome für Android, Safari iOS, Firefox mobile: alle nein). Und der
> Teilen-Dialog verlangt zwingend einen Fingertipp. Deshalb erinnert die App,
> statt es heimlich zu versuchen.

---

## Was nach außen geht

Die App kommt weitgehend ohne Netz aus. Nach außen gehen nur:

- **Foto-Import, wenn ein Claude-Schlüssel hinterlegt ist.** Die Bilder gehen an
  `api.anthropic.com` und werden dort gelesen. Ohne Schlüssel bleibt alles auf
  dem Gerät (Ordner `ocr/`).
- **Link-Import.** Mit Schlüssel: Nur die Rezept-Adresse geht an
  `api.anthropic.com`, Claude ruft die Seite dort selbst ab (`web_fetch`, kostet
  nichts extra — nur die gelesenen Token). Ohne Schlüssel: Die Adresse geht an
  einen Weiterleitungsdienst (`cors.lol`, ersatzweise `allorigins.win`,
  `codetabs.com`), weil der Browser fremde Seiten nicht selbst lesen darf.
- **Sonst nichts.** Rezepte, Notizen und Bewertungen verlassen das Gerät nie.
  Texteinfügen, Von-Hand-Eintragen und alles Übrige funktionieren offline.

### Der Claude-Schlüssel

Einrichten unter *Einstellungen*:

1. Auf [console.anthropic.com](https://console.anthropic.com) ein Konto anlegen.
2. Unter *Billing* Guthaben aufladen (ab ca. 5 $).
3. Unter *API keys* einen Schlüssel erzeugen und in der App einfügen.

**Bezahlt wird über dieses Konto — nicht über das Gerät, auf dem gekocht wird.**
Wer kocht, merkt davon nichts. Die App zeigt nach jedem Import die tatsächlichen
Kosten an (aus den Verbrauchsdaten der API, nicht geschätzt) und summiert sie
mit.

Grobe Hausnummer bei Opus 4.8: **~5 US-Cent pro Rezept** mit einem Foto, ~10
Cent mit drei. 100 Rezepte kosten also etwa 5 $.

> ⚠️ **Der Schlüssel liegt im `localStorage` des Browsers.** Er steht *nicht* im
> Repository — er wird zur Laufzeit eingegeben. Aber wer das Gerät in die Hand
> bekommt und sich auskennt, kann ihn auslesen. Der direkte Aufruf aus dem
> Browser verlangt deshalb die Kopfzeile
> `anthropic-dangerous-direct-browser-access` — der Name ist die Warnung. Für ein
> Familien-Kochbuch ist das vertretbar; setz im Konto ein **monatliches
> Ausgabenlimit**, dann ist der Schaden begrenzt. Der Schlüssel lässt sich
> jederzeit sperren und neu erzeugen.

---

## Aufbau

| Datei                  | Inhalt                                                     |
| ---------------------- | ---------------------------------------------------------- |
| `index.html`           | Gerüst aller vier Ansichten                                 |
| `styles.css`           | Tischdecken-Design; ab 820 px feste Leiste, darunter Menü   |
| `app.js`               | Kategorien, Mengenrechner, Speicher, Foto- und Link-Import  |
| `sw.js`                | Service Worker für Offline-Betrieb                          |
| `manifest.webmanifest` | App-Angaben, Icons, Teilen-Ziel                             |
| `ocr/`                 | Tesseract 7 + deutsche Sprachdatei (~10 MB)                 |
| `icons/`               | App-Icons                                                   |

### Beim Ändern zu beachten

**Die Zahl in `sw.js` (`const CACHE`) hochzählen.** Sonst behalten bereits
installierte Geräte die alten Dateien.

Der Ordner `ocr/` ist ein unverändertes Fremdpaket
([Tesseract.js](https://github.com/naptha/tesseract.js), Apache 2.0) und wird
absichtlich nicht beim Einrichten vorgeladen — 10 MB wären zu viel. Er wandert
beim ersten Foto-Import in den Cache und ist danach offline verfügbar.

---

## Die Grenzen, ehrlich gesagt

- **Prüfen muss man immer.** Egal ob Claude oder Texterkennung: Nach jedem
  Foto-Import kommt das Formular. Das ist Bestandteil des Ablaufs, kein
  Notbehelf. **Vor allem die Mengen ansehen.** Claude markiert Stellen, bei
  denen es sich unsicher war, mit einem `?`.
- **Die Texterkennung ohne Schlüssel kann keine Handschrift.** Das ist keine
  Schwäche, die sich wegtunen ließe: Tesseract ist auf Druckschrift trainiert.
  Bei sauberen Vorlagen liest es fast fehlerfrei (`1 l` wird gern zu `11`), bei
  Handschrift kommt Unsinn heraus. Wer handgeschriebene Rezepte aufnehmen will,
  braucht den Claude-Schlüssel.
- **Der Link-Import ohne Schlüssel ist die wackeligste Stelle.** Nicht wegen der
  Rezeptseiten — die geben ihre Rezepte sauber heraus. Sondern wegen der
  Weiterleitungsdienste: Der Browser darf fremde Seiten nicht selbst lesen, also
  muss ein fremder Dienst dazwischen, und die sind kostenlos, launisch und
  sterblich. Am 17.07.2026 wurden **acht** bekannte Dienste an derselben Adresse
  geprüft — **alle acht fielen aus** (429, 522, 403, 400). Das ist kein Pech
  mehr, sondern der Konstruktionsfehler dieses Weges.
  **Deshalb ruft Claude die Seite ab, sobald ein Schlüssel hinterlegt ist** —
  serverseitig, ohne CORS, ohne fremden Dienst. Die alte Kette (`BOTEN` in
  `app.js`) bleibt nur als kostenloser Versuch für den Fall ohne Schlüssel.
  Zweite Rückfallebene bleibt „Rezepttext einfügen": gleiches Ergebnis, ohne
  jeden fremden Dienst.
- **Die Kategorie ist geraten.** Nach Schlagwörtern im Titel, hilfsweise in den
  Zutaten. „Kürbissuppe" trifft sie, bei „Mones Sonntagsessen" landet sie bei
  *Sonstiges*. Ändern ist ein Fingertipp.
