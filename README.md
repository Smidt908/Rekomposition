# Rekomposition

Eine kleine App, die deine Körperzusammensetzung verfolgt: Du trägst Gewicht, Taille
und Hals ein, sie rechnet den Körperfettanteil nach der Navy-Methode aus und zeigt den
Verlauf als Diagramm.

Der Leitgedanke: Nicht leichter werden ist das Ziel, sondern Fett gegen den Erhalt der
Muskeln tauschen. Deshalb steht Körperfett groß im Vordergrund und nicht das Gewicht.

## Die vier Seiten

Oben wechselst du über die Reiter:

| Reiter | Inhalt |
|---|---|
| **Messen** | Neue Messung eintragen, letzte Ablesung, alle Messungen |
| **Fortschritt** | Weg zum Ziel, Verlaufsdiagramm |
| **Wissen** | Körperfett-Grenzwerte, wie die Navy-Methode funktioniert und wo sie schwächelt |
| **Einstellungen** | Körpergröße, Zielwerte, CSV-Export/Import, Speicherplatz |

## Aufs Handy bringen

Android lässt sich eine lokale Datei (`file://…` aus dem Download-Ordner) **nicht** auf
den Startbildschirm legen — das ist eine bewusste Sperre von Chrome, kein Fehler. Die
App muss unter einer echten `https://…`-Adresse liegen. Danach installiert Chrome sie
als vollwertige App mit eigenem Icon, im Vollbild und offline nutzbar.

### Schritt 1 — Repository anlegen

1. Auf [github.com](https://github.com) anmelden (oder kostenlos registrieren).
2. Oben rechts auf **+** → **New repository**.
3. Name: `rekomposition`.
4. Sichtbarkeit **Public** — GitHub Pages funktioniert im Gratis-Tarif nur mit
   öffentlichen Repositories. Deshalb steht in diesen Dateien bewusst nichts
   Persönliches; deine Messwerte und Fotos bleiben ohnehin nur auf dem Handy.
5. *„Add a README file"* **nicht** ankreuzen — eine README liegt hier schon.
6. **Create repository**.

### Schritt 2 — Dateien hochladen

Auf der noch leeren Repository-Seite auf **uploading an existing file** klicken. Dann im
Explorer den Ordner `Fitness App` öffnen und ins Browserfenster ziehen:

- die sechs Dateien `index.html`, `styles.css`, `app.js`, `manifest.webmanifest`,
  `sw.js`, `README.md`
- den kompletten Ordner `icons` (Ordner lassen sich mitziehen)

Zwei Dinge dabei:

- **Alles hochladen, nicht nur `index.html`.** Ohne `sw.js` und `manifest.webmanifest`
  erkennt Chrome die App nicht als installierbar — dann gibt es wieder kein Icon auf dem
  Startbildschirm.
- **Den Ordner `.claude` weglassen.** Er gehört zum Editor, nicht zur App. In Windows ist
  er normalerweise ausgeblendet, du wirst ihn also gar nicht erst sehen.

Unten dann auf **Commit changes**.

### Schritt 3 — GitHub Pages einschalten

1. Im Repository oben auf **Settings**, links in der Leiste auf **Pages**.
2. Unter *Build and deployment* → *Source*: **Deploy from a branch**.
3. *Branch*: **main**, Ordner **/ (root)** → **Save**.
4. Ein bis zwei Minuten warten, Seite neu laden. Oben erscheint deine Adresse:
   `https://DEINNAME.github.io/rekomposition/`

Das `https` gibt es bei GitHub automatisch — genau das, was die Installation braucht.

### Schritt 4 — Installieren

Die Adresse auf dem Pixel in Chrome öffnen → Menü (**⋮**) → **App installieren**.
Erscheint der Eintrag nicht, tut es auch *Zum Startbildschirm hinzufügen*. Die App zeigt
außerdem oben rechts einen **Installieren**-Knopf, sobald Chrome sie als installierbar
erkennt.

Danach die Adresse als Lesezeichen behalten: **Nimm nie einen Wegwerf-Link mit
Ablaufdatum.** Deine Messwerte werden pro Web-Adresse gespeichert — ist die Adresse weg,
sind auch die Daten weg. Eine GitHub-Pages-Adresse bleibt, solange das Repository steht.

## Erste Schritte in der App

Die App startet leer. Beim ersten Öffnen:

1. Reiter **Einstellungen** → deine **Körpergröße** eintragen. Ohne sie lässt sich das
   Körperfett nicht berechnen. Dort passt du auch die Zielwerte an (Faustregel: das
   langfristige Taillenziel ist die halbe Körpergröße).
2. Reiter **Messen** → Gewicht, Taille und Hals eintragen. Das Körperfett rechnet sich
   schon beim Tippen vor.

Hast du schon eine CSV mit älteren Messungen, kannst du sie stattdessen unter
*Einstellungen → CSV importieren* einlesen.

## Was die App kann

- **Körperfett** automatisch nach der Navy-Methode, schon während des Tippens.
- **Nur das Gewicht ist Pflicht.** Taille und Hals brauchst du nur alle 2–4 Wochen —
  Messungen ohne Taille sind völlig in Ordnung, sie bekommen dann nur keinen
  Körperfettwert. Der Halsumfang wird aus der letzten Messung fortgeschrieben.
- **Erinnerung**, sobald deine letzte Taillenmessung 28 Tage her ist.
- **Diagramm** für Körperfett, Gewicht, Taille, Fett- und Magermasse mit Ziellinien.
  Beim Gewicht liegt zusätzlich eine geglättete Trendlinie darüber, weil Einzelwerte
  täglich um 1–2 kg schwanken.
- **Zielbalken** für Taille und Körperfett, gemessen von deinem Startwert aus.
- **Zielwerte und Körpergröße** sind änderbar; das Zielgewicht rechnet sich daraus neu.

Grün heißt immer: in die Zielrichtung. Terrakotta: dagegen. Bei der Magermasse ist die
Zielrichtung nach oben, bei allen anderen nach unten.

## Fotos

Das Foto hängt an der Taillenmessung: Das Feld erscheint im Formular erst, sobald du eine
Taille eingetragen hast. So entsteht von selbst der 4-Wochen-Rhythmus.

Beim Speichern wird das Bild auf maximal 1400 Pixel verkleinert und neu als JPEG
kodiert. Das spart Platz (aus einem 4-MB-Handyfoto werden ein paar hundert Kilobyte) und
entfernt nebenbei sämtliche Kameradaten aus der Datei — **inklusive GPS-Position**. Die
Bilder liegen in der IndexedDB dieses Geräts und verlassen es nie.

In der Messungsliste erscheint ein Miniaturbild; ein Tipp darauf öffnet es groß, mit
Knöpfen zum Herunterladen und Löschen.

Für den Vergleich zählt nur eines: **gleiche Pose, gleiches Licht, gleiche Uhrzeit.**
Sonst vergleichst du Schatten statt Bauch.

## Deine Daten

Sie liegen **ausschließlich auf dem Gerät**, in dem Browser, in dem du sie einträgst.
Es gibt bewusst keine Cloud und damit auch keinen Sync zwischen Geräten.

Exportier deshalb regelmäßig eine CSV (*Einstellungen → CSV exportieren*). Sonst sind die
Messungen weg, wenn du das Handy wechselst oder die Browserdaten löschst. Die CSV öffnet
sich direkt in deutschem Excel (Semikolon als Trenner, Komma als Dezimalzeichen) und
lässt sich genauso wieder importieren.

**Die CSV enthält keine Fotos.** Bilder passen nicht in eine Textdatei — die Spalte
`Foto` vermerkt nur, ob es zu einer Messung eines gab. Willst du die Bilder sichern,
lade sie einzeln über die Fotoansicht herunter. Unter *Einstellungen → Speicherplatz*
siehst du, wie viele es sind und wie viel Platz sie belegen.

Dort steht auch, ob Android deine Daten als **dauerhaft** markiert hat. Steht dort
„nein", darf das System sie bei Speichermangel löschen — dann ist der CSV-Export umso
wichtiger. Installierte Apps bekommen diese Zusage in der Regel automatisch.

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | Aufbau der vier Seiten |
| `styles.css` | Gestaltung, hell und dunkel |
| `app.js` | Berechnung, Diagramm, Speicherung, Fotos, CSV |
| `manifest.webmanifest` | Name, Icons, Vollbild — macht sie installierbar |
| `sw.js` | Service Worker: Offline-Betrieb |
| `icons/` | App-Icons (192, 512, maskierbar) |

Kein Framework, keine Abhängigkeiten, kein Build-Schritt. Hochladen genügt.

## Wenn du etwas änderst

Erhöhe die Versionsnummer in `sw.js` (`const CACHE = 'rekomposition-v3'` → `-v4`).
Sonst behalten bereits installierte Geräte die alten Dateien aus ihrem Cache. Die App
lädt sich nach einem Update einmalig selbst neu, sobald die neue Fassung übernimmt.

## Kleingedrucktes

Die Navy-Formel arbeitet nur mit Umfängen und hat gegenüber einer Labormessung (DEXA)
eine Unschärfe von etwa ±3 Prozentpunkten. Als Startwert und vor allem für den Trend ist
das brauchbar — nur der Trend zählt, nicht der einzelne Absolutwert. Die ausführliche
Erklärung dazu steht im Reiter **Wissen**.

Hinterlegt ist die Formel für Männer (aus Hals, Taille und Größe). Die Variante für
Frauen bräuchte zusätzlich den Hüftumfang und ist nicht eingebaut.

Die Richtwerte im Reiter *Wissen* stammen aus der Sportwissenschaft und sind zur
Orientierung gedacht, nicht als medizinische Beratung.
