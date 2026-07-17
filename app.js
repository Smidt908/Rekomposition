/* ══════════════════════════════════════════════════════
   Mones Mümmelküche

   Alles läuft im Browser, alle Rezepte bleiben auf dem
   Gerät (IndexedDB). Nach außen geht nur zweierlei:
   die Texterkennung lädt einmalig ihre Sprachdateien,
   und beim Link-Import wird die Rezeptseite über einen
   Weiterleitungsdienst geholt.
   ══════════════════════════════════════════════════════ */
'use strict';

/** Sonderzeichen für den Einbau in ein Muster entschärfen. */
const fluchten = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ── Kategorien ─────────────────────────────────────────
   Reihenfolge = Reihenfolge in der Leiste (vom Frühstück
   bis zum Eingemachten). Bei Gleichstand gewinnt die
   frühere Kategorie — deshalb steht "Pizza" vor "Kuchen",
   damit der Zwiebelkuchen zur Pizza wandert.
   ────────────────────────────────────────────────────── */
const KATEGORIEN = [
  { key: 'fruehstueck', name: 'Frühstück', bild: '🥐', worte: [
    'frühstück', 'müsli', 'granola', 'porridge', 'haferbrei', 'pancake', 'pfannkuchen',
    'waffel', 'rührei', 'omelett', 'spiegelei', 'brotaufstrich', 'overnight oats', 'croissant'] },

  { key: 'vorspeise', name: 'Vorspeise', bild: '🫒', worte: [
    'vorspeise', 'antipasti', 'bruschetta', 'carpaccio', 'tapas', 'crostini', 'amuse'] },

  { key: 'salat', name: 'Salat', bild: '🥗', worte: [
    'salat', 'dressing', 'vinaigrette', 'rohkost', 'blattsalat', 'krautsalat',
    'nudelsalat', 'kartoffelsalat', 'caesar', 'coleslaw', 'tabouleh'] },

  { key: 'suppe', name: 'Suppe', bild: '🍜', worte: [
    'suppe', 'brühe', 'cremesuppe', 'bouillon', 'consommé', 'velouté', 'gazpacho', 'ramen'] },

  { key: 'eintopf', name: 'Eintopf', bild: '🥘', worte: [
    'eintopf', 'chili con carne', 'chili sin carne', 'ragout', 'linsentopf',
    'bohneneintopf', 'schmortopf', 'cassoulet', 'gumbo', 'curry'] },

  { key: 'auflauf', name: 'Auflauf', bild: '🧀', worte: [
    'auflauf', 'gratin', 'überbacken', 'lasagne', 'moussaka', 'auflaufform',
    'ofengericht', 'shepherd', 'cannelloni'] },

  { key: 'braten', name: 'Braten', bild: '🍖', worte: [
    'braten', 'rollbraten', 'sauerbraten', 'krustenbraten', 'schmoren', 'niedertemperatur',
    'gans', 'ente', 'entenbrust', 'lammkeule', 'lammkarree', 'ochsenbacke', 'kalbsbraten',
    'wildschwein', 'reh', 'hirsch', 'spanferkel'] },

  { key: 'fleisch', name: 'Fleisch & Geflügel', bild: '🍗', worte: [
    'schnitzel', 'steak', 'hackfleisch', 'frikadelle', 'bulette', 'hähnchen', 'hühnchen',
    'huhn', 'pute', 'putenbrust', 'kotelett', 'gulasch', 'bratwurst', 'wurst', 'spareribs',
    'geschnetzeltes', 'roulade', 'medaillon', 'schweinefilet', 'rinderfilet', 'burger',
    'gyros', 'döner', 'schaschlik'] },

  { key: 'fisch', name: 'Fisch & Meeresfrüchte', bild: '🐟', worte: [
    'fisch', 'lachs', 'forelle', 'kabeljau', 'dorade', 'thunfisch', 'garnele', 'scampi',
    'muschel', 'tintenfisch', 'seelachs', 'zander', 'hering', 'matjes', 'shrimps',
    'jakobsmuschel', 'wolfsbarsch', 'pangasius', 'sardine'] },

  { key: 'pasta', name: 'Pasta & Nudeln', bild: '🍝', worte: [
    'pasta', 'nudel', 'spaghetti', 'penne', 'tagliatelle', 'farfalle', 'rigatoni',
    'gnocchi', 'ravioli', 'tortellini', 'carbonara', 'bolognese', 'linguine',
    'lasagneplatten', 'maultasche', 'ramen-nudeln'] },

  { key: 'reis', name: 'Reis & Risotto', bild: '🍚', worte: [
    'risotto', 'reis', 'paella', 'pilaw', 'milchreis', 'sushi', 'arborio', 'basmati',
    'jasminreis', 'jambalaya', 'bibimbap'] },

  { key: 'pizza', name: 'Pizza & Flammkuchen', bild: '🍕', worte: [
    'pizza', 'pizzateig', 'flammkuchen', 'calzone', 'focaccia', 'zwiebelkuchen'] },

  { key: 'gemuese', name: 'Gemüse & Vegetarisch', bild: '🥦', worte: [
    'vegetarisch', 'vegan', 'tofu', 'tempeh', 'seitan', 'gemüsepfanne', 'ratatouille',
    'falafel', 'halloumi', 'gemüsecurry', 'schmorgurken', 'spargel', 'pilzpfanne'] },

  { key: 'beilage', name: 'Beilage', bild: '🥔', worte: [
    'beilage', 'kartoffelpüree', 'knödel', 'klöße', 'spätzle', 'pommes', 'bratkartoffeln',
    'rotkohl', 'semmelknödel', 'krokette', 'kartoffelstampf', 'kartoffelgratin',
    'ofengemüse', 'wedges'] },

  { key: 'sossen', name: 'Soßen & Dips', bild: '🥣', worte: [
    'soße', 'sauce', 'dip', 'aioli', 'mayonnaise', 'ketchup', 'remoulade', 'hollandaise',
    'béchamel', 'tzatziki', 'guacamole', 'hummus', 'pesto', 'salsa'] },

  { key: 'snacks', name: 'Snacks & Fingerfood', bild: '🥨', worte: [
    'fingerfood', 'häppchen', 'canapé', 'cracker', 'partysnack', 'blätterteigschnecken',
    'laugengebäck', 'brezel', 'nachos', 'popcorn', 'chips'] },

  { key: 'brot', name: 'Brot & Brötchen', bild: '🥖', worte: [
    'brot', 'brötchen', 'baguette', 'sauerteig', 'ciabatta', 'laib', 'hefezopf',
    'semmel', 'toastbrot', 'knäckebrot', 'fladenbrot', 'naan', 'bagel'] },

  { key: 'kuchen', name: 'Kuchen', bild: '🍰', worte: [
    'kuchen', 'rührteig', 'gugelhupf', 'blechkuchen', 'muffin', 'cupcake', 'brownie',
    'käsekuchen', 'streuselkuchen', 'marmorkuchen', 'apfelkuchen', 'zitronenkuchen',
    'zupfkuchen', 'stollen', 'biskuitrolle', 'donauwelle'] },

  { key: 'torte', name: 'Torte', bild: '🎂', worte: [
    'torte', 'tortenboden', 'tortenring', 'sahnetorte', 'buttercreme', 'ganache',
    'tortenguss', 'marzipandecke', 'fondant', 'pavlova', 'schwarzwälder'] },

  { key: 'kekse', name: 'Kekse & Plätzchen', bild: '🍪', worte: [
    'keks', 'plätzchen', 'cookie', 'spekulatius', 'vanillekipferl', 'makrone',
    'lebkuchen', 'zimtstern', 'ausstechform', 'mürbeteig', 'butterplätzchen', 'cantuccini'] },

  { key: 'dessert', name: 'Dessert', bild: '🍮', worte: [
    'dessert', 'nachtisch', 'mousse', 'pudding', 'tiramisu', 'panna cotta',
    'crème brûlée', 'creme brulee', 'sorbet', 'parfait', 'kompott', 'grütze',
    'quarkspeise', 'eiscreme', 'milchshake', 'crumble'] },

  { key: 'getraenke', name: 'Getränke', bild: '🍹', worte: [
    'cocktail', 'limonade', 'punsch', 'glühwein', 'sirup', 'bowle', 'likör',
    'smoothie', 'eistee', 'aperitif', 'spritz', 'sangria', 'kakao'] },

  { key: 'vorrat', name: 'Einmachen & Vorräte', bild: '🫙', worte: [
    'einkochen', 'einmachen', 'marmelade', 'konfitüre', 'gelee', 'chutney',
    'eingelegt', 'einlegen', 'fermentier', 'sterilisier', 'weckglas', 'twist-off',
    'sauerkraut', 'gewürzmischung'] },

  { key: 'sonstiges', name: 'Sonstiges', bild: '🍽️', worte: [] }
];

const KAT_NACH_KEY = Object.fromEntries(KATEGORIEN.map(k => [k.key, k]));

// Deutsche Komposita tragen das Hauptwort mal vorn ("Reispfanne"), mal
// hinten ("Kürbissuppe") — beides muss anschlagen. Die Grenzen ringsum
// sorgen dafür, dass "reis" trotzdem nicht in "Preiselbeere" trifft;
// die Endungen fangen Beugungen ab ("Zehe" → "Zehen").
for (const kat of KATEGORIEN) {
  kat.muster = kat.worte.map(w => {
    const wort = fluchten(w);
    return new RegExp('(?:^|[^a-zäöüß0-9])' + wort + '|' + wort + '(?:en|[nse])?(?![a-zäöüß])', 'i');
  });
}

const STERN_TEXTE = [
  'Noch nicht bewertet',
  'Nicht unser Geschmack',
  'Geht so',
  'Ganz lecker',
  'Richtig gut',
  'Super lecker!'
];

/* ── Kategorie erraten ──────────────────────────────────
   Der Name wiegt schwer, Zutaten und Zubereitung liefern
   nur Indizien — "Gemüsebrühe" in der Zutatenliste soll
   aus einem Braten keine Suppe machen.
   ────────────────────────────────────────────────────── */
function kategorieRaten(titel, zutaten, schritte) {
  const ganz = ' ' + String(titel || '').toLowerCase();

  // "Hirschfilet mit Kartoffelgratin": vor dem "mit" steht das Gericht,
  // dahinter die Beilage. Der Kopf wiegt deshalb am schwersten, sonst
  // macht die Beilage aus dem Braten einen Auflauf.
  const stuecke = ganz.split(/\s+(?:mit|an|auf|dazu|nebst)\s+|,\s+/);
  const kopf = ' ' + stuecke[0];
  const schwanz = ' ' + stuecke.slice(1).join(' ');

  // Zutaten und Zubereitung liefern nur Indizien — "Gemüsebrühe" in der
  // Zutatenliste soll aus einem Braten keine Suppe machen.
  const beiwerk = ' ' + [...(zutaten || []), ...(schritte || [])].join(' ').toLowerCase();

  // Im Deutschen steht das Gericht am Ende des Namens: eine
  // "Béchamel-Hackfleisch-Lasagne" ist eine Lasagne, keine Soße. Deshalb
  // gewinnt im Kopf nicht, wer die meisten Treffer hat, sondern wessen
  // Schlagwort am spätesten endet. Bei Gleichstand das längere, weil
  // genauere Wort: "Zwiebelkuchen" schlägt "kuchen".
  let besterKopf = null;
  let bestEnde = -1;
  let bestLaenge = -1;

  // Nur wenn der Name gar nichts hergibt, zählen Nachsatz und Zutaten.
  let besteAushilfe = 'sonstiges';
  let bestPunkte = 0;

  for (const kat of KATEGORIEN) {
    if (!kat.muster.length) continue;
    let imSchwanz = 0;
    let imBeiwerk = 0;

    for (let i = 0; i < kat.muster.length; i++) {
      const muster = kat.muster[i];
      const treffer = muster.exec(kopf);
      if (treffer) {
        const ende = treffer.index + treffer[0].length;
        const laenge = kat.worte[i].length;
        if (ende > bestEnde || (ende === bestEnde && laenge > bestLaenge)) {
          bestEnde = ende;
          bestLaenge = laenge;
          besterKopf = kat.key;
        }
      } else if (muster.test(schwanz)) imSchwanz++;
      else if (muster.test(beiwerk)) imBeiwerk++;
    }

    const punkte = Math.min(imSchwanz, 2) * 4 + Math.min(imBeiwerk, 4);
    if (punkte > bestPunkte) { bestPunkte = punkte; besteAushilfe = kat.key; }
  }

  if (besterKopf) return besterKopf;
  return bestPunkte >= 3 ? besteAushilfe : 'sonstiges';
}

/* ── Mengen lesen und schreiben ─────────────────────── */

const UNICODE_BRUECHE = {
  '½': 1 / 2, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 1 / 4, '¾': 3 / 4,
  '⅕': 1 / 5, '⅖': 2 / 5, '⅗': 3 / 5, '⅘': 4 / 5,
  '⅙': 1 / 6, '⅚': 5 / 6, '⅛': 1 / 8, '⅜': 3 / 8, '⅝': 5 / 8, '⅞': 7 / 8
};
const BRUCH_ZEICHEN = Object.keys(UNICODE_BRUECHE).join('');

// "gewicht" wird dezimal gerundet (312 g), "zahl" darf Brüche haben (1 ½ EL).
// ein/mehr, damit "1 Zehe Knoblauch" dasteht und nicht "1 Zehen".
const EINHEITEN = [
  { formen: ['kg', 'kilo', 'kilogramm'], ein: 'kg', mehr: 'kg', art: 'gewicht' },
  { formen: ['g', 'gr', 'gramm'], ein: 'g', mehr: 'g', art: 'gewicht' },
  { formen: ['mg'], ein: 'mg', mehr: 'mg', art: 'gewicht' },
  { formen: ['ml', 'milliliter'], ein: 'ml', mehr: 'ml', art: 'gewicht' },
  { formen: ['cl'], ein: 'cl', mehr: 'cl', art: 'gewicht' },
  { formen: ['dl'], ein: 'dl', mehr: 'dl', art: 'gewicht' },
  { formen: ['l', 'liter'], ein: 'l', mehr: 'l', art: 'gewicht' },
  { formen: ['el', 'esslöffel', 'essl'], ein: 'EL', mehr: 'EL', art: 'zahl' },
  { formen: ['tl', 'teelöffel', 'teel'], ein: 'TL', mehr: 'TL', art: 'zahl' },
  { formen: ['msp', 'messerspitze', 'messerspitzen'], ein: 'Msp.', mehr: 'Msp.', art: 'zahl' },
  { formen: ['prise', 'prisen'], ein: 'Prise', mehr: 'Prisen', art: 'zahl' },
  { formen: ['stück', 'stk', 'st'], ein: 'Stück', mehr: 'Stück', art: 'zahl' },
  { formen: ['bund'], ein: 'Bund', mehr: 'Bund', art: 'zahl' },
  { formen: ['zehe', 'zehen'], ein: 'Zehe', mehr: 'Zehen', art: 'zahl' },
  { formen: ['dose', 'dosen'], ein: 'Dose', mehr: 'Dosen', art: 'zahl' },
  { formen: ['packung', 'packungen', 'pck', 'päckchen', 'pkg'], ein: 'Päckchen', mehr: 'Päckchen', art: 'zahl' },
  { formen: ['becher'], ein: 'Becher', mehr: 'Becher', art: 'zahl' },
  { formen: ['tasse', 'tassen'], ein: 'Tasse', mehr: 'Tassen', art: 'zahl' },
  { formen: ['glas', 'gläser'], ein: 'Glas', mehr: 'Gläser', art: 'zahl' },
  { formen: ['scheibe', 'scheiben'], ein: 'Scheibe', mehr: 'Scheiben', art: 'zahl' },
  { formen: ['blatt', 'blätter'], ein: 'Blatt', mehr: 'Blätter', art: 'zahl' },
  { formen: ['kugel', 'kugeln'], ein: 'Kugel', mehr: 'Kugeln', art: 'zahl' },
  { formen: ['würfel'], ein: 'Würfel', mehr: 'Würfel', art: 'zahl' },
  { formen: ['zweig', 'zweige'], ein: 'Zweig', mehr: 'Zweige', art: 'zahl' },
  { formen: ['stange', 'stangen'], ein: 'Stange', mehr: 'Stangen', art: 'zahl' },
  { formen: ['knolle', 'knollen'], ein: 'Knolle', mehr: 'Knollen', art: 'zahl' },
  { formen: ['rippe', 'rippen'], ein: 'Rippe', mehr: 'Rippen', art: 'zahl' },
  { formen: ['kopf', 'köpfe'], ein: 'Kopf', mehr: 'Köpfe', art: 'zahl' },
  { formen: ['handvoll'], ein: 'Handvoll', mehr: 'Handvoll', art: 'zahl' },
  { formen: ['tropfen'], ein: 'Tropfen', mehr: 'Tropfen', art: 'zahl' },
  { formen: ['spritzer'], ein: 'Spritzer', mehr: 'Spritzer', art: 'zahl' },
  { formen: ['portion', 'portionen'], ein: 'Portion', mehr: 'Portionen', art: 'zahl' },
  { formen: ['cm'], ein: 'cm', mehr: 'cm', art: 'laenge' }
];

const E_G = EINHEITEN.find(e => e.ein === 'g');
const E_KG = EINHEITEN.find(e => e.ein === 'kg');
const E_ML = EINHEITEN.find(e => e.ein === 'ml');
const E_L = EINHEITEN.find(e => e.ein === 'l');

// Längere Schreibweisen zuerst, sonst schluckt "l" das "liter".
// Der Blick nach vorn verhindert, dass "l" in "Lorbeerblatt" anschlägt.
const EINHEIT_LISTE = [];
for (const e of EINHEITEN) {
  for (const form of e.formen) {
    EINHEIT_LISTE.push({ form, einheit: e, muster: new RegExp('^' + fluchten(form) + '\\.?(?=$|[\\s\\d])', 'i') });
  }
}
EINHEIT_LISTE.sort((a, b) => b.form.length - a.form.length);

/** Rechnet in die Einheit um, die in der Küche natürlicher ist: 0,75 kg → 750 g. */
function einheitAngleichen(wert, einheit) {
  if (einheit === E_KG && wert < 1) return { wert: wert * 1000, einheit: E_G };
  if (einheit === E_G && wert >= 1000) return { wert: wert / 1000, einheit: E_KG };
  if (einheit === E_L && wert < 1) return { wert: wert * 1000, einheit: E_ML };
  if (einheit === E_ML && wert >= 1000) return { wert: wert / 1000, einheit: E_L };
  return { wert, einheit };
}

function einheitWort(einheit, wert) {
  if (!einheit) return '';
  // Einzahl bis einschließlich 1 — "½ Prise" und "⅔ Zehe", nicht "½ Prisen".
  return wert != null && wert <= 1 + 1e-6 ? einheit.ein : einheit.mehr;
}

/** Liest eine führende Zahl: "250", "1,5", "1/2", "1 1/2", "½", "1½". */
function zahlLesen(text) {
  const s = text.replace(/^\s+/, '');
  const fertig = m => ({ wert: null, rest: s.slice(m[0].length) });

  // Reihenfolge zählt: "1 1/2" vor "1/2" vor "1,5", sonst bleibt der Bruch liegen.
  let m = /^(\d+)\s+(\d+)\s*\/\s*(\d+)/.exec(s);
  if (m && Number(m[3])) {
    return { ...fertig(m), wert: parseInt(m[1], 10) + parseInt(m[2], 10) / parseInt(m[3], 10) };
  }

  m = /^(\d+)\s*\/\s*(\d+)/.exec(s);
  if (m && Number(m[2])) {
    return { ...fertig(m), wert: parseInt(m[1], 10) / parseInt(m[2], 10) };
  }

  m = new RegExp('^(\\d+(?:[.,]\\d+)?)\\s*([' + BRUCH_ZEICHEN + '])?').exec(s);
  if (m) {
    let wert = parseFloat(m[1].replace(',', '.'));
    if (m[2]) wert += UNICODE_BRUECHE[m[2]];
    return { ...fertig(m), wert };
  }

  m = new RegExp('^([' + BRUCH_ZEICHEN + '])').exec(s);
  if (m) return { ...fertig(m), wert: UNICODE_BRUECHE[m[1]] };

  return null;
}

/** Zerlegt eine Zutatenzeile in Menge, Einheit und Zutat. */
function zutatLesen(roh) {
  const text = String(roh).replace(/\s+/g, ' ').trim();
  if (!text) return null;

  // "Für den Teig:" → Zwischenüberschrift
  if (/:\s*$/.test(text) && !/^[\d]/.test(text) && text.length < 60) {
    return { ueberschrift: text.replace(/:\s*$/, '') };
  }

  const ersteZahl = zahlLesen(text);
  if (!ersteZahl) {
    return { menge: null, mengeBis: null, einheit: null, art: 'zahl', was: text };
  }

  const menge = ersteZahl.wert;
  let mengeBis = null;
  let rest = ersteZahl.rest;

  // Spanne: "1-2 Zwiebeln", "2 bis 3 EL"
  const spanne = /^\s*(?:[-–—]|bis)\s*/.exec(rest);
  if (spanne) {
    const zweite = zahlLesen(rest.slice(spanne[0].length));
    if (zweite) { mengeBis = zweite.wert; rest = zweite.rest; }
  }

  let einheit = null;
  const nachZahl = rest.replace(/^\s+/, '');
  for (const e of EINHEIT_LISTE) {
    const m = e.muster.exec(nachZahl);
    if (m) { einheit = e.einheit; rest = nachZahl.slice(m[0].length); break; }
  }

  const was = rest.replace(/^\s+/, '').trim();
  // "3 Eier" — keine Einheit, das Wort selbst ist die Zutat
  return { menge, mengeBis, einheit, art: einheit ? einheit.art : 'zahl', was: was || text };
}

function zahlSchreiben(n) {
  const gerundet = Math.round(n * 100) / 100;
  return gerundet.toLocaleString('de-DE', { maximumFractionDigits: 2 });
}

/** Zähleinheiten dürfen Brüche zeigen: 1 ½ EL liest sich besser als 1,5 EL. */
function bruchSchreiben(wert) {
  if (wert >= 10) return zahlSchreiben(Math.round(wert));

  const ganz = Math.floor(wert + 1e-9);
  const rest = wert - ganz;
  const tabelle = [[0, ''], [1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [1 / 2, '½'],
                   [2 / 3, '⅔'], [3 / 4, '¾'], [7 / 8, '⅞'], [1, '']];

  let treffer = null;
  let abstand = Infinity;
  for (const eintrag of tabelle) {
    const a = Math.abs(rest - eintrag[0]);
    if (a < abstand) { abstand = a; treffer = eintrag; }
  }

  if (abstand <= 0.06) {
    const aufrunden = treffer[0] === 1;
    const zahl = ganz + (aufrunden ? 1 : 0);
    const zeichen = aufrunden ? '' : treffer[1];
    if (!zeichen) return zahlSchreiben(zahl);
    return (zahl ? zahl + ' ' : '') + zeichen;
  }
  return zahlSchreiben(wert);
}

/** Gewichte und Volumen auf runde, in der Küche brauchbare Werte bringen. */
function gewichtSchreiben(wert) {
  let n = wert;
  if (n >= 100) n = Math.round(n / 5) * 5;
  else if (n >= 10) n = Math.round(n);
  else if (n >= 1) n = Math.round(n * 10) / 10;
  else n = Math.round(n * 100) / 100;
  return zahlSchreiben(n);
}

function mengeSchreiben(wert, art) {
  if (wert == null) return '';
  if (wert === 0) return '0';
  // Nur Zähleinheiten bekommen Brüche; Gewichte und Längen bleiben dezimal.
  return art === 'zahl' ? bruchSchreiben(wert) : gewichtSchreiben(wert);
}

/** Zutatenzeile für die gewünschte Portionszahl. */
function zutatSchreiben(zutat, faktor) {
  if (zutat.ueberschrift) return null;
  if (zutat.menge == null) return { menge: '', was: zutat.was };

  let wert = zutat.menge * faktor;
  let bis = zutat.mengeBis != null ? zutat.mengeBis * faktor : null;
  let einheit = zutat.einheit;

  if (zutat.art === 'gewicht' && einheit) {
    const besser = einheitAngleichen(wert, einheit);
    if (besser.einheit !== einheit) {
      // Die Obergrenze der Spanne muss dieselbe Einheit mitgehen.
      if (bis != null) bis *= besser.wert / wert;
      wert = besser.wert;
      einheit = besser.einheit;
    }
  }

  let menge = mengeSchreiben(wert, zutat.art);
  if (bis != null) menge += '–' + mengeSchreiben(bis, zutat.art);

  // Bei einer Spanne bleibt es beim Mehrzahlwort ("1–2 Zehen").
  const wort = einheitWort(einheit, bis == null ? wert : null);
  return { menge: (menge + ' ' + wort).trim(), was: zutat.was };
}

/* ── Speicher (IndexedDB) ───────────────────────────── */

const DB_NAME = 'muemmelkueche';
const DB_VERSION = 1;
const LAGER = 'rezepte';

let dbVersprechen = null;

function db() {
  if (dbVersprechen) return dbVersprechen;
  dbVersprechen = new Promise((gut, schlecht) => {
    const anfrage = indexedDB.open(DB_NAME, DB_VERSION);
    anfrage.onupgradeneeded = () => {
      const d = anfrage.result;
      if (!d.objectStoreNames.contains(LAGER)) {
        d.createObjectStore(LAGER, { keyPath: 'id' });
      }
    };
    anfrage.onsuccess = () => gut(anfrage.result);
    anfrage.onerror = () => schlecht(anfrage.error);
  });
  return dbVersprechen;
}

async function lager(modus, arbeit) {
  const d = await db();
  return new Promise((gut, schlecht) => {
    const t = d.transaction(LAGER, modus);
    const anfrage = arbeit(t.objectStore(LAGER));
    t.oncomplete = () => gut(anfrage ? anfrage.result : undefined);
    t.onerror = () => schlecht(t.error);
    t.onabort = () => schlecht(t.error);
  });
}

const alleRezepte = () => lager('readonly', s => s.getAll());
const rezeptSichern = r => lager('readwrite', s => s.put(r));
const rezeptLoeschen = id => lager('readwrite', s => s.delete(id));

/* ── Bilder ─────────────────────────────────────────── */

/** Verkleinert ein Bild und liefert eine Leinwand zurück. */
async function bildAufLeinwand(quelle, zielKante, graustufen) {
  const bild = await createImageBitmap(quelle);
  const groesste = Math.max(bild.width, bild.height);
  let faktor = zielKante / groesste;
  // Winzige Screenshots hochziehen hilft der Texterkennung, aber nicht endlos.
  if (faktor > 2) faktor = 2;
  if (faktor > 1 && !graustufen) faktor = 1;

  const breite = Math.max(1, Math.round(bild.width * faktor));
  const hoehe = Math.max(1, Math.round(bild.height * faktor));

  const leinwand = document.createElement('canvas');
  leinwand.width = breite;
  leinwand.height = hoehe;
  const stift = leinwand.getContext('2d', { willReadFrequently: !!graustufen });
  stift.imageSmoothingQuality = 'high';
  stift.drawImage(bild, 0, 0, breite, hoehe);
  bild.close();

  if (graustufen) grauUndKontrast(stift, breite, hoehe);
  return leinwand;
}

/** Graustufen plus Kontrastspreizung — Fotos aus der Küche sind selten gleichmäßig belichtet. */
function grauUndKontrast(stift, breite, hoehe) {
  const bild = stift.getImageData(0, 0, breite, hoehe);
  const px = bild.data;
  const verteilung = new Uint32Array(256);

  for (let i = 0; i < px.length; i += 4) {
    const grau = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0;
    px[i] = px[i + 1] = px[i + 2] = grau;
    verteilung[grau]++;
  }

  // 2%- und 98%-Punkt als neue Schwarz-/Weißgrenze
  const gesamt = breite * hoehe;
  const unten = gesamt * 0.02;
  const oben = gesamt * 0.98;
  let summe = 0;
  let min = 0;
  let max = 255;
  for (let i = 0; i < 256; i++) { summe += verteilung[i]; if (summe >= unten) { min = i; break; } }
  summe = 0;
  for (let i = 0; i < 256; i++) { summe += verteilung[i]; if (summe >= oben) { max = i; break; } }

  const spanne = Math.max(1, max - min);
  if (spanne < 250) {
    for (let i = 0; i < px.length; i += 4) {
      let v = ((px[i] - min) * 255) / spanne;
      v = v < 0 ? 0 : v > 255 ? 255 : v;
      px[i] = px[i + 1] = px[i + 2] = v;
    }
  }
  stift.putImageData(bild, 0, 0);
}

async function bildAlsBlob(quelle, zielKante = 1200) {
  const leinwand = await bildAufLeinwand(quelle, zielKante, false);
  return new Promise(gut => leinwand.toBlob(gut, 'image/jpeg', 0.78));
}

/* ── KI-Erkennung ───────────────────────────────────────
   Claude liest das Foto und gibt das Rezept fertig sortiert
   zurück — inklusive Handschrift, die die einfache
   Texterkennung grundsätzlich nicht kann.

   Der Aufruf geht direkt aus dem Browser an die API. Das
   erlaubt sie nur mit der Kopfzeile
   "anthropic-dangerous-direct-browser-access" — der Name ist
   die Warnung: Der Schlüssel liegt damit auf dem Gerät und
   ist für niemanden geheim, der davorsitzt. Für ein
   Familien-Kochbuch mit Ausgabenlimit ist das in Ordnung,
   für eine öffentliche App wäre es das nicht.

   Der Schlüssel steht deshalb NICHT im Code, sondern wird in
   den Einstellungen eingetragen und bleibt im localStorage.
   ────────────────────────────────────────────────────── */

const KI_API = 'https://api.anthropic.com/v1/messages';
const KI_MODELL = 'claude-opus-4-8';
const KI_SCHLUESSEL_FACH = 'muemmelkueche.schluessel';
const KI_KOSTEN_FACH = 'muemmelkueche.kosten';

// Preise für Opus 4.8 in US-Dollar je 1 Million Token (Stand 17.07.2026).
// Nur für die Anzeige — abgerechnet wird ohnehin von Anthropic.
const KI_PREIS = { ein: 5, aus: 25, cacheLesen: 0.5, cacheSchreiben: 6.25 };

const kiSchluessel = () => {
  try { return localStorage.getItem(KI_SCHLUESSEL_FACH) || ''; } catch { return ''; }
};

/** Fester Bauplan der Antwort — so kann nichts anderes zurückkommen als ein Rezept. */
const KI_SCHEMA = {
  type: 'object',
  properties: {
    titel: { type: 'string' },
    portionen: { type: 'integer' },
    einheit: { type: 'string', enum: ['Portionen', 'Personen', 'Stück', 'Gläser', 'Blech'] },
    kategorie: { type: 'string', enum: KATEGORIEN.map(k => k.key) },
    zutaten: { type: 'array', items: { type: 'string' } },
    schritte: { type: 'array', items: { type: 'string' } },
    notizen: { type: 'string' }
  },
  required: ['titel', 'portionen', 'einheit', 'kategorie', 'zutaten', 'schritte', 'notizen'],
  additionalProperties: false
};

// Die Regeln gelten für jede Vorlage — Foto wie Webseite. Nur der erste Satz
// und die letzten Zeilen unterscheiden sich, siehe KI_AUFTRAG_BILD/_LINK.
const KI_REGELN = `- Mengen und Einheiten genau so übernehmen, wie sie dastehen. Nichts umrechnen, nichts vereinheitlichen. "1/2 TL" bleibt "1/2 TL".
- Eine Zutat pro Eintrag, in der Schreibweise der Vorlage: "250 g Mehl".
- Gliedert die Vorlage die Zutaten in Abschnitte, dann bilde diese Gliederung vollständig ab: Übernimm jede Abschnittsüberschrift wortgleich als eigenen Eintrag mit Doppelpunkt am Ende, an genau der Stelle der Liste, an der sie steht. Ohne diese Trennung weiß beim Kochen niemand, welche Zutat wozu gehört — das ist der wichtigste Teil deiner Arbeit.
  Das gilt unabhängig davon, wie die Überschriften lauten und wie sie gesetzt sind: ob "Für den Teig" oder nur "Teig", ob "Rub", "Marinade", "Guss", "Sud", "Beilage" oder etwas ganz anderes; ob sie fett, unterstrichen, eingerückt, in einem Kasten oder auf einer eigenen Seite stehen. Schreib die Überschrift so, wie sie dasteht, und häng nur den Doppelpunkt an: aus "Rub" wird "Rub:".
- Erfinde keinen Abschnitt, den es nicht gibt, und lass keinen weg. Hat die Vorlage nur eine einzige Zutatenliste ohne Gliederung, dann setz auch keine Überschrift.
- Zutaten, die vor dem ersten Abschnitt stehen und zu keinem gehören (etwa das Fleisch selbst), kommen ohne Überschrift an den Anfang.
- Ein Arbeitsschritt pro Eintrag, ohne Nummer davor.
- Steht keine Portionszahl da, schätz sie aus den Mengen und wähl die passende Einheit (ein Kuchen ist "Blech" oder "Stück", eine Suppe "Portionen").
- kategorie: aus der vorgegebenen Liste wählen. Bei Namen der Form "X mit Y" zählt X: "Hirschfilet mit Kartoffelgratin" ist Braten, nicht Auflauf.
- Nichts erfinden und nichts ergänzen. Was nicht in der Vorlage steht, steht nicht im Rezept.`;

const KI_AUFTRAG_BILD = `Du liest Rezepte von Fotos und Screenshots ab und gibst sie strukturiert zurück.

Regeln:
- Mehrere Bilder gehören immer zu EINEM Rezept und kommen in der richtigen Reihenfolge. Setz sie zusammen. Was sich überlappt, nur einmal übernehmen.
${KI_REGELN}
- notizen: nur handschriftliche Ergänzungen am Rand oder Hinweise wie "schmeckt aufgewärmt besser". Sonst leer lassen.
- Handschrift so genau wie möglich lesen. Bist du bei einem Wort oder einer Zahl unsicher, schreib deine beste Vermutung und häng ein "?" an — dann fällt es beim Prüfen auf.`;

const KI_AUFTRAG_LINK = `Du liest Rezepte von Webseiten ab und gibst sie strukturiert zurück. Ruf die genannte Adresse mit dem web_fetch-Werkzeug ab.

Regeln:
${KI_REGELN}
- Die Seite enthält neben dem Rezept viel Beiwerk: Navigation, Werbung, Kommentare, Empfehlungen, Nährwerte. Das gehört nicht ins Rezept.
- notizen: nur Hinweise der Autorin zum Gelingen ("schmeckt aufgewärmt besser", "Teig muss über Nacht ruhen"). Keine Werbung, keine Kommentare, keine Nährwerte. Sonst leer lassen.
- titel: den Namen des Rezepts, ohne Zusätze wie den Namen der Einsenderin oder "einfach & schnell".`;

/** Skaliert auf die größte Kante, die Opus 4.8 in voller Auflösung nutzt. */
async function bildFuerKi(datei) {
  const leinwand = await bildAufLeinwand(datei, 2576, false);
  const blob = await new Promise(gut => leinwand.toBlob(gut, 'image/jpeg', 0.85));
  const text = await blobZuText(blob);
  return {
    type: 'image',
    source: { type: 'base64', media_type: 'image/jpeg', data: text.split(',')[1] }
  };
}

function kiKostenAus(verbrauch) {
  const v = verbrauch || {};
  return ((v.input_tokens || 0) * KI_PREIS.ein
    + (v.output_tokens || 0) * KI_PREIS.aus
    + (v.cache_read_input_tokens || 0) * KI_PREIS.cacheLesen
    + (v.cache_creation_input_tokens || 0) * KI_PREIS.cacheSchreiben) / 1e6;
}

function kiKostenBuchen(dollar) {
  try {
    const alt = JSON.parse(localStorage.getItem(KI_KOSTEN_FACH) || '{"summe":0,"anzahl":0}');
    const neu = { summe: (alt.summe || 0) + dollar, anzahl: (alt.anzahl || 0) + 1 };
    localStorage.setItem(KI_KOSTEN_FACH, JSON.stringify(neu));
    return neu;
  } catch {
    return { summe: dollar, anzahl: 1 };
  }
}

/** Übersetzt die Fehler der API in etwas, das in einer Küche weiterhilft. */
function kiFehlerText(status, koerper) {
  const meldung = koerper?.error?.message || '';
  if (status === 401) return 'Der Schlüssel wird nicht akzeptiert. Bitte in den Einstellungen prüfen — er beginnt mit „sk-ant-".';
  if (status === 403) return 'Der Schlüssel darf dieses Modell nicht benutzen.';
  if (status === 429) return 'Gerade zu viele Anfragen. Warte einen Moment und versuch es noch einmal.';
  if (status === 400 && /credit|balance|quota/i.test(meldung)) {
    return 'Das Anthropic-Konto hat kein Guthaben mehr. Unter console.anthropic.com aufladen.';
  }
  if (status === 400) return 'Die Anfrage wurde abgelehnt: ' + (meldung || 'unbekannter Grund');
  if (status === 529 || status >= 500) return 'Der Dienst ist gerade überlastet. Gleich noch einmal versuchen.';
  return 'Die Erkennung ist fehlgeschlagen (Fehler ' + status + '). ' + meldung;
}

/** Was das Abrufen einer Seite durch Claude schiefgehen lassen kann. */
function webFetchFehlerText(code) {
  switch (code) {
    case 'url_not_accessible': return 'Die Seite war nicht erreichbar. Stimmt die Adresse noch?';
    case 'url_too_long': return 'Die Adresse ist zu lang (mehr als 250 Zeichen).';
    case 'url_not_allowed': return 'Diese Seite lässt sich nicht abrufen — sie hat das Auslesen untersagt. Nimm „Rezepttext einfügen".';
    case 'unsupported_content_type': return 'Unter der Adresse liegt keine lesbare Seite.';
    case 'too_many_requests': return 'Die Seite hat zu viele Anfragen abgewehrt. Gleich noch einmal versuchen.';
    case 'invalid_tool_input': return 'Die Adresse ließ sich nicht verarbeiten.';
    default: return 'Die Seite ließ sich nicht abrufen. Nimm „Rezepttext einfügen" — das geht immer.';
  }
}

/** Ein Aufruf an die API, samt Wiederaufnahme, wenn ein Server-Werkzeug pausiert. */
async function kiRufen(koerper, melde) {
  const schluessel = kiSchluessel();
  if (!schluessel) throw new Error('Kein Schlüssel eingetragen.');

  let daten = null;
  const nachrichten = [...koerper.messages];

  // Server-Werkzeuge (das Seitenabrufen) können mit "pause_turn" anhalten.
  // Dann Antwort anhängen und weiterlaufen lassen — höchstens vier Runden,
  // damit nichts endlos kreist.
  for (let runde = 0; runde < 4; runde++) {
    let antwort;
    try {
      antwort = await fetch(KI_API, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': schluessel,
          'anthropic-version': '2023-06-01',
          // Ohne diese Kopfzeile blockt die API den Aufruf aus dem Browser.
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({ ...koerper, messages: nachrichten })
      });
    } catch {
      throw new Error('Keine Verbindung zu Claude. Ist das Gerät online?');
    }

    daten = await antwort.json().catch(() => null);
    if (!antwort.ok) throw new Error(kiFehlerText(antwort.status, daten));
    if (daten.stop_reason !== 'pause_turn') break;

    melde('Claude arbeitet noch …', null);
    nachrichten.push({ role: 'assistant', content: daten.content });
  }
  return daten;
}

/** Zieht das Rezept aus der Antwort — und übersetzt, was schiefgegangen sein kann. */
function kiAntwortAuswerten(daten) {
  if (daten.stop_reason === 'refusal') {
    throw new Error('Claude hat die Bearbeitung abgelehnt. Bei einem Rezept ist das seltsam — versuch eine andere Vorlage.');
  }
  if (daten.stop_reason === 'max_tokens') {
    throw new Error('Die Vorlage war zu umfangreich für eine Anfrage.');
  }

  // Hat das Seitenabrufen selbst versagt, steht das als Block in der Antwort
  // (die API meldet dafür kein HTTP-Problem).
  const fehl = (daten.content || []).find(b =>
    b.type === 'web_fetch_tool_result' && b.content && b.content.type === 'web_fetch_tool_result_error');
  if (fehl) throw new Error(webFetchFehlerText(fehl.content.error_code));

  // Bei Werkzeugnutzung können mehrere Textblöcke kommen; das Rezept steht im
  // letzten. Von hinten nach vorn probieren, damit Zwischengeplauder nicht stört.
  const texte = (daten.content || []).filter(b => b.type === 'text').map(b => b.text);
  for (let i = texte.length - 1; i >= 0; i--) {
    try { return JSON.parse(texte[i]); } catch { /* nächsten versuchen */ }
  }
  throw new Error('Claude hat kein Rezept zurückgegeben. Versuch es noch einmal.');
}

/** Liest ein Rezept von einem oder mehreren Bildern. */
async function kiRezeptLesen(dateien, melde) {
  const bilder = [];
  for (let i = 0; i < dateien.length; i++) {
    melde(dateien.length > 1
      ? 'Bild ' + (i + 1) + ' von ' + dateien.length + ' wird vorbereitet …'
      : 'Bild wird vorbereitet …', 0.05 + (i / dateien.length) * 0.25);
    bilder.push(await bildFuerKi(dateien[i]));
  }

  melde(dateien.length > 1
    ? 'Claude liest die ' + dateien.length + ' Bilder …'
    : 'Claude liest das Rezept …', null);

  const daten = await kiRufen({
    model: KI_MODELL,
    max_tokens: 16000,
    // Nachdenken hilft spürbar bei krakeliger Handschrift.
    thinking: { type: 'adaptive' },
    output_config: { format: { type: 'json_schema', schema: KI_SCHEMA } },
    system: KI_AUFTRAG_BILD,
    messages: [{
      role: 'user',
      content: [
        ...bilder,
        { type: 'text', text: dateien.length > 1
          ? 'Diese ' + dateien.length + ' Bilder zeigen EIN Rezept. Lies es ab.'
          : 'Lies das Rezept auf diesem Bild ab.' }
      ]
    }]
  }, melde);

  melde('Fertig.', 1);
  return { rezept: kiAntwortAuswerten(daten), kosten: kiKostenAus(daten.usage) };
}

/**
 * Liest ein Rezept von einer Webseite — Claude ruft sie selbst ab.
 * Damit entfällt der ganze Umweg über fremde Weiterleitungsdienste: Der Abruf
 * passiert auf Anthropics Servern, nicht im Browser, also greift auch keine
 * CORS-Sperre. Das Abrufen selbst kostet nichts extra, nur die gelesenen Token.
 */
async function kiRezeptVonLink(url, melde) {
  melde('Claude ruft die Seite ab …', null);

  const daten = await kiRufen({
    model: KI_MODELL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { format: { type: 'json_schema', schema: KI_SCHEMA } },
    system: KI_AUFTRAG_LINK,
    tools: [{
      type: 'web_fetch_20260318',
      name: 'web_fetch',
      max_uses: 3,
      // Rezeptseiten sind aufgebläht. Claude filtert vorab selbst, die Grenze
      // ist die Reißleine gegen Ausreißer.
      max_content_tokens: 40000
    }],
    messages: [{
      role: 'user',
      content: 'Lies das Rezept von dieser Seite: ' + url
    }]
  }, melde);

  melde('Fertig.', 1);
  return { rezept: kiAntwortAuswerten(daten), kosten: kiKostenAus(daten.usage) };
}

/* ── Texterkennung ──────────────────────────────────────
   Tesseract liegt komplett im Ordner ./ocr — kein fremder
   CDN, kein Netz nötig. Kostet gut 10 MB im Verzeichnis,
   dafür läuft die Erkennung auch im Funkloch.

   Der Kern ist bewusst auf die SIMD-Fassung festgenagelt:
   die versteht jeder Browser seit etwa 2021, während die
   schnellere "relaxedsimd"-Fassung neuere Geräte verlangt.
   ────────────────────────────────────────────────────── */

// Bewusst als vollständige Adresse: Tesseract reicht diese Pfade an einen
// Web Worker weiter, und ein "./ocr" würde dort womöglich gegen den Worker
// statt gegen die Seite aufgelöst. Auf GitHub Pages liegt die App in einem
// Unterordner — genau da bräche das.
const OCR_PFAD = new URL('./ocr', document.baseURI).href.replace(/\/$/, '');

function tesseractLaden() {
  if (window.Tesseract) return Promise.resolve();
  return new Promise((gut, schlecht) => {
    const s = document.createElement('script');
    s.src = OCR_PFAD + '/tesseract.min.js';
    s.onload = () => gut();
    s.onerror = () => schlecht(new Error('Die Texterkennung konnte nicht geladen werden.'));
    document.head.appendChild(s);
  });
}

async function textErkennen(datei, melde) {
  melde('Texterkennung wird geladen …', 0.05);
  await tesseractLaden();

  melde('Bild wird vorbereitet …', 0.12);
  const leinwand = await bildAufLeinwand(datei, 1800, true);

  melde('Sprachdatei wird vorbereitet — beim ersten Mal dauert das etwas …', 0.18);
  const arbeiter = await Tesseract.createWorker('deu', 1, {
    workerPath: OCR_PFAD + '/worker.min.js',
    corePath: OCR_PFAD + '/tesseract-core-simd-lstm.wasm.js',
    langPath: OCR_PFAD,
    logger: m => {
      if (m.status === 'recognizing text') {
        melde('Text wird gelesen …', 0.3 + m.progress * 0.65);
      }
    }
  });

  try {
    const { data } = await arbeiter.recognize(leinwand);
    return ocrSaeubern(data.text || '');
  } finally {
    await arbeiter.terminate();
  }
}

/** Räumt Zeichen weg, bei denen sich die Texterkennung verlässlich vergreift. */
function ocrSaeubern(text) {
  return String(text)
    // An einzelne Ziffern hängt Tesseract gern ein punktloses ı ("1ı Zwiebel").
    // Hinter einer Ziffer ist dieses Zeichen im Deutschen immer falsch.
    .replace(/(\d)[ıɩίι]/g, '$1')
    // Typografische Anführungszeichen und Striche vereinheitlichen.
    .replace(/[‚‘’´`]/g, "'")
    .replace(/[„“”]/g, '"');
}

/* ── Text zu Rezept ─────────────────────────────────── */

const MARKE_ZUTATEN = /^(zutaten|zutatenliste|du brauchst|man nehme|einkaufsliste|ingredients)\b/i;
const MARKE_SCHRITTE = /^(zubereitung|anleitung|so geht'?s|und so geht'?s|arbeitsschritte|schritte|method|zubereitungsschritte|so wird'?s gemacht)\b/i;
const MARKE_PORTION = /(?:für\s+)?(\d{1,2})\s*(portionen?|personen|stücke?|stk\.?|gläser|glas|blech)/i;

// Beiwerk einer Rezeptseite: Sternchen, Zeitangaben, Schwierigkeitsgrad.
// Steht beim Kopieren zwischen Titel und Zutaten und ist nie der Titel.
const MARKE_BEIWERK = /^(arbeitszeit|zubereitungszeit|koch-?zeit|back-?zeit|gesamtzeit|ruhezeit|wartezeit|schwierigkeit|niveau|kalorien|nährwert|ergibt|drucken|teilen|merken|anzeige|werbung|zutaten für)\b|bewertung|sterne|★|schwierigkeitsgrad|\bkcal\b|\d+([.,]\d+)?\s*von\s*\d+|^\d+\s*(min|minuten|std|stunden)\b/i;

// Wo die Seite aufhört und das Drumherum anfängt.
const MARKE_SCHLUSS = /^(kommentare|ähnliche rezepte|weitere rezepte|noch mehr|das könnte d|mehr von|newsletter|nährwerte|nährwertangaben|folge uns|jetzt bewerten|rezept bewerten|passende produkte|anzeige|werbung|verwandte)\b/i;

function istZutatenZeile(zeile) {
  if (zeile.length > 72) return false;
  if (zahlLesen(zeile)) return true;
  return /^(etwas|einige|ein paar|nach belieben|n\.\s?b\.|salz|pfeffer|öl|butter|mehl|zucker)\b/i.test(zeile)
    && zeile.length < 40;
}

function schritteAusText(text) {
  const t = String(text).replace(/\s+/g, ' ').trim();
  if (!t) return [];

  // "1. … 2. …" ist das verlässlichste Signal.
  const nummeriert = t.split(/(?:^|\s)\d{1,2}[.)]\s+/).map(s => s.trim()).filter(Boolean);
  if (nummeriert.length >= 2) return nummeriert;

  const saetze = t.split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ0-9])/);
  const raus = [];
  for (const satz of saetze) {
    const vorher = raus[raus.length - 1];
    if (vorher && (vorher.length < 60 || satz.length < 30)) raus[raus.length - 1] = vorher + ' ' + satz;
    else raus.push(satz);
  }
  return raus.map(s => s.trim()).filter(Boolean);
}

/** Erkannten Fließtext heuristisch in ein Rezept zerlegen. */
function textZuRezept(text) {
  let zeilen = String(text).split(/\r?\n/)
    .map(z => z.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean);

  // Kopierte Seiten schleppen Kommentare und Newsletter hinterher —
  // alles ab dort abschneiden, sonst wird das zum Arbeitsschritt.
  const schluss = zeilen.findIndex((z, i) => i > 2 && MARKE_SCHLUSS.test(z));
  if (schluss > 0) zeilen = zeilen.slice(0, schluss);

  let portionen = null;
  let einheit = 'Portionen';
  for (const z of zeilen) {
    const m = MARKE_PORTION.exec(z);
    if (m) {
      portionen = Math.max(1, Math.min(99, parseInt(m[1], 10)));
      const e = m[2].toLowerCase();
      einheit = e.startsWith('stück') || e.startsWith('stk') ? 'Stück'
        : e.startsWith('gläser') || e.startsWith('glas') ? 'Gläser'
        : e.startsWith('blech') ? 'Blech'
        : e.startsWith('personen') ? 'Personen' : 'Portionen';
      break;
    }
  }

  const zutatenMarke = zeilen.findIndex(z => MARKE_ZUTATEN.test(z));
  const schritteMarke = zeilen.findIndex(z => MARKE_SCHRITTE.test(z));

  // Titel finden.
  // Der Titel steht auf Rezeptseiten direkt über der Zutatenliste — davor
  // stehen nur Sternchen und Zeitangaben, darüber die Navigation. Deshalb
  // von der Zutaten-Überschrift aus rückwärts suchen: sonst wird beim
  // Einfügen einer kopierten Seite "Startseite Rezepte Anmelden" zum Titel.
  const taugtAlsTitel = z =>
    z.length >= 3 && z.length <= 70 &&
    !MARKE_PORTION.test(z) && !MARKE_BEIWERK.test(z) &&
    !MARKE_ZUTATEN.test(z) && !MARKE_SCHRITTE.test(z) &&
    !istZutatenZeile(z);

  let titel = '';
  if (zutatenMarke > 0) {
    for (let i = zutatenMarke - 1; i >= 0 && i >= zutatenMarke - 6; i--) {
      if (taugtAlsTitel(zeilen[i])) { titel = zeilen[i]; break; }
    }
  }
  // Ohne Zutaten-Überschrift (oder wenn davor nichts Brauchbares stand):
  // die erste taugliche Zeile von oben.
  if (!titel) {
    for (let i = 0; i < Math.min(zeilen.length, 8); i++) {
      if (taugtAlsTitel(zeilen[i])) { titel = zeilen[i]; break; }
    }
  }
  titel = titel.replace(/^[^\wÄÖÜäöüß]+/, '').trim();

  let zutatenZeilen = [];
  let schritteText = '';

  if (zutatenMarke >= 0) {
    const ende = schritteMarke > zutatenMarke ? schritteMarke : zeilen.length;
    for (let i = zutatenMarke + 1; i < ende; i++) {
      const z = zeilen[i];
      if (!istZutatenZeile(z) && zutatenZeilen.length && z.length > 72) {
        schritteText += ' ' + zeilen.slice(i, ende).join(' ');
        break;
      }
      if (z !== titel) zutatenZeilen.push(z);
    }
    if (schritteMarke > zutatenMarke) {
      schritteText += ' ' + zeilen.slice(schritteMarke + 1).join(' ');
    }
  } else {
    // Ohne Überschriften: Zeile für Zeile einsortieren.
    const schritteRoh = [];
    for (let i = 0; i < zeilen.length; i++) {
      const z = zeilen[i];
      if (z === titel || MARKE_PORTION.test(z) || MARKE_SCHRITTE.test(z)) continue;
      if (schritteMarke >= 0 && i > schritteMarke) schritteRoh.push(z);
      else if (istZutatenZeile(z)) zutatenZeilen.push(z);
      else schritteRoh.push(z);
    }
    schritteText = schritteRoh.join(' ');
  }

  zutatenZeilen = zutatenZeilen
    .filter(z => !MARKE_SCHRITTE.test(z) && !MARKE_ZUTATEN.test(z))
    .map(z => z.replace(/^[•·*\-–—]\s*/, '').trim())
    .filter(Boolean);

  return {
    titel: titel || 'Neues Rezept',
    portionen,
    einheit,
    zutaten: zutatenZeilen,
    schritte: schritteAusText(schritteText)
  };
}

/* ── Link-Import ────────────────────────────────────── */

// Der Browser lässt uns fremde Seiten nicht direkt lesen; diese Dienste
// reichen sie durch. Fällt einer aus, wird der nächste versucht.
//
// Das ist die wackeligste Stelle der ganzen App: Es sind kostenlose fremde
// Dienste, die jederzeit verschwinden können. Beim Prüfen am 17.07.2026 lief
// nur cors.lol; allorigins und codetabs antworteten mit 5xx, corsproxy.io
// verlangt inzwischen einen Schlüssel und ist deshalb raus. Die beiden
// anderen bleiben als Rückfallebene stehen, falls sie sich erholen.
// Wenn der Link-Import irgendwann klemmt: hier zuerst nachsehen.
const BOTEN = [
  u => 'https://api.cors.lol/?url=' + encodeURIComponent(u),
  u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
  u => 'https://api.codetabs.com/v1/proxy/?quest=' + encodeURIComponent(u)
];

/**
 * Alle Dienste gleichzeitig anrennen, der erste Treffer gewinnt.
 * Nacheinander zu warten hieße: dreimal in einen Zeitablauf laufen, bevor
 * überhaupt etwas passiert. Parallel ist die Wartezeit die des schnellsten
 * Dienstes statt die Summe aller Ausfälle — und genau das macht den
 * kostenlosen Versuch überhaupt erst zumutbar.
 */
async function seiteHolen(url, frist) {
  const versuche = BOTEN.map(bote =>
    fetch(bote(url), { signal: AbortSignal.timeout(frist) }).then(async antwort => {
      if (!antwort.ok) throw new Error('HTTP ' + antwort.status);
      const html = await antwort.text();
      if (!html || html.length < 400) throw new Error('Antwort war leer');
      return html;
    }));

  // Promise.any: der erste Erfolg zählt, alle Ausfälle werden verschluckt.
  return Promise.any(versuche);
}

/** HTML-Schnipsel zu reinem Text — über DOMParser, der nichts nachlädt und nichts ausführt. */
function nurText(schnipsel) {
  const doc = new DOMParser().parseFromString(String(schnipsel), 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}

/**
 * Flickt Zutaten, die eine Seite versehentlich zerrissen hat.
 * einfachbacken.de zerlegt seine Zutatenliste irgendwo am Komma: Aus
 * "Etwas Vanille (0,5 Schote)" werden zwei Einträge — "Etwas Vanille (0"
 * und "5 Schote)". Unpaarige Klammern verraten das eindeutig, also wieder
 * zusammensetzen. Ohne Klammern wird nichts angefasst: "Salz" und "Pfeffer"
 * sind auch getrennt richtig.
 */
function zutatenFlicken(flach) {
  const zaehl = (s, z) => (String(s).match(z) || []).length;
  const raus = [];

  for (let i = 0; i < flach.length; i++) {
    let zeile = String(flach[i]);
    let offen = zaehl(zeile, /\(/g) - zaehl(zeile, /\)/g);

    // Am Komma getrennt, also auch mit Komma wieder zusammen: "(0" + "5" → "(0,5"
    while (offen > 0 && i + 1 < flach.length) {
      const naechste = String(flach[++i]).trim();
      zeile += ',' + naechste;
      offen += zaehl(naechste, /\(/g) - zaehl(naechste, /\)/g);
    }
    raus.push(zeile);
  }
  return raus;
}

function rezeptImJson(wert, tiefe = 0) {
  if (!wert || typeof wert !== 'object' || tiefe > 8) return null;

  if (Array.isArray(wert)) {
    for (const eintrag of wert) {
      const fund = rezeptImJson(eintrag, tiefe + 1);
      if (fund) return fund;
    }
    return null;
  }

  const typ = wert['@type'];
  const typen = Array.isArray(typ) ? typ : [typ];
  if (typen.some(t => typeof t === 'string' && t.toLowerCase() === 'recipe')) return wert;

  for (const schluessel of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement', 'hasPart']) {
    if (wert[schluessel]) {
      const fund = rezeptImJson(wert[schluessel], tiefe + 1);
      if (fund) return fund;
    }
  }
  return null;
}

function anweisungenLesen(wert, tiefe = 0) {
  if (!wert || tiefe > 5) return [];
  if (typeof wert === 'string') return schritteAusText(nurText(wert));

  if (Array.isArray(wert)) {
    const raus = [];
    for (const eintrag of wert) {
      if (typeof eintrag === 'string') {
        const t = nurText(eintrag);
        if (t) raus.push(t);
      } else if (eintrag && typeof eintrag === 'object') {
        const typ = String(eintrag['@type'] || '').toLowerCase();
        if (typ === 'howtosection' && eintrag.itemListElement) {
          raus.push(...anweisungenLesen(eintrag.itemListElement, tiefe + 1));
        } else {
          const t = nurText(eintrag.text || eintrag.name || '');
          if (t) raus.push(t);
        }
      }
    }
    return raus.filter(Boolean);
  }

  if (typeof wert === 'object') {
    if (wert.itemListElement) return anweisungenLesen(wert.itemListElement, tiefe + 1);
    if (wert.text) return schritteAusText(nurText(wert.text));
  }
  return [];
}

function portionenLesen(wert) {
  if (wert == null) return { portionen: null, einheit: 'Portionen' };
  let s = Array.isArray(wert) ? wert.find(x => x != null) : wert;
  if (s && typeof s === 'object') s = s.value ?? s.name ?? '';
  s = String(s);

  const zahl = /\d{1,2}/.exec(s);
  if (!zahl) return { portionen: null, einheit: 'Portionen' };

  const einheit = /stück|stk/i.test(s) ? 'Stück'
    : /gläser|glas/i.test(s) ? 'Gläser'
    : /blech/i.test(s) ? 'Blech'
    : /person/i.test(s) ? 'Personen'
    : /portion/i.test(s) ? 'Portionen'
    // "1 Torte", "1 Kastenform", "2 Laibe" — das Gebäck selbst ist die Einheit.
    : /torte|kuchen|brot|laib|form|blech|pizza|zopf/i.test(s) ? 'Stück'
    : 'Portionen';

  return { portionen: Math.max(1, Math.min(99, parseInt(zahl[0], 10))), einheit };
}

/**
 * Chefkoch & Co. hängen den Namen der Einsenderin an den Rezepttitel
 * ("Kürbissuppe … von UlrikeM"). Im Kochbuch stört das.
 */
function titelSaeubern(titel, autor) {
  let name = String(titel).replace(/\s+/g, ' ').trim();

  const wer = Array.isArray(autor) ? autor[0] : autor;
  const autorName = nurText((wer && typeof wer === 'object' ? wer.name : wer) || '');
  if (autorName) {
    name = name.replace(new RegExp('\\s+von\\s+' + fluchten(autorName) + '\\s*$', 'i'), '');
  }
  return name.trim();
}

function bildUrlLesen(wert, tiefe = 0) {
  if (!wert || tiefe > 3) return null;
  if (typeof wert === 'string') return wert;
  if (Array.isArray(wert)) {
    for (const e of wert) { const u = bildUrlLesen(e, tiefe + 1); if (u) return u; }
    return null;
  }
  if (typeof wert === 'object') return bildUrlLesen(wert.url || wert.contentUrl, tiefe + 1);
  return null;
}

/* ── Zutatengruppen ─────────────────────────────────────
   Die maschinenlesbaren Daten einer Rezeptseite enthalten nur eine
   flache Zutatenliste — "Für den Boden:" und "Für die Füllung:"
   stehen dort nicht drin. In der sichtbaren Tabelle stehen sie sehr
   wohl. Also: die bekannten Zutaten im Seitenaufbau wiederfinden und
   die Überschriften dazwischen einsammeln.
   ────────────────────────────────────────────────────── */

/**
 * Vergleichsschlüssel für "ist das dieselbe Zutat?".
 * Leerzeichen fliegen raus, weil im HTML "7 m.-große" direkt an "Ei(er)" klebt.
 * Klammern fliegen raus, weil die maschinenlesbaren Daten sie setzen, die
 * sichtbare Tabelle aber nicht: "Zitronenabrieb (z. B. von Dr. Oetker)"
 * steht dort ohne Klammern.
 */
const textSchluessel = s => String(s).toLowerCase().replace(/\s+/g, '').replace(/[()[\]]/g, '');

const KOPF_TAGS = /^(H[2-6]|TH|LEGEND|CAPTION|DT|STRONG|B|SUMMARY)$/;
const KOPF_KLASSEN = /headline|heading|group|gruppe|subhead|titel|title|section|abschnitt/i;

// Wörter, die eine Zutatenliste überschreiben, aber keine Gruppe benennen.
// Exakt vergleichen: "Zutaten" ist gesperrt, "Zutaten für den Teig" nicht.
const KOPF_SPERRE = /^(zutaten|zutat|ingredients|zubereitung|anleitung|schritte|instructions|einkaufsliste|nährwerte|nährwertangaben|zubehör|equipment|menge|einheit|amount|unit|utensilien)\s*:?\s*$/i;

/**
 * Sieht das nach einer Zwischenüberschrift aus?
 * `imBlock` sagt, ob das Element innerhalb des Zutatenblocks sitzt. Tut es das,
 * darf die Überschrift heißen, wie sie will ("Rub", "Teig", "For the dough") —
 * die Lage im Seitenaufbau verrät ihre Rolle. Außerhalb bleibt es streng, sonst
 * würde jede Zwischenzeile der Seite zur Gruppe.
 */
function istGruppenKopf(el, imBlock) {
  const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
  if (!text || text.length > 60) return false;
  if (KOPF_SPERRE.test(text)) return false;
  if (!/[a-zA-ZÄÖÜäöüß]/.test(text)) return false;
  // "Zutaten für 12 Portionen" ist die Blocküberschrift, keine Gruppe.
  if (MARKE_PORTION.test(text)) return false;

  if (!KOPF_TAGS.test(el.tagName) && !KOPF_KLASSEN.test(el.getAttribute('class') || '')) return false;

  return imBlock || /:\s*$/.test(text) || /^(für|zum|zur|for)\b/i.test(text);
}

/**
 * Fügt die Zwischenüberschriften wieder in die flache Zutatenliste ein.
 * Läuft einmal durch den Seitenaufbau und hält dabei einen Zeiger auf die
 * nächste erwartete Zutat — die Reihenfolge stimmt bei Rezeptseiten überein.
 */
function zutatenMitGruppen(doc, flach) {
  if (flach.length < 2 || !doc.body) return flach;
  const gesucht = flach.map(textSchluessel);

  // Durchgang 1: Zu jeder Zutat ihre Zeile im Seitenaufbau suchen.
  // Der erste Knoten, dessen Text genau die Zutat ergibt, ist die Zeile —
  // der Behälter darüber enthält mehr, die Zelle darunter weniger. Der
  // kleine Vorgriff macht das tolerant: Schreibt die Seite eine einzelne
  // Zutat anders als die maschinenlesbaren Daten, kippt nicht alles.
  const knoten = new Array(flach.length).fill(null);
  let z = 0;
  for (const el of doc.body.querySelectorAll('*')) {
    if (z >= flach.length) break;
    const hier = textSchluessel(el.textContent || '');
    if (!hier) continue;
    for (let i = z; i < Math.min(z + 3, flach.length); i++) {
      if (gesucht[i] === hier) { knoten[i] = el; z = i + 1; break; }
    }
  }

  const gefunden = knoten.filter(Boolean);
  if (gefunden.length < 2) return flach;

  // Der kleinste gemeinsame Behälter aller Zutaten ist der Zutatenblock.
  // Was darin als Überschrift steht, ist eine Gruppe — unabhängig davon,
  // wie sie heißt. Das ist der Unterschied zwischen "erkennt Für den Teig"
  // und "erkennt die Gliederung".
  let block = gefunden[0];
  for (const k of gefunden) {
    while (block && !block.contains(k)) block = block.parentElement;
  }
  if (!block) return flach;

  const istZutat = new Set(gefunden);
  const raus = [];
  let zeiger = 0;
  let offenerKopf = null;
  let letzterKopf = null;
  let gruppen = 0;

  // Durchgang 2: Block einmal durchlaufen, Überschriften und Zutaten mischen.
  for (const el of [block, ...block.querySelectorAll('*')]) {
    if (zeiger >= flach.length) break;

    if (istZutat.has(el)) {
      const stelle = knoten.indexOf(el);
      while (zeiger < stelle) raus.push(flach[zeiger++]);

      if (offenerKopf && offenerKopf !== letzterKopf) {
        raus.push(/:\s*$/.test(offenerKopf) ? offenerKopf : offenerKopf + ':');
        letzterKopf = offenerKopf;
        gruppen++;
      }
      offenerKopf = null;
      raus.push(flach[zeiger++]);
      continue;
    }

    // Ein Element, das Zutaten umschließt, ist ein Behälter, keine Überschrift.
    if (gefunden.some(k => el.contains(k))) continue;

    if (istGruppenKopf(el, true)) {
      offenerKopf = (el.textContent || '').replace(/\s+/g, ' ').trim();
    }
  }

  while (zeiger < flach.length) raus.push(flach[zeiger++]);

  // Mehr Gruppen als halb so viele Zutaten heißt: Da ist etwas schiefgelaufen.
  if (!gruppen || gruppen > flach.length / 2) return flach;
  return raus;
}

function rezeptAusMicrodata(doc) {
  const wurzel = doc.querySelector('[itemtype*="schema.org/Recipe" i]');
  if (!wurzel) return null;

  const holen = name => wurzel.querySelector('[itemprop="' + name + '" i]');
  const alle = name => [...wurzel.querySelectorAll('[itemprop="' + name + '" i]')];

  const zutaten = alle('recipeIngredient').concat(alle('ingredients'))
    .map(n => (n.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (!zutaten.length) return null;

  const schritteKnoten = alle('recipeInstructions');
  const schritte = schritteKnoten.length > 1
    ? schritteKnoten.map(n => (n.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
    : schritteAusText(schritteKnoten[0] ? schritteKnoten[0].textContent : '');

  const ertrag = holen('recipeYield');
  const stand = portionenLesen(ertrag ? (ertrag.getAttribute('content') || ertrag.textContent) : null);
  const bildKnoten = holen('image');

  return {
    titel: (holen('name')?.textContent || doc.title || '').replace(/\s+/g, ' ').trim(),
    portionen: stand.portionen,
    einheit: stand.einheit,
    zutaten,
    schritte,
    bildUrl: bildKnoten ? (bildKnoten.getAttribute('src') || bildKnoten.getAttribute('content')) : null
  };
}

function rezeptAusHtml(html, url) {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  // 1. Der Königsweg: schema.org/Recipe als JSON-LD im Quelltext.
  for (const knoten of doc.querySelectorAll('script[type="application/ld+json" i]')) {
    let daten;
    try {
      daten = JSON.parse((knoten.textContent || '').trim());
    } catch {
      continue;
    }
    const r = rezeptImJson(daten);
    if (!r) continue;

    const zutaten = zutatenFlicken([]
      .concat(r.recipeIngredient || r.ingredients || [])
      .map(z => nurText(z)).filter(Boolean));
    if (!zutaten.length) continue;

    const stand = portionenLesen(r.recipeYield);
    return {
      titel: titelSaeubern(nurText(r.name || '') || doc.title || '', r.author),
      portionen: stand.portionen,
      einheit: stand.einheit,
      zutaten: zutatenMitGruppen(doc, zutaten),
      schritte: anweisungenLesen(r.recipeInstructions),
      bildUrl: bildUrlLesen(r.image),
      quelle: url,
      art: 'strukturiert'
    };
  }

  // 2. Manche Seiten nutzen noch Microdata statt JSON-LD.
  const micro = rezeptAusMicrodata(doc);
  if (micro && micro.zutaten.length) return { ...micro, quelle: url, art: 'strukturiert' };

  // 3. Letzter Versuch: den sichtbaren Text der Seite wie ein Foto behandeln.
  for (const weg of doc.querySelectorAll('script, style, nav, header, footer, aside, noscript, svg')) {
    weg.remove();
  }
  const text = (doc.body?.textContent || '').replace(/[ \t]+/g, ' ');
  const geraten = textZuRezept(text);
  if (!geraten.zutaten.length) return null;

  return { ...geraten, titel: geraten.titel || doc.title || '', quelle: url, art: 'geraten' };
}

async function bildVomNetz(bildUrl, melde) {
  if (!bildUrl) return null;
  try {
    melde('Bild wird geholt …', 0.85);
    for (const bote of BOTEN) {
      try {
        const antwort = await fetch(bote(bildUrl));
        if (!antwort.ok) continue;
        const blob = await antwort.blob();
        if (!blob.type.startsWith('image/')) continue;
        return await bildAlsBlob(blob);
      } catch { /* nächster Bote */ }
    }
  } catch { /* ohne Bild ist auch gut */ }
  return null;
}

/* ── Zustand ────────────────────────────────────────── */

const stand = {
  rezepte: [],
  kategorie: 'alle',
  suche: '',
  aktuell: null,
  zielPortionen: null,
  entwurf: null,
  mahnungWeg: false
};

let verlauf = [{ ansicht: 'liste' }];

/* ── Kleine Helfer ──────────────────────────────────── */

const $ = wahl => document.querySelector(wahl);

function el(tag, klasse, text) {
  const knoten = document.createElement(tag);
  if (klasse) knoten.className = klasse;
  if (text != null) knoten.textContent = text;
  return knoten;
}

const neueId = () => Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);

const sortiereNachTitel = (a, b) => a.titel.localeCompare(b.titel, 'de', { sensitivity: 'base' });

function sterneAnzeigen(wert) {
  const box = el('span', 'sterne');
  box.setAttribute('aria-label', STERN_TEXTE[wert] || STERN_TEXTE[0]);
  for (let i = 1; i <= 5; i++) {
    box.append(el('span', 'sterne__stern' + (i <= wert ? '' : ' sterne__stern--leer'), i <= wert ? '★' : '☆'));
  }
  return box;
}

/* ── Navigation ─────────────────────────────────────── */

const ANSICHTEN = ['liste', 'rezept', 'neu', 'formular', 'einstellungen'];

function ansichtZeigen(name) {
  for (const a of ANSICHTEN) {
    const knoten = $('#ansicht-' + a);
    knoten.hidden = a !== name;
    knoten.classList.toggle('ansicht--an', a === name);
  }
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function ziel(eintrag) {
  if (eintrag.ansicht === 'rezept') {
    const r = stand.rezepte.find(x => x.id === eintrag.id);
    if (!r) { ziel({ ansicht: 'liste' }); return; }
    stand.aktuell = r;
    stand.zielPortionen = r.portionen;
    rezeptZeichnen();
  } else if (eintrag.ansicht === 'liste') {
    listeZeichnen();
  }
  ansichtZeigen(eintrag.ansicht);
}

function navigieren(eintrag) {
  verlauf.push(eintrag);
  history.pushState(eintrag, '');
  ziel(eintrag);
}

function zurueck() {
  if (verlauf.length > 1) history.back();
  else { verlauf = [{ ansicht: 'liste' }]; ziel(verlauf[0]); }
}

window.addEventListener('popstate', () => {
  if (leisteOffen()) { leisteSchliessen(); }
  if (verlauf.length > 1) verlauf.pop();
  ziel(verlauf[verlauf.length - 1] || { ansicht: 'liste' });
});

/* ── Leiste (Handy) ─────────────────────────────────── */

const leisteOffen = () => $('#leiste').classList.contains('leiste--auf');

function leisteAuf() {
  $('#leiste').classList.add('leiste--auf');
  $('#schleier').hidden = false;
  $('#knopf-leiste').setAttribute('aria-expanded', 'true');
}

function leisteSchliessen() {
  $('#leiste').classList.remove('leiste--auf');
  $('#schleier').hidden = true;
  $('#knopf-leiste').setAttribute('aria-expanded', 'false');
}

/* ── Liste zeichnen ─────────────────────────────────── */

function gefilterteRezepte() {
  const suche = stand.suche.trim().toLowerCase();
  let liste = stand.rezepte;

  if (suche) {
    liste = liste.filter(r =>
      r.titel.toLowerCase().includes(suche) ||
      (r.zutaten || []).some(z => String(z).toLowerCase().includes(suche)) ||
      (r.notizen || '').toLowerCase().includes(suche));
  } else if (stand.kategorie !== 'alle') {
    liste = liste.filter(r => r.kategorie === stand.kategorie);
  }

  return [...liste].sort(sortiereNachTitel);
}

function kategorienZeichnen() {
  const nav = $('#kategorien');
  nav.textContent = '';

  const zaehler = {};
  for (const r of stand.rezepte) zaehler[r.kategorie] = (zaehler[r.kategorie] || 0) + 1;

  const machReiter = (key, name, bild, anzahl) => {
    const knopf = el('button', 'reiter' + (stand.kategorie === key && !stand.suche ? ' reiter--an' : ''));
    knopf.type = 'button';
    knopf.append(el('span', 'reiter__bild', bild));
    knopf.append(el('span', 'reiter__name', name));
    knopf.append(el('span', 'reiter__zahl', String(anzahl)));
    knopf.addEventListener('click', () => {
      stand.kategorie = key;
      stand.suche = '';
      $('#suche').value = '';
      leisteSchliessen();
      if (verlauf[verlauf.length - 1].ansicht !== 'liste') zurueck();
      else { listeZeichnen(); kategorienZeichnen(); }
    });
    return knopf;
  };

  nav.append(machReiter('alle', 'Alle Rezepte', '📖', stand.rezepte.length));

  for (const kat of KATEGORIEN) {
    const anzahl = zaehler[kat.key] || 0;
    if (!anzahl) continue;
    nav.append(machReiter(kat.key, kat.name, kat.bild, anzahl));
  }

  hinweisZeichnen();
}

async function hinweisZeichnen() {
  const knoten = $('#speicher-hinweis');
  const anzahl = stand.rezepte.length;
  let text = anzahl === 1 ? '1 Rezept auf diesem Gerät' : anzahl + ' Rezepte auf diesem Gerät';

  try {
    if (navigator.storage?.estimate) {
      const { usage } = await navigator.storage.estimate();
      if (usage) text += ' · ' + (usage / 1048576).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' MB';
    }
  } catch { /* Anzeige ist Beiwerk */ }

  knoten.textContent = text;
}

function listeZeichnen() {
  const liste = gefilterteRezepte();
  const raster = $('#raster');
  raster.textContent = '';

  const titel = stand.suche ? 'Suche: „' + stand.suche + '"'
    : stand.kategorie === 'alle' ? 'Alle Rezepte'
    : KAT_NACH_KEY[stand.kategorie].name;

  $('#listen-titel').textContent = titel;
  $('#listen-zahl').textContent = liste.length === 1 ? '1 Rezept' : liste.length + ' Rezepte';

  const garNichts = stand.rezepte.length === 0;
  $('#leer-hinweis').hidden = !garNichts;
  mahnungZeichnen();

  if (!liste.length && !garNichts) {
    const nichts = el('p', 'beischrift', stand.suche
      ? 'Dazu findet sich nichts. Vielleicht anders schreiben?'
      : 'In dieser Kategorie ist noch nichts.');
    raster.append(nichts);
    return;
  }

  for (const rezept of liste) {
    const karte = el('button', 'rezept-karte');
    karte.type = 'button';

    if (rezept.bild instanceof Blob) {
      const bild = el('img', 'rezept-karte__bild');
      bild.src = URL.createObjectURL(rezept.bild);
      bild.alt = '';
      bild.loading = 'lazy';
      bild.addEventListener('load', () => URL.revokeObjectURL(bild.src), { once: true });
      karte.append(bild);
    } else {
      karte.append(el('div', 'rezept-karte__band'));
    }

    const inhalt = el('div', 'rezept-karte__inhalt');
    inhalt.append(el('h3', 'rezept-karte__titel', rezept.titel));

    const zeile = el('div', 'rezept-karte__zeile');
    zeile.append(el('span', 'marke', KAT_NACH_KEY[rezept.kategorie]?.name || 'Sonstiges'));
    zeile.append(sterneAnzeigen(rezept.bewertung || 0));
    inhalt.append(zeile);

    karte.append(inhalt);
    karte.addEventListener('click', () => navigieren({ ansicht: 'rezept', id: rezept.id }));
    raster.append(karte);
  }
}

/* ── Rezept zeichnen ────────────────────────────────── */

function rezeptZeichnen() {
  const rezept = stand.aktuell;
  const wurzel = $('#ansicht-rezept');
  wurzel.textContent = '';
  if (!rezept) return;

  const basis = Math.max(1, rezept.portionen || 1);
  const zielZahl = Math.max(1, stand.zielPortionen || basis);
  const faktor = zielZahl / basis;

  // ── Kopf
  const kopf = el('div', 'karte');
  const zurueckKnopf = el('button', 'zurueck', '← Zurück');
  zurueckKnopf.type = 'button';
  zurueckKnopf.addEventListener('click', zurueck);
  kopf.append(zurueckKnopf);

  if (rezept.bild instanceof Blob) {
    const bild = el('img', 'rezept__bild');
    bild.src = URL.createObjectURL(rezept.bild);
    bild.alt = '';
    bild.addEventListener('load', () => URL.revokeObjectURL(bild.src), { once: true });
    kopf.append(bild);
  }

  kopf.append(el('h2', 'rezept__titel', rezept.titel));

  const meta = el('div', 'rezept__meta');
  meta.append(el('span', 'marke', KAT_NACH_KEY[rezept.kategorie]?.name || 'Sonstiges'));
  meta.append(sterneAnzeigen(rezept.bewertung || 0));
  meta.append(el('span', null, STERN_TEXTE[rezept.bewertung || 0]));
  kopf.append(meta);

  if (rezept.quelle) {
    const quelle = el('p', 'rezept__quelle');
    quelle.append(document.createTextNode('Quelle: '));
    if (/^https?:\/\//i.test(rezept.quelle)) {
      const link = el('a', null, rezept.quelle);
      link.href = rezept.quelle;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      quelle.append(link);
    } else {
      quelle.append(document.createTextNode(rezept.quelle));
    }
    kopf.append(quelle);
  }
  wurzel.append(kopf);

  // ── Portionsrechner
  const rechner = el('div', 'karte');
  const box = el('div', 'portionen');
  box.append(el('span', 'portionen__name', 'Ich koche für'));

  const wahl = el('div', 'portionen__wahl');
  const minus = el('button', 'portionen__knopf', '−');
  minus.type = 'button';
  minus.setAttribute('aria-label', 'Eine Portion weniger');
  minus.disabled = zielZahl <= 1;

  const zahl = el('input', 'portionen__zahl');
  zahl.type = 'number';
  zahl.min = '1';
  zahl.max = '99';
  zahl.value = String(zielZahl);
  zahl.setAttribute('aria-label', 'Gewünschte Menge');

  const plus = el('button', 'portionen__knopf', '+');
  plus.type = 'button';
  plus.setAttribute('aria-label', 'Eine Portion mehr');
  plus.disabled = zielZahl >= 99;

  const setzen = wert => {
    stand.zielPortionen = Math.max(1, Math.min(99, wert || 1));
    rezeptZeichnen();
  };
  minus.addEventListener('click', () => setzen(zielZahl - 1));
  plus.addEventListener('click', () => setzen(zielZahl + 1));
  zahl.addEventListener('change', () => setzen(parseInt(zahl.value, 10)));

  wahl.append(minus, zahl, plus);
  box.append(wahl);
  box.append(el('span', 'portionen__einheit', rezept.einheit || 'Portionen'));

  const hinweis = el('p', 'portionen__hinweis' + (faktor === 1 ? ' portionen__hinweis--still' : ''),
    'Umgerechnet — im Rezept steht ' + basis + ' ' + (rezept.einheit || 'Portionen') + '.');
  box.append(hinweis);
  rechner.append(box);
  wurzel.append(rechner);

  // ── Zutaten
  const zutatenKarte = el('div', 'karte');
  zutatenKarte.append(el('h3', 'ueberschrift', 'Zutaten'));
  const liste = el('ul', 'zutaten');

  for (const roh of rezept.zutaten || []) {
    const zutat = zutatLesen(roh);
    if (!zutat) continue;

    if (zutat.ueberschrift) {
      liste.append(el('li', 'zutaten__gruppe', zutat.ueberschrift));
      continue;
    }
    const fertig = zutatSchreiben(zutat, faktor);
    const zeile = el('li', 'zutaten__zeile');
    zeile.append(el('span', 'zutaten__menge', fertig.menge));
    zeile.append(el('span', 'zutaten__was', fertig.was));
    liste.append(zeile);
  }
  zutatenKarte.append(liste);
  wurzel.append(zutatenKarte);

  // ── Zubereitung
  if ((rezept.schritte || []).length) {
    const schritteKarte = el('div', 'karte');
    schritteKarte.append(el('h3', 'ueberschrift', 'Zubereitung'));
    const ol = el('ol', 'schritte');
    for (const schritt of rezept.schritte) ol.append(el('li', 'schritte__zeile', schritt));
    schritteKarte.append(ol);
    wurzel.append(schritteKarte);
  }

  // ── Bewertung
  const bewertungsKarte = el('div', 'karte');
  bewertungsKarte.append(el('h3', 'ueberschrift', 'Wie war es?'));
  const sterneBox = el('div', 'sterne-wahl');
  const sterneText = el('span', 'sterne-wahl__text', STERN_TEXTE[rezept.bewertung || 0]);

  for (let i = 1; i <= 5; i++) {
    const knopf = el('button', 'sterne-wahl__knopf' + (i <= (rezept.bewertung || 0) ? ' sterne-wahl__knopf--an' : ''),
      i <= (rezept.bewertung || 0) ? '★' : '☆');
    knopf.type = 'button';
    knopf.title = STERN_TEXTE[i];
    knopf.setAttribute('aria-label', i + ' von 5 — ' + STERN_TEXTE[i]);
    knopf.addEventListener('click', async () => {
      // Noch einmal auf denselben Stern tippen nimmt die Bewertung zurück.
      rezept.bewertung = rezept.bewertung === i ? 0 : i;
      rezept.geaendert = Date.now();
      await rezeptSichern(rezept);
      rezeptZeichnen();
    });
    sterneBox.append(knopf);
  }
  sterneBox.append(sterneText);
  bewertungsKarte.append(sterneBox);
  wurzel.append(bewertungsKarte);

  // ── Notizen
  const notizKarte = el('div', 'karte');
  notizKarte.append(el('h3', 'ueberschrift', 'Notizen'));
  notizKarte.append(el('p', 'beischrift', 'Was beim nächsten Mal anders soll — wird von allein gespeichert.'));

  const feld = el('textarea', 'notizfeld');
  feld.value = rezept.notizen || '';
  feld.placeholder = 'Weniger Zucker, dafür mehr Zimt …';
  feld.setAttribute('aria-label', 'Notizen zum Rezept');

  const stempel = el('p', 'notiz-stand', '');
  let uhr = null;
  feld.addEventListener('input', () => {
    clearTimeout(uhr);
    stempel.textContent = 'Wird gespeichert …';
    uhr = setTimeout(async () => {
      rezept.notizen = feld.value;
      rezept.geaendert = Date.now();
      await rezeptSichern(rezept);
      stempel.textContent = 'Gespeichert ✓';
      setTimeout(() => { stempel.textContent = ''; }, 2200);
    }, 700);
  });

  notizKarte.append(feld, stempel);
  wurzel.append(notizKarte);

  // ── Werkzeug
  const werkzeugKarte = el('div', 'karte');
  const werkzeug = el('div', 'rezept__werkzeug');

  const bearbeiten = el('button', 'knopf knopf--leise', 'Rezept bearbeiten');
  bearbeiten.type = 'button';
  bearbeiten.addEventListener('click', () => formularOeffnen(rezeptZuEntwurf(rezept), 'bearbeiten'));

  const drucken = el('button', 'knopf knopf--leise', 'Drucken');
  drucken.type = 'button';
  drucken.addEventListener('click', () => window.print());

  const loeschen = el('button', 'knopf knopf--gefahr', 'Löschen');
  loeschen.type = 'button';
  loeschen.addEventListener('click', async () => {
    if (!confirm('„' + rezept.titel + '" wirklich löschen? Das lässt sich nicht rückgängig machen.')) return;
    await rezeptLoeschen(rezept.id);
    stand.rezepte = stand.rezepte.filter(r => r.id !== rezept.id);
    verlauf = [{ ansicht: 'liste' }];
    history.replaceState(verlauf[0], '');
    kategorienZeichnen();
    ziel(verlauf[0]);
  });

  werkzeug.append(bearbeiten, drucken, loeschen);
  werkzeugKarte.append(werkzeug);
  wurzel.append(werkzeugKarte);
}

/* ── Formular ───────────────────────────────────────── */

function rezeptZuEntwurf(rezept) {
  return {
    id: rezept.id,
    titel: rezept.titel,
    kategorie: rezept.kategorie,
    portionen: rezept.portionen,
    einheit: rezept.einheit,
    zutaten: rezept.zutaten || [],
    schritte: rezept.schritte || [],
    notizen: rezept.notizen || '',
    quelle: rezept.quelle || '',
    bild: rezept.bild || null,
    bewertung: rezept.bewertung || 0,
    angelegt: rezept.angelegt
  };
}

function kategorienInAuswahl() {
  const auswahl = $('#f-kategorie');
  auswahl.textContent = '';
  for (const kat of KATEGORIEN) {
    const eintrag = el('option', null, kat.bild + '  ' + kat.name);
    eintrag.value = kat.key;
    auswahl.append(eintrag);
  }
}

function formularOeffnen(entwurf, modus, hinweis) {
  stand.entwurf = entwurf;

  $('#formular-titel').textContent = modus === 'bearbeiten' ? 'Rezept bearbeiten'
    : modus === 'geraten' ? 'Bitte kurz prüfen'
    : modus === 'strukturiert' ? 'Rezept übernehmen'
    : 'Neues Rezept';

  $('#formular-hinweis').textContent = hinweis
    || (modus === 'geraten' ? 'So habe ich das gelesen — schau bitte drüber, vor allem bei den Mengen.'
    : modus === 'strukturiert' ? 'Von der Seite übernommen. Ein prüfender Blick schadet trotzdem nicht.'
    : modus === 'bearbeiten' ? ''
    : 'Trag ein, was du hast. Ändern kannst du später alles.');

  $('#f-titel').value = entwurf.titel || '';
  $('#f-kategorie').value = entwurf.kategorie || 'sonstiges';
  $('#f-portionen').value = entwurf.portionen || 4;
  $('#f-einheit').value = entwurf.einheit || 'Portionen';
  $('#f-zutaten').value = (entwurf.zutaten || []).join('\n');
  $('#f-schritte').value = (entwurf.schritte || []).join('\n\n');
  $('#f-notizen').value = entwurf.notizen || '';
  $('#f-quelle').value = entwurf.quelle || '';
  $('#formular-fehler').hidden = true;

  const tipp = $('#f-kategorie-tipp');
  tipp.textContent = (modus === 'geraten' || modus === 'strukturiert')
    ? 'Von der App zugeordnet — bitte ändern, wenn es nicht passt.' : '';

  navigieren({ ansicht: 'formular' });
}

async function formularSpeichern(ereignis) {
  ereignis.preventDefault();

  const titel = $('#f-titel').value.trim();
  const portionen = parseInt($('#f-portionen').value, 10);
  const zutaten = $('#f-zutaten').value.split('\n').map(z => z.trim()).filter(Boolean);

  const fehler = $('#formular-fehler');
  if (!titel) { fehler.textContent = 'Das Rezept braucht noch einen Namen.'; fehler.hidden = false; return; }
  if (!portionen || portionen < 1) { fehler.textContent = 'Bitte eintragen, für wie viele das Rezept reicht.'; fehler.hidden = false; return; }
  if (!zutaten.length) { fehler.textContent = 'Ohne Zutaten wird das nichts — bitte mindestens eine eintragen.'; fehler.hidden = false; return; }

  const alt = stand.entwurf || {};
  const rezept = {
    id: alt.id || neueId(),
    titel,
    kategorie: $('#f-kategorie').value,
    portionen,
    einheit: $('#f-einheit').value,
    zutaten,
    schritte: $('#f-schritte').value.split(/\n\s*\n|\n/).map(s => s.trim()).filter(Boolean),
    notizen: $('#f-notizen').value.trim(),
    quelle: $('#f-quelle').value.trim(),
    bild: alt.bild || null,
    bewertung: alt.bewertung || 0,
    angelegt: alt.angelegt || Date.now(),
    geaendert: Date.now()
  };

  await rezeptSichern(rezept);
  await speicherFestnageln();

  const stelle = stand.rezepte.findIndex(r => r.id === rezept.id);
  if (stelle >= 0) stand.rezepte[stelle] = rezept;
  else stand.rezepte.push(rezept);

  stand.entwurf = null;
  kategorienZeichnen();

  // Nach dem Speichern direkt zum fertigen Rezept, ohne Formular im Rücken.
  verlauf = [{ ansicht: 'liste' }, { ansicht: 'rezept', id: rezept.id }];
  history.replaceState(verlauf[1], '');
  ziel(verlauf[1]);
}

/* ── Neues Rezept: die drei Wege ────────────────────── */

function arbeitZeigen(an) {
  $('#arbeit').hidden = !an;
  if (!an) $('#arbeit-fuell').style.width = '0%';
}

/** anteil = null bedeutet: Dauer unbekannt, Balken läuft durch. */
function melden(text, anteil) {
  $('#arbeit-text').textContent = text;
  const fuell = $('#arbeit-fuell');
  if (anteil == null) {
    fuell.classList.add('arbeit__fuell--laeuft');
    fuell.style.width = '100%';
  } else {
    fuell.classList.remove('arbeit__fuell--laeuft');
    fuell.style.width = Math.round(anteil * 100) + '%';
  }
}

const centText = dollar =>
  '≈ ' + (dollar * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' US-Cent';

function neuFehler(text) {
  const knoten = $('#neu-fehler');
  knoten.textContent = text;
  knoten.hidden = !text;
}

/** Fotos zu einem Rezept machen — mit Claude, wenn ein Schlüssel da ist, sonst per Texterkennung. */
async function fotoVerarbeiten(dateiListe) {
  neuFehler('');
  arbeitZeigen(true);

  // Kameradateien heißen IMG_0041, IMG_0042 … — nach Namen sortiert stimmt
  // die Reihenfolge der Buchseiten, egal wie die Auswahl sie liefert.
  const bilder = [...dateiListe].sort((a, b) =>
    String(a.name).localeCompare(String(b.name), 'de', { numeric: true }));

  try {
    const entwurf = kiSchluessel()
      ? await entwurfPerKi(bilder)
      : await entwurfPerTexterkennung(bilder);

    arbeitZeigen(false);
    formularOeffnen(entwurf.daten, 'geraten', entwurf.hinweis);
  } catch (fehler) {
    arbeitZeigen(false);
    neuFehler(fehler.message || 'Das Bild ließ sich nicht lesen.');
  }
}

async function entwurfPerKi(bilder) {
  const { rezept, kosten } = await kiRezeptLesen(bilder, melden);

  if (!rezept.zutaten || !rezept.zutaten.length) {
    throw new Error('Auf den Bildern war kein Rezept zu erkennen. Ist wirklich eins drauf?');
  }

  const stand = kiKostenBuchen(kosten);
  const unsicher = [...(rezept.zutaten || []), ...(rezept.schritte || [])]
    .some(z => String(z).includes('?'));

  return {
    daten: {
      titel: rezept.titel || 'Neues Rezept',
      kategorie: KAT_NACH_KEY[rezept.kategorie] ? rezept.kategorie : 'sonstiges',
      portionen: Math.max(1, Math.min(99, rezept.portionen || 4)),
      einheit: rezept.einheit || 'Portionen',
      zutaten: rezept.zutaten,
      schritte: rezept.schritte || [],
      notizen: rezept.notizen || '',
      quelle: bilder.length > 1 ? bilder.length + ' Fotos' : 'Foto',
      bild: await bildAlsBlob(bilder[0])
    },
    hinweis: 'Von Claude gelesen (' + centText(kosten) + '; bisher '
      + stand.anzahl + (stand.anzahl === 1 ? ' Rezept für ' : ' Rezepte für ')
      + centText(stand.summe) + '). '
      + (unsicher
        ? 'Bei den Stellen mit „?" war sich Claude unsicher — die bitte besonders ansehen.'
        : 'Ein prüfender Blick auf die Mengen schadet trotzdem nie.')
  };
}

async function entwurfPerTexterkennung(bilder) {
  let text = '';
  for (let i = 0; i < bilder.length; i++) {
    const von = i / bilder.length;
    const bis = (i + 1) / bilder.length;
    const teil = await textErkennen(bilder[i], (t, a) =>
      melden(bilder.length > 1 ? 'Bild ' + (i + 1) + ' von ' + bilder.length + ': ' + t : t,
        a == null ? null : von + a * (bis - von)));
    text += (text ? '\n' : '') + teil;
  }

  if (text.trim().length < 25) {
    throw new Error('Auf dem Bild war kaum Text zu erkennen. Versuch es mit einem schärferen Foto bei gutem Licht — oder trag das Rezept von Hand ein.');
  }

  melden('Rezept wird sortiert …', 0.97);
  const geraten = textZuRezept(text);

  return {
    daten: {
      titel: geraten.titel,
      kategorie: kategorieRaten(geraten.titel, geraten.zutaten, geraten.schritte),
      portionen: geraten.portionen || 4,
      einheit: geraten.einheit,
      zutaten: geraten.zutaten,
      schritte: geraten.schritte,
      notizen: '',
      quelle: bilder.length > 1 ? bilder.length + ' Fotos' : 'Foto',
      bild: await bildAlsBlob(bilder[0])
    },
    hinweis: 'So habe ich das gelesen. Die Texterkennung verhört sich gern — schau bitte drüber, vor allem bei den Mengen.'
  };
}

async function linkVerarbeiten(adresse) {
  neuFehler('');

  let url;
  try {
    url = new URL(adresse.trim());
    if (!/^https?:$/.test(url.protocol)) throw new Error();
  } catch {
    neuFehler('Das sieht nicht nach einer Web-Adresse aus. Sie sollte mit https:// beginnen.');
    return;
  }

  arbeitZeigen(true);
  try {
    const mitSchluessel = !!kiSchluessel();

    // Immer zuerst der kostenlose Weg. Gibt die Seite ihre Daten sauber
    // heraus, ist das nicht nur gratis, sondern auch genauer als jedes
    // Ablesen — es sind die Angaben der Seite selbst.
    // Mit Schlüssel wird nur kurz gewartet, weil Claude verlässlich dahinter
    // steht; ohne Schlüssel lohnt sich längeres Warten, weil es sonst nichts gibt.
    let entwurf = await entwurfPerBoten(url.href, mitSchluessel ? 8000 : 20000);

    if (!entwurf && mitSchluessel) {
      entwurf = await entwurfPerKiLink(url.href);
    }

    if (!entwurf) {
      throw new Error('Die Seite ließ sich nicht laden — die kostenlosen Weiterleitungsdienste antworten gerade nicht. '
        + 'Mit einem Claude-Schlüssel (Einstellungen) entfällt dieser Umweg. '
        + 'Sonst: „Rezepttext einfügen" — das geht immer.');
    }

    arbeitZeigen(false);
    formularOeffnen(entwurf.daten, 'geraten', entwurf.hinweis);
  } catch (fehler) {
    arbeitZeigen(false);
    neuFehler(fehler.message || 'Die Seite ließ sich nicht laden.');
  }
}

/** Mit Schlüssel: Claude ruft die Seite selbst ab — kein fremder Dienst dazwischen. */
async function entwurfPerKiLink(url) {
  const { rezept, kosten } = await kiRezeptVonLink(url, melden);

  if (!rezept.zutaten || !rezept.zutaten.length) {
    throw new Error('Auf dieser Seite war kein Rezept zu finden. Nimm „Rezepttext einfügen": auf der Seite alles markieren, kopieren, einfügen.');
  }

  const stand = kiKostenBuchen(kosten);
  return {
    daten: {
      titel: rezept.titel || 'Neues Rezept',
      kategorie: KAT_NACH_KEY[rezept.kategorie] ? rezept.kategorie : 'sonstiges',
      portionen: Math.max(1, Math.min(99, rezept.portionen || 4)),
      einheit: rezept.einheit || 'Portionen',
      zutaten: rezept.zutaten,
      schritte: rezept.schritte || [],
      notizen: rezept.notizen || '',
      quelle: url,
      bild: null
    },
    hinweis: 'Von Claude aus der Seite gelesen (' + centText(kosten) + '; bisher '
      + stand.anzahl + (stand.anzahl === 1 ? ' Rezept für ' : ' Rezepte für ')
      + centText(stand.summe) + '). Ein prüfender Blick schadet nie.'
  };
}

/**
 * Der kostenlose Weg über die Weiterleitungsdienste.
 * Liefert null statt eines Fehlers, wenn nichts herauskommt — dann entscheidet
 * der Aufrufer, ob Claude übernimmt.
 */
async function entwurfPerBoten(url, frist) {
  let html;
  try {
    melden('Seite wird geladen …', 0.3);
    html = await seiteHolen(url, frist);
  } catch {
    return null;
  }

  melden('Rezept wird gesucht …', 0.6);
  const gefunden = rezeptAusHtml(html, url);
  if (!gefunden || !gefunden.zutaten.length) return null;

  const bild = await bildVomNetz(gefunden.bildUrl, melden);

  return {
    daten: {
      titel: gefunden.titel,
      kategorie: kategorieRaten(gefunden.titel, gefunden.zutaten, gefunden.schritte),
      portionen: gefunden.portionen || 4,
      einheit: gefunden.einheit,
      zutaten: gefunden.zutaten,
      schritte: gefunden.schritte,
      notizen: '',
      quelle: url,
      bild
    },
    hinweis: gefunden.art === 'strukturiert'
      ? 'Direkt von der Seite übernommen — kostenlos, Claude war nicht nötig. Ein prüfender Blick schadet trotzdem nicht.'
      : 'Aus dem Seitentext geraten — kostenlos, aber ungenauer. Schau bitte drüber, vor allem bei den Mengen.'
  };
}

/**
 * Eingefügter Rezepttext. Der einzige Import-Weg, der weder Netz noch
 * fremde Dienste braucht — und deshalb die Rettung, wenn eine Seite den
 * Link-Weg verweigert.
 */
function textVerarbeiten(roh) {
  neuFehler('');

  if (roh.trim().length < 30) {
    neuFehler('Da ist noch zu wenig Text. Markier auf der Rezeptseite alles (Strg+A), kopier es und füg es hier ein.');
    return;
  }

  const geraten = textZuRezept(roh);
  if (!geraten.zutaten.length) {
    neuFehler('In dem Text war keine Zutatenliste zu erkennen. Trag das Rezept lieber von Hand ein — oder füg mehr Text ein.');
    return;
  }

  formularOeffnen({
    titel: geraten.titel,
    kategorie: kategorieRaten(geraten.titel, geraten.zutaten, geraten.schritte),
    portionen: geraten.portionen || 4,
    einheit: geraten.einheit,
    zutaten: geraten.zutaten,
    schritte: geraten.schritte,
    notizen: '',
    quelle: '',
    bild: null
  }, 'geraten');
}

/* ── Einstellungen ──────────────────────────────────── */

function einstellungenZeichnen() {
  const hat = !!kiSchluessel();

  const liste = $('#verfahren-liste');
  liste.textContent = '';

  const machKarte = (an, titel, text) => {
    const karte = el('div', 'verfahren__karte' + (an ? ' verfahren__karte--an' : ''));
    karte.append(el('span', 'verfahren__marke', an ? '● Wird benutzt' : 'aus'));
    karte.append(el('h4', 'verfahren__titel', titel));
    karte.append(el('p', 'verfahren__text', text));
    return karte;
  };

  liste.append(machKarte(hat, 'Claude liest mit',
    'Liest auch Handschrift, schiefe Fotos und Seiten im Schatten. Erkennt „Für den Teig" von allein und setzt die Kategorie selbst. Kostet ungefähr 5 US-Cent pro Rezept und braucht Netz.'));
  liste.append(machKarte(!hat, 'Texterkennung auf dem Gerät',
    'Kostenlos, offline, kein Konto. Liest sauber gedruckten Text ordentlich — Handschrift gar nicht.'));

  $('#f-schluessel').value = '';
  $('#schluessel-fehler').hidden = true;

  const stand = $('#schluessel-stand');
  if (!hat) {
    stand.textContent = 'Zurzeit ist kein Schlüssel hinterlegt — Fotos werden auf dem Gerät gelesen.';
    return;
  }

  const s = kiSchluessel();
  let text = 'Hinterlegt: sk-ant-…' + s.slice(-4) + '.';
  try {
    const k = JSON.parse(localStorage.getItem(KI_KOSTEN_FACH) || '{"summe":0,"anzahl":0}');
    if (k.anzahl) {
      text += ' Bisher ' + k.anzahl + (k.anzahl === 1 ? ' Rezept' : ' Rezepte')
        + ' gelesen, zusammen ' + centText(k.summe) + '.';
    }
  } catch { /* Anzeige ist Beiwerk */ }
  stand.textContent = text;
}

/** Zeigt an den Knöpfen, was gerade passieren würde. */
function verfahrenMarkeZeichnen() {
  const hat = !!kiSchluessel();

  const foto = $('#foto-verfahren');
  if (foto) {
    foto.textContent = hat ? 'Claude liest mit — auch Handschrift' : 'Texterkennung auf dem Gerät — keine Handschrift';
    foto.className = 'weg__marke' + (hat ? ' weg__marke--ki' : '');
  }

  const link = $('#link-verfahren');
  if (link) {
    link.textContent = hat
      ? 'Erst kostenlos — nur wenn das scheitert, fragt Claude (~9 Cent)'
      : 'Über fremde Dienste — fällt öfter aus';
    link.className = 'weg__marke' + (hat ? ' weg__marke--ki' : '');
  }
}

function schluesselSichern() {
  const feld = $('#f-schluessel');
  const fehler = $('#schluessel-fehler');
  const wert = feld.value.trim();

  if (!wert) { fehler.textContent = 'Da steht noch nichts.'; fehler.hidden = false; return; }
  if (!/^sk-ant-\S{20,}$/.test(wert)) {
    fehler.textContent = 'Das sieht nicht nach einem Claude-Schlüssel aus. Er beginnt mit „sk-ant-" und ist deutlich länger.';
    fehler.hidden = false;
    return;
  }

  try {
    localStorage.setItem(KI_SCHLUESSEL_FACH, wert);
  } catch {
    fehler.textContent = 'Der Schlüssel ließ sich nicht speichern. Ist der Browser-Speicher gesperrt?';
    fehler.hidden = false;
    return;
  }

  einstellungenZeichnen();
  verfahrenMarkeZeichnen();
  $('#schluessel-stand').textContent = 'Gespeichert ✓ ' + $('#schluessel-stand').textContent;
}

function schluesselLoeschen() {
  if (!kiSchluessel()) return;
  if (!confirm('Schlüssel entfernen? Fotos werden dann wieder auf dem Gerät gelesen — ohne Handschrift.')) return;
  try { localStorage.removeItem(KI_SCHLUESSEL_FACH); } catch { /* egal */ }
  einstellungenZeichnen();
  verfahrenMarkeZeichnen();
}

/* ── Sicherung ──────────────────────────────────────────
   Ein Browser darf keine Dateien von allein aufs Gerät
   schreiben — weder beim Start noch sonst. Auf Android gibt
   es dafür überhaupt keinen Weg (die File System Access API
   kennt kein mobiler Browser). Deshalb erinnert die App,
   statt es heimlich zu versuchen.
   ────────────────────────────────────────────────────── */

const SICHERUNG_FACH = 'muemmelkueche.letzteSicherung';

function letzteSicherung() {
  try { return JSON.parse(localStorage.getItem(SICHERUNG_FACH) || 'null'); } catch { return null; }
}

function sicherungBuchen() {
  try { localStorage.setItem(SICHERUNG_FACH, JSON.stringify({ zeit: Date.now() })); } catch { /* egal */ }
  mahnungZeichnen();
}

/** Wie viele Rezepte haben sich seit der letzten Sicherung geändert? */
function ungesichertZahl() {
  const s = letzteSicherung();
  const seit = s ? s.zeit : 0;
  return stand.rezepte.filter(r => (r.geaendert || r.angelegt || 0) > seit).length;
}

const TAG = 86400000;

function mahnungZeichnen() {
  const kasten = $('#mahnung');
  if (!kasten) return;

  const offen = ungesichertZahl();
  const s = letzteSicherung();
  const tage = s ? Math.floor((Date.now() - s.zeit) / TAG) : Infinity;

  // Beim allerersten Rezept sofort erinnern (tage ist dann unendlich): Dann
  // lernt sie früh, dass die Rezepte nur hier liegen — solange wenig auf dem
  // Spiel steht. Danach nicht mehr bei jeder Kleinigkeit nerven: erst ab drei
  // Änderungen, oder wenn die letzte Sicherung zwei Wochen her ist.
  // Hat sich seit der Sicherung nichts getan, bleibt sie immer still.
  const noetig = offen >= 3 || (offen >= 1 && tage >= 14);
  if (!noetig || stand.mahnungWeg) { kasten.hidden = true; return; }

  $('#mahnung-titel').textContent = s
    ? offen + (offen === 1 ? ' Rezept ist ungesichert.' : ' Rezepte sind ungesichert.')
    : 'Noch nie gesichert.';

  $('#mahnung-satz').textContent = s
    ? 'Letzte Sicherung vor ' + (tage === 0 ? 'weniger als einem Tag' : tage === 1 ? 'einem Tag' : tage + ' Tagen')
      + '. Die Rezepte liegen nur auf diesem Gerät.'
    : 'Die Rezepte liegen nur auf diesem Gerät. Löscht der Browser seine Daten, sind sie weg.';

  kasten.hidden = false;
}

/* ── Sicherung schreiben ────────────────────────────── */

const blobZuText = blob => new Promise(gut => {
  const leser = new FileReader();
  leser.onload = () => gut(leser.result);
  leser.readAsDataURL(blob);
});

async function textZuBlob(text) {
  try {
    const antwort = await fetch(text);
    return await antwort.blob();
  } catch {
    return null;
  }
}

async function sicherungSpeichern() {
  const rezepte = await alleRezepte();
  const paket = { app: 'Mones Mümmelküche', version: 1, stand: new Date().toISOString(), rezepte: [] };

  for (const r of rezepte) {
    const kopie = { ...r };
    kopie.bild = r.bild instanceof Blob ? await blobZuText(r.bild) : null;
    paket.rezepte.push(kopie);
  }

  const blob = new Blob([JSON.stringify(paket)], { type: 'application/json' });
  const heute = new Date().toISOString().slice(0, 10);
  const name = 'muemmelkueche-' + heute + '.json';

  // Auf dem Handy führt der Teilen-Dialog die Datei mit einem Tipp nach
  // Google Drive oder in eine Mail — dort liegt sie sicherer als im
  // Download-Ordner desselben Geräts, das kaputtgehen kann.
  const datei = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [datei] })) {
    try {
      await navigator.share({ files: [datei], title: 'Mones Mümmelküche — Sicherung' });
      sicherungBuchen();
      return;
    } catch (fehler) {
      // Abgebrochen heißt: nicht gesichert. Nicht als erledigt verbuchen.
      if (fehler && fehler.name === 'AbortError') return;
      // Alles andere: normal herunterladen.
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  sicherungBuchen();
}

async function sicherungLaden(datei) {
  let paket;
  try {
    paket = JSON.parse(await datei.text());
  } catch {
    alert('Diese Datei ließ sich nicht lesen. Ist es die richtige Sicherung?');
    return;
  }

  if (!paket || !Array.isArray(paket.rezepte)) {
    alert('In der Datei stecken keine Rezepte.');
    return;
  }

  let neu = 0;
  let ersetzt = 0;

  for (const roh of paket.rezepte) {
    if (!roh || !roh.titel) continue;
    const rezept = { ...roh };
    rezept.id = rezept.id || neueId();
    rezept.bild = typeof roh.bild === 'string' && roh.bild.startsWith('data:')
      ? await textZuBlob(roh.bild) : null;

    const vorhanden = stand.rezepte.findIndex(r => r.id === rezept.id);
    await rezeptSichern(rezept);
    if (vorhanden >= 0) { stand.rezepte[vorhanden] = rezept; ersetzt++; }
    else { stand.rezepte.push(rezept); neu++; }
  }

  await speicherFestnageln();
  kategorienZeichnen();
  listeZeichnen();
  alert('Fertig: ' + neu + ' neu dazugekommen, ' + ersetzt + ' aufgefrischt.');
}

/** Bittet den Browser, die Rezepte nicht bei Platzmangel wegzuräumen. */
async function speicherFestnageln() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch { /* nicht überall möglich */ }
}

/* ── Verdrahtung ────────────────────────────────────── */

function verdrahten() {
  $('#knopf-leiste').addEventListener('click', () => leisteOffen() ? leisteSchliessen() : leisteAuf());
  $('#schleier').addEventListener('click', leisteSchliessen);

  $('#knopf-neu').addEventListener('click', () => {
    neuFehler('');
    arbeitZeigen(false);
    $('#link-block').hidden = true;
    $('#text-block').hidden = true;
    navigieren({ ansicht: 'neu' });
    ansichtZeigen('neu');
  });

  for (const knopf of document.querySelectorAll('[data-zurueck]')) {
    knopf.addEventListener('click', zurueck);
  }

  $('#suche').addEventListener('input', ereignis => {
    stand.suche = ereignis.target.value;
    if (verlauf[verlauf.length - 1].ansicht !== 'liste') { zurueck(); }
    listeZeichnen();
    kategorienZeichnen();
  });

  // Weg 1: Fotos
  $('#weg-foto').addEventListener('click', () => $('#datei-foto').click());
  $('#datei-foto').addEventListener('change', ereignis => {
    const dateien = [...ereignis.target.files];
    ereignis.target.value = '';
    if (dateien.length) fotoVerarbeiten(dateien);
  });

  // Einstellungen
  $('#knopf-einstellungen').addEventListener('click', () => {
    leisteSchliessen();
    einstellungenZeichnen();
    navigieren({ ansicht: 'einstellungen' });
    ansichtZeigen('einstellungen');
  });
  $('#schluessel-sichern').addEventListener('click', schluesselSichern);
  $('#schluessel-loeschen').addEventListener('click', schluesselLoeschen);

  // Weg 2: Link
  $('#weg-link').addEventListener('click', () => {
    $('#link-block').hidden = false;
    $('#text-block').hidden = true;
    neuFehler('');
    $('#link-eingabe').focus();
  });

  // Weg 3: Text einfügen
  $('#weg-text').addEventListener('click', () => {
    $('#text-block').hidden = false;
    $('#link-block').hidden = true;
    neuFehler('');
    $('#text-eingabe').focus();
  });
  $('#text-lesen').addEventListener('click', () => textVerarbeiten($('#text-eingabe').value));
  $('#link-holen').addEventListener('click', () => linkVerarbeiten($('#link-eingabe').value));
  $('#link-eingabe').addEventListener('keydown', ereignis => {
    if (ereignis.key === 'Enter') { ereignis.preventDefault(); linkVerarbeiten($('#link-eingabe').value); }
  });

  // Weg 4: Von Hand
  $('#weg-hand').addEventListener('click', () => formularOeffnen({
    titel: '', kategorie: 'sonstiges', portionen: 4, einheit: 'Portionen',
    zutaten: [], schritte: [], notizen: '', quelle: '', bild: null
  }, 'neu'));

  $('#formular').addEventListener('submit', formularSpeichern);

  // Sicherung
  $('#knopf-export').addEventListener('click', sicherungSpeichern);
  $('#mahnung-sichern').addEventListener('click', sicherungSpeichern);
  $('#mahnung-weg').addEventListener('click', () => {
    // Nur für diesen Besuch weg — beim nächsten Öffnen fragt sie wieder.
    stand.mahnungWeg = true;
    mahnungZeichnen();
  });
  $('#knopf-import').addEventListener('click', () => $('#datei-sicherung').click());
  $('#datei-sicherung').addEventListener('change', ereignis => {
    const datei = ereignis.target.files[0];
    ereignis.target.value = '';
    if (datei) sicherungLaden(datei);
  });

  // Kategorie beim Tippen des Namens vorschlagen, solange niemand selbst gewählt hat.
  let handverlesen = false;
  $('#f-kategorie').addEventListener('change', () => { handverlesen = true; });
  $('#f-titel').addEventListener('input', () => {
    if (handverlesen || !stand.entwurf) return;
    const geraten = kategorieRaten($('#f-titel').value, [], []);
    if (geraten !== 'sonstiges') $('#f-kategorie').value = geraten;
  });
  $('#formular').addEventListener('reset', () => { handverlesen = false; });
}

/* ── Geteilter Link ─────────────────────────────────────
   Auf dem Handy kann man in Chrome auf „Teilen" tippen und
   die Mümmelküche auswählen; Android hängt die Adresse dann
   als ?url=… an (siehe share_target im Manifest).
   ────────────────────────────────────────────────────── */
function geteiltesAufnehmen() {
  const felder = new URLSearchParams(location.search);
  const roh = felder.get('url') || felder.get('text') || '';
  const treffer = /https?:\/\/[^\s"'<>]+/.exec(roh);
  if (!treffer) return false;

  // Die Adresse wieder aus der Zeile nehmen, sonst startet ein
  // Neuladen denselben Import noch einmal.
  history.replaceState(verlauf[0], '', location.pathname);

  navigieren({ ansicht: 'neu' });
  ansichtZeigen('neu');
  $('#link-block').hidden = false;
  $('#link-eingabe').value = treffer[0];
  linkVerarbeiten(treffer[0]);
  return true;
}

/* ── Start ──────────────────────────────────────────── */

async function starten() {
  kategorienInAuswahl();
  verdrahten();
  history.replaceState(verlauf[0], '');

  try {
    stand.rezepte = await alleRezepte();
  } catch (fehler) {
    stand.rezepte = [];
    console.error('Der Rezeptspeicher ließ sich nicht öffnen:', fehler);
  }

  kategorienZeichnen();
  listeZeichnen();
  verfahrenMarkeZeichnen();
  geteiltesAufnehmen();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => { /* ohne Offline-Betrieb läuft's auch */ });
    });
  }
}

starten();
