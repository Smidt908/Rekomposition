/* ── Rekomposition ──────────────────────────────────────
   Körperzusammensetzung verfolgen. Alles lokal, keine Cloud,
   keine Abhängigkeiten.

   Messwerte liegen in localStorage (klein, synchron lesbar),
   Fotos in IndexedDB (Blobs, viel zu groß für localStorage).
   ────────────────────────────────────────────────────── */

'use strict';

const STORE_KEY = 'rekomposition.v1';
const BACKUP_KEY = 'rekomposition.v1.beschaedigt';

// Bewusst ohne persönliche Werte: Diese Dateien liegen öffentlich beim Hoster.
// Körpergröße und Zielwerte stellst du in der App unter "Einstellungen" ein,
// die Messungen bleiben ohnehin nur lokal auf dem Gerät.
// Die Vorgaben unten sind allgemeine Richtwerte für Männer: 94 cm gilt als
// Schwelle zum erhöhten Risiko, die Taille sollte unter der halben Körpergröße
// liegen, 15–18 % Körperfett ist die Zone "fit/schlank".
const DEFAULTS = {
  version: 1,
  settings: {
    heightCm: 180,
    targets: { waistFirst: 94, waistLong: 90, bfLow: 15, bfHigh: 18 }
  },
  entries: []
};

/** Abstand zwischen zwei Taillenmessungen, ab dem erinnert wird. */
const MESS_INTERVALL_TAGE = 28;

/* ── Messgrößen ────────────────────────────────────────── */

const METRICS = {
  bf:     { label: 'Körperfett', unit: '%',  digits: 1, dir: 'down', pick: e => e.d.bf },
  weight: { label: 'Gewicht',    unit: 'kg', digits: 2, dir: 'down', pick: e => e.weight, trend: true },
  waist:  { label: 'Taille',     unit: 'cm', digits: 1, dir: 'down', pick: e => e.waist },
  fat:    { label: 'Fettmasse',  unit: 'kg', digits: 1, dir: 'down', pick: e => e.d.fatMass },
  lean:   { label: 'Magermasse', unit: 'kg', digits: 1, dir: 'up',   pick: e => e.d.leanMass }
};

const HINTS = {
  bf: 'Der Leitwert. Aus Hals, Taille und Größe gerechnet — nur wo eine Taille eingetragen ist, gibt es einen Punkt.',
  weight: 'Schwankt täglich um 1–2 kg durch Wasser und Darminhalt. Lies die Linie, nicht den Punkt — die gestrichelte Linie ist der geglättete Trend.',
  waist: 'Dein bester reiner Fett-Indikator: Muskeln machen den Bauch nicht breiter, Fett schon.',
  fat: 'Das, was tatsächlich weg soll.',
  lean: 'Muskeln, Knochen, Organe, Wasser. Diese Linie soll flach bleiben oder steigen — dann hältst du deine Muskulatur.'
};

/* ── Zustand ───────────────────────────────────────────── */

// state wird erst in init() geladen, nicht hier. Ein Aufruf an dieser Stelle
// läuft, bevor die const-Hilfsfunktionen weiter unten initialisiert sind, und
// scheitert mit "Cannot access 'isDate' before initialization".
let state;
let metric = 'bf';
let page = 'messen';
let editingId = null;
let installEvent = null;

// Fotos: Blobs liegen in IndexedDB, hier nur die IDs für synchrones Rendern.
const photoIds = new Set();
let pendingPhoto = null;    // neu gewähltes Foto, noch nicht gespeichert
let photoCleared = false;   // vorhandenes Foto beim Bearbeiten entfernt
let formPhotoUrl = null;
const photoUrlCache = new Map();

/* ── Speicher: Messwerte ───────────────────────────────── */

function load() {
  const raw = localStorage.getItem(STORE_KEY);
  if (!raw) return structuredClone(DEFAULTS);

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    // Bewusst nur um JSON.parse herum: Fängt man hier alles ab, verschluckt
    // der Block auch Programmierfehler, macht mit leeren Vorgaben weiter und
    // der nächste save() überschreibt die vorhandenen Messungen. Genau so
    // gingen schon einmal Daten verloren. Programmierfehler sollen deshalb
    // laut scheitern; kaputte Daten werden vor dem Verwerfen gesichert.
    console.error('Gespeicherte Daten unlesbar, Sicherung angelegt.', err);
    try { localStorage.setItem(BACKUP_KEY, raw); } catch (e) { /* Speicher voll */ }
    return structuredClone(DEFAULTS);
  }

  return {
    version: 1,
    settings: {
      heightCm: num(parsed?.settings?.heightCm) ?? DEFAULTS.settings.heightCm,
      targets: { ...DEFAULTS.settings.targets, ...(parsed?.settings?.targets || {}) }
    },
    entries: Array.isArray(parsed?.entries) ? parsed.entries.map(cleanEntry).filter(Boolean) : []
  };
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error(err);
    toast('Speichern fehlgeschlagen — Speicher voll?');
  }
}

function cleanEntry(e) {
  if (!e || !isDate(e.date)) return null;
  return {
    id: e.id || uid(),
    date: e.date,
    weight: num(e.weight),
    waist: num(e.waist),
    neck: num(e.neck),
    note: typeof e.note === 'string' ? e.note : ''
  };
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

/* ── Speicher: Fotos (IndexedDB) ───────────────────────── */

const DB_NAME = 'rekomposition-fotos';
const DB_STORE = 'fotos';
let dbPromise = null;

function db() {
  if (!dbPromise) {
    dbPromise = new Promise((res, rej) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(DB_STORE)) req.result.createObjectStore(DB_STORE);
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }
  return dbPromise;
}

function tx(mode, fn) {
  return db().then(d => new Promise((res, rej) => {
    const t = d.transaction(DB_STORE, mode);
    const req = fn(t.objectStore(DB_STORE));
    t.oncomplete = () => res(req ? req.result : undefined);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  }));
}

const photoPut = (id, blob) => tx('readwrite', s => s.put(blob, id));
const photoGet = id => tx('readonly', s => s.get(id));
const photoDel = id => tx('readwrite', s => s.delete(id));
const photoAllKeys = () => tx('readonly', s => s.getAllKeys());
const photoClear = () => tx('readwrite', s => s.clear());

async function photoUrl(id) {
  if (photoUrlCache.has(id)) return photoUrlCache.get(id);
  const blob = await photoGet(id);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  photoUrlCache.set(id, url);
  return url;
}

function forgetPhotoUrl(id) {
  const url = photoUrlCache.get(id);
  if (url) { URL.revokeObjectURL(url); photoUrlCache.delete(id); }
}

/**
 * Verkleinert und komprimiert ein Foto vor dem Speichern. Der Umweg über
 * Canvas kodiert das Bild neu und wirft dabei sämtliche EXIF-Daten weg —
 * inklusive GPS-Position. Die Drehung wird vorher aus dem EXIF übernommen,
 * sonst lägen Hochformat-Aufnahmen quer.
 */
async function shrinkImage(file, maxPx = 1400, quality = 0.82) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise((res, rej) => {
    canvas.toBlob(b => b ? res(b) : rej(new Error('Bild konnte nicht umgewandelt werden')), 'image/jpeg', quality);
  });
}

/* ── Zahlen ────────────────────────────────────────────── */

/** Akzeptiert deutsche Eingabe: "82,50" wie "82.50". */
function num(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v).trim().replace(/\s/g, '');
  if (!s) return null;
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '');  // 1.234,5
  s = s.replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/** Deutsche Ausgabe mit Komma. */
function fmt(n, digits = 1) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtBytes(b) {
  if (!Number.isFinite(b)) return '—';
  if (b < 1048576) return `${fmt(b / 1024, 0)} KB`;
  if (b < 1073741824) return `${fmt(b / 1048576, 1)} MB`;
  return `${fmt(b / 1073741824, 1)} GB`;
}

function fmtDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function fmtDateShort(iso) {
  const [, m, d] = iso.split('-');
  return `${d}.${m}.`;
}

const todayISO = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

const daysSince = iso => Math.floor((Date.parse(todayISO()) - Date.parse(iso)) / 86400000);

/* ── Navy-Formel (Männer) ──────────────────────────────── */

function navyBf(waist, neck, height) {
  if (waist == null || neck == null || !height) return null;
  const diff = waist - neck;
  if (diff <= 0) return null;
  const v = 1.0324 - 0.19077 * Math.log10(diff) + 0.15456 * Math.log10(height);
  if (v <= 0) return null;
  const bf = 495 / v - 450;
  return bf > 0 && bf < 70 ? bf : null;
}

/**
 * Reichert Einträge um die abgeleiteten Werte an.
 * Der Hals bleibt über Monate praktisch konstant, deshalb wird der letzte
 * bekannte Wert fortgeschrieben — sonst gäbe es kein Körperfett für Messungen,
 * bei denen nur Gewicht und Taille notiert wurden.
 */
function decorate(entries, height) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  let lastNeck = null;
  return sorted.map(e => {
    if (e.neck != null) lastNeck = e.neck;
    const neck = e.neck ?? lastNeck;
    const bf = navyBf(e.waist, neck, height);
    const fatMass = (bf != null && e.weight != null) ? e.weight * bf / 100 : null;
    const leanMass = fatMass != null ? e.weight - fatMass : null;
    const whtr = (e.waist != null && height) ? e.waist / height : null;
    return { ...e, d: { bf, fatMass, leanMass, whtr, neckUsed: neck, neckCarried: e.neck == null && neck != null } };
  });
}

/** Zielgewicht bei gegebenem Körperfettanteil, auf Basis der Magermasse. */
function weightAtBf(leanMass, bfPct) {
  if (leanMass == null) return null;
  return leanMass / (1 - bfPct / 100);
}

function latestLean(rows) {
  for (let i = rows.length - 1; i >= 0; i--) if (rows[i].d.leanMass != null) return rows[i].d.leanMass;
  return null;
}

/** Zielbereiche pro Messgröße für die Ziellinien im Diagramm. */
function targetsFor(key, rows) {
  const t = state.settings.targets;
  const lean = latestLean(rows);
  switch (key) {
    case 'bf':
      return { band: [t.bfLow, t.bfHigh], lines: [{ v: t.bfHigh, label: `Ziel ${fmt(t.bfHigh, 0)} %` }] };
    case 'waist':
      return { lines: [
        { v: t.waistFirst, label: `Etappe ${fmt(t.waistFirst, 0)}` },
        { v: t.waistLong, label: `Ziel ${fmt(t.waistLong, 0)}` }
      ] };
    case 'weight': {
      const hi = weightAtBf(lean, t.bfHigh), lo = weightAtBf(lean, t.bfLow);
      if (lo == null) return {};
      return { band: [lo, hi], lines: [{ v: hi, label: `Ziel ${fmt(hi, 0)} kg` }] };
    }
    case 'fat': {
      const hi = weightAtBf(lean, t.bfHigh), lo = weightAtBf(lean, t.bfLow);
      if (lo == null) return {};
      return { band: [lo * t.bfLow / 100, hi * t.bfHigh / 100] };
    }
    case 'lean':
      return lean == null ? {} : { lines: [{ v: lean, label: 'halten' }] };
    default:
      return {};
  }
}

/* ── Seiten ────────────────────────────────────────────── */

const $ = id => document.getElementById(id);

function showPage(name) {
  page = name;
  document.querySelectorAll('.page').forEach(p => { p.hidden = p.dataset.page !== name; });
  document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.page === name)));
  // Das Diagramm misst die Breite seines Rahmens. Auf einer versteckten Seite
  // ist die 0, deshalb erst jetzt zeichnen.
  if (name === 'fortschritt') renderChart(decorate(state.entries, state.settings.heightCm));
  window.scrollTo(0, 0);
}

/* ── Rendern ───────────────────────────────────────────── */

function render() {
  const rows = decorate(state.entries, state.settings.heightCm);
  renderReminder(rows);
  renderReading(rows);
  renderGoals(rows);
  renderChips();
  renderChart(rows);
  renderLedger(rows);
  renderSettings(rows);
  renderStorage();
}

function renderReminder(rows) {
  const el = $('reminder');
  if (!rows.length) { el.hidden = true; return; }

  const lastWaist = [...rows].reverse().find(r => r.waist != null);
  if (!lastWaist) {
    el.hidden = false;
    el.innerHTML = 'Trag einmal <b>Taille und Hals</b> ein — erst dann kann die App dein Körperfett berechnen.';
    return;
  }

  const tage = daysSince(lastWaist.date);
  if (tage >= MESS_INTERVALL_TAGE) {
    el.hidden = false;
    el.innerHTML = `Deine letzte Taillenmessung ist <b>${tage} Tage</b> her — Zeit für Taille und ein neues Foto.`;
  } else {
    el.hidden = true;
  }
}

function renderReading(rows) {
  const last = rows[rows.length - 1];
  $('lastMeasured').textContent = last ? fmtDate(last.date) : 'noch keine Messung';

  if (!last) {
    $('leadBf').textContent = '—';
    $('leadBfDelta').className = 'delta';
    $('leadBfDelta').textContent = '';
    $('readout').innerHTML = '';
    $('readingNote').textContent = 'Stell zuerst deine Körpergröße unter „Einstellungen“ ein — ohne sie lässt sich das Körperfett nicht berechnen. Danach trägst du oben deine erste Messung ein.';
    return;
  }

  $('leadBf').textContent = last.d.bf != null ? fmt(last.d.bf, 1) : '—';
  setDelta($('leadBfDelta'), delta(rows, 'bf'), METRICS.bf);

  $('readout').innerHTML = ['weight', 'waist', 'lean'].map(key => {
    const m = METRICS[key];
    return `<div class="cell">
      <span class="cell-label">${m.label}</span>
      <span class="cell-value">${fmt(m.pick(last), m.digits)}<span class="u">${m.unit}</span></span>
      ${deltaHtml(delta(rows, key), m)}
    </div>`;
  }).join('');

  $('readingNote').textContent = readingNote(rows, last);
}

function readingNote(rows, last) {
  const parts = [];
  if (last.d.whtr != null) {
    const ok = last.d.whtr < 0.5;
    parts.push(`Taille/Größe ${fmt(last.d.whtr, 2)} — ${ok ? 'unter 0,50, das ist die gesunde Zone.' : 'Ziel ist unter 0,50.'}`);
  }
  const dw = delta(rows, 'waist'), dl = delta(rows, 'lean');
  if (dw != null && dl != null) {
    if (dw < -0.2 && dl > -0.3) parts.push('Taille runter, Magermasse gehalten — genau das ist gelungene Rekomposition.');
    else if (dw < -0.2 && dl <= -0.3) parts.push('Taille runter, aber auch Magermasse — achte auf Eiweiß und Krafttraining.');
  }
  if (last.d.neckCarried) parts.push('Halsumfang aus der letzten Messung übernommen.');
  return parts.join(' ');
}

/** Veränderung zur letzten Messung, die diese Größe überhaupt hat. */
function delta(rows, key) {
  const vals = rows.map(METRICS[key].pick);
  let last = null, prev = null;
  for (let i = vals.length - 1; i >= 0; i--) {
    if (vals[i] == null) continue;
    if (last === null) last = vals[i];
    else { prev = vals[i]; break; }
  }
  return (last != null && prev != null) ? last - prev : null;
}

function deltaClass(d, m) {
  if (d == null) return 'flat';
  const eps = m.digits >= 2 ? 0.005 : 0.05;
  if (Math.abs(d) < eps) return 'flat';
  return (m.dir === 'down') === (d < 0) ? 'good' : 'bad';
}

function deltaText(d, m) {
  if (d == null) return '';
  const sign = d > 0 ? '+' : d < 0 ? '−' : '±';
  return `${sign}${fmt(Math.abs(d), m.digits)}`;
}

function setDelta(el, d, m) {
  el.className = `delta ${deltaClass(d, m)}`;
  el.textContent = deltaText(d, m);
}

function deltaHtml(d, m) {
  if (d == null) return '<span class="delta"></span>';
  return `<span class="delta ${deltaClass(d, m)}">${deltaText(d, m)}</span>`;
}

/* ── Zielbalken ────────────────────────────────────────── */

function renderGoals(rows) {
  const t = state.settings.targets;
  if (!rows.length) { $('goals').innerHTML = '<p class="empty">Noch keine Messung.</p>'; return; }

  const bars = [];
  const waistNow = lastOf(rows, 'waist'), waistStart = firstOf(rows, 'waist');
  if (waistNow != null && waistStart != null) bars.push(bar('Taille', waistStart, waistNow, t.waistLong, 'cm', 1));

  const bfNow = lastOf(rows, 'bf'), bfStart = firstOf(rows, 'bf');
  if (bfNow != null && bfStart != null) bars.push(bar('Körperfett', bfStart, bfNow, t.bfHigh, '%', 1));

  $('goals').innerHTML = bars.length ? bars.join('')
    : '<p class="empty">Trag eine Taille ein, dann erscheinen hier die Zielbalken.</p>';
}

function bar(name, start, now, target, unit, digits) {
  const span = start - target;
  const pct = span <= 0 ? (now <= target ? 100 : 0) : Math.max(0, Math.min(100, (start - now) / span * 100));
  const left = now - target;
  return `<div class="goal">
    <div class="goal-head">
      <span class="goal-name">${name}</span>
      <span class="goal-num"><b>${fmt(now, digits)}</b> ${unit} ${left <= 0 ? '· erreicht' : `· noch ${fmt(left, digits)}`}</span>
    </div>
    <div class="track"><div class="fill" style="width:${pct.toFixed(1)}%"></div></div>
    <div class="goal-foot"><span>Start ${fmt(start, digits)}</span><span>Ziel ${fmt(target, digits)}</span></div>
  </div>`;
}

const firstOf = (rows, key) => { for (const r of rows) { const v = METRICS[key].pick(r); if (v != null) return v; } return null; };
const lastOf = (rows, key) => { for (let i = rows.length - 1; i >= 0; i--) { const v = METRICS[key].pick(rows[i]); if (v != null) return v; } return null; };

/* ── Diagramm ──────────────────────────────────────────── */

function renderChips() {
  $('metricChips').innerHTML = Object.entries(METRICS)
    .map(([key, m]) => `<button class="chip" role="tab" data-metric="${key}" aria-selected="${key === metric}">${m.label}</button>`)
    .join('');
}

function renderChart(rows) {
  const svg = $('chart');
  const wrap = svg.parentElement;
  const W = wrap.clientWidth;
  if (!W) return;  // Seite gerade unsichtbar — showPage() zeichnet dann neu.

  const m = METRICS[metric];
  const pts = rows.map(r => ({ x: Date.parse(r.date), y: m.pick(r), row: r })).filter(p => p.y != null);

  $('chartHint').textContent = HINTS[metric] || '';

  if (pts.length < 2) {
    svg.hidden = true;
    $('chartEmpty').hidden = false;
    $('chartEmpty').textContent = pts.length === 0
      ? `Für ${m.label} gibt es noch keine Werte.`
      : 'Noch zu wenig Daten — trag eine zweite Messung ein, dann zeichne ich die Linie.';
    return;
  }
  svg.hidden = false;
  $('chartEmpty').hidden = true;

  const H = 210;
  const pad = { t: 14, r: 12, b: 24, l: 38 };
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);

  const tg = targetsFor(metric, rows);

  // Wertebereich: Daten plus Ziellinien, mit Luft nach oben und unten.
  const ys = pts.map(p => p.y);
  if (tg.band) ys.push(...tg.band);
  if (tg.lines) ys.push(...tg.lines.map(l => l.v));
  let lo = Math.min(...ys), hi = Math.max(...ys);
  if (hi - lo < 1e-6) { lo -= 1; hi += 1; }
  const padY = (hi - lo) * 0.14;
  lo -= padY; hi += padY;

  const xs = pts.map(p => p.x);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const sx = t => pad.l + (x1 === x0 ? (W - pad.l - pad.r) / 2 : (t - x0) / (x1 - x0) * (W - pad.l - pad.r));
  const sy = v => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);

  const parts = [];

  if (tg.band) {
    const [a, b] = [sy(Math.max(...tg.band)), sy(Math.min(...tg.band))];
    parts.push(`<rect class="target-band" x="${pad.l}" y="${a.toFixed(1)}" width="${(W - pad.l - pad.r).toFixed(1)}" height="${Math.abs(b - a).toFixed(1)}" rx="2"/>`);
  }

  for (const v of ticks(lo, hi, 4)) {
    const y = sy(v);
    parts.push(`<line class="grid-line" x1="${pad.l}" y1="${y.toFixed(1)}" x2="${W - pad.r}" y2="${y.toFixed(1)}"/>`);
    parts.push(`<text class="axis-text" x="${pad.l - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end">${fmt(v, tickDigits(lo, hi))}</text>`);
  }

  for (const l of (tg.lines || [])) {
    const y = sy(l.v);
    parts.push(`<line class="target-line" x1="${pad.l}" y1="${y.toFixed(1)}" x2="${W - pad.r}" y2="${y.toFixed(1)}"/>`);
    parts.push(`<text class="target-text" x="${W - pad.r}" y="${(y - 4).toFixed(1)}" text-anchor="end">${l.label}</text>`);
  }

  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('');
  parts.push(`<path class="series-area" d="${line}L${sx(pts[pts.length - 1].x).toFixed(1)},${(H - pad.b).toFixed(1)}L${sx(pts[0].x).toFixed(1)},${(H - pad.b).toFixed(1)}Z"/>`);
  parts.push(`<path class="series-line" d="${line}"/>`);

  // Geglätteter Trend (nur wo Tagesschwankung die Einzelwerte verrauscht)
  if (m.trend && pts.length >= 4) {
    const avg = movingAvg(pts.map(p => p.y), 3);
    parts.push(`<path class="trend-line" d="${pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(avg[i]).toFixed(1)}`).join('')}"/>`);
  }

  pts.forEach((p, i) => {
    const isLast = i === pts.length - 1;
    parts.push(`<circle class="dot${isLast ? ' dot-last' : ''}" cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="${isLast ? 4.5 : 3.5}"/>`);
    parts.push(`<circle class="hit" cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="16" data-i="${i}"/>`);
  });

  const idx = pts.length <= 4 ? pts.map((_, i) => i) : [0, Math.floor((pts.length - 1) / 2), pts.length - 1];
  for (const i of new Set(idx)) {
    const anchor = i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle';
    parts.push(`<text class="axis-text" x="${sx(pts[i].x).toFixed(1)}" y="${H - 7}" text-anchor="${anchor}">${fmtDateShort(pts[i].row.date)}</text>`);
  }

  svg.innerHTML = parts.join('');
  wireTooltip(svg, pts, sx, sy, m);
}

function movingAvg(arr, win) {
  return arr.map((_, i) => {
    const slice = arr.slice(Math.max(0, i - win + 1), i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

function ticks(lo, hi, count) {
  const raw = (hi - lo) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : norm >= 1 ? 1 : 0.5) * mag;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v / step) * step);
  return out;
}

const tickDigits = (lo, hi) => (hi - lo) < 3 ? 1 : 0;

function wireTooltip(svg, pts, sx, sy, m) {
  const wrap = svg.parentElement;
  let tip = wrap.querySelector('.tip');
  if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; wrap.appendChild(tip); }

  const show = i => {
    const p = pts[i];
    const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
    tip.textContent = `${fmtDate(p.row.date)} · ${fmt(p.y, m.digits)} ${m.unit}`;
    tip.style.left = `${sx(p.x) * scale}px`;
    tip.style.top = `${sy(p.y) * scale}px`;
    tip.classList.add('on');
  };

  // Die Trefferflächen entstehen bei jedem Zeichnen neu, ihre Handler
  // verschwinden mit ihnen. Der Verlassen-Handler hängt am Rahmen und darf
  // sich deshalb nicht bei jedem Zeichnen erneut anmelden.
  svg.querySelectorAll('.hit').forEach(el => {
    const i = +el.dataset.i;
    el.addEventListener('pointerenter', () => show(i));
    el.addEventListener('pointerdown', () => show(i));
  });
  if (!wrap.dataset.tipWired) {
    wrap.addEventListener('pointerleave', () => tip.classList.remove('on'));
    wrap.dataset.tipWired = '1';
  }
}

/* ── Messungsliste ─────────────────────────────────────── */

function renderLedger(rows) {
  const desc = [...rows].reverse();
  $('entryCount').textContent = rows.length ? `· ${rows.length}` : '';

  if (!desc.length) { $('ledger').innerHTML = '<p class="empty">Noch keine Messungen.</p>'; return; }

  $('ledger').innerHTML = desc.map(r => {
    const vals = [];
    if (r.weight != null) vals.push(`<span><b>${fmt(r.weight, 2)}</b><span class="k">kg</span></span>`);
    if (r.waist != null) vals.push(`<span><b>${fmt(r.waist, 1)}</b><span class="k">cm</span></span>`);
    if (r.d.bf != null) vals.push(`<span><b>${fmt(r.d.bf, 1)}</b><span class="k">%</span></span>`);
    const thumb = photoIds.has(r.id)
      ? `<button class="row-photo" data-photo-id="${r.id}" aria-label="Foto vom ${fmtDate(r.date)} ansehen"><img alt=""></button>`
      : '';
    return `<div class="row">
      <span class="row-date">${fmtDate(r.date)}</span>
      <span class="row-main">
        ${thumb}
        <span class="row-vals">${vals.join('') || '<span class="k">keine Werte</span>'}</span>
      </span>
      <span class="row-acts">
        <button class="icon-btn" data-edit="${r.id}" aria-label="Messung vom ${fmtDate(r.date)} bearbeiten">Ändern</button>
        <button class="icon-btn del" data-del="${r.id}" aria-label="Messung vom ${fmtDate(r.date)} löschen">Löschen</button>
      </span>
      ${r.note ? `<span class="row-note">${escapeHtml(r.note)}</span>` : ''}
    </div>`;
  }).join('');

  hydrateThumbs();
}

async function hydrateThumbs() {
  for (const btn of document.querySelectorAll('[data-photo-id]')) {
    const url = await photoUrl(btn.dataset.photoId);
    if (url) btn.querySelector('img').src = url;
  }
}

const escapeHtml = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ── Einstellungen ─────────────────────────────────────── */

function renderSettings(rows) {
  const t = state.settings.targets;
  $('s-height').value = fmt(state.settings.heightCm, 0);
  $('s-waistFirst').value = fmt(t.waistFirst, 0);
  $('s-waistLong').value = fmt(t.waistLong, 0);
  $('s-bfLow').value = fmt(t.bfLow, 0);
  $('s-bfHigh').value = fmt(t.bfHigh, 0);

  const lean = latestLean(rows);
  if (lean == null) { $('targetWeightNote').textContent = ''; return; }
  const hi = weightAtBf(lean, t.bfHigh), lo = weightAtBf(lean, t.bfLow);
  const now = lastOf(rows, 'weight');
  $('targetWeightNote').textContent =
    `Bei ${fmt(lean, 1)} kg Magermasse entspricht das einem Zielgewicht von ${fmt(hi, 1)} kg (${fmt(t.bfHigh, 0)} %` +
    (now != null ? `, noch ${fmt(now - hi, 1)} kg Fett` : '') +
    `) bis ${fmt(lo, 1)} kg (${fmt(t.bfLow, 0)} %` +
    (now != null ? `, noch ${fmt(now - lo, 1)} kg Fett` : '') +
    `). Nicht leichter werden ist das Ziel, sondern Fett gegen den Erhalt der Muskeln tauschen.`;
}

async function renderStorage() {
  const n = photoIds.size;
  const teile = [`${state.entries.length} ${state.entries.length === 1 ? 'Messung' : 'Messungen'}, ${n} ${n === 1 ? 'Foto' : 'Fotos'}.`];

  if (navigator.storage?.estimate) {
    try {
      const { usage, quota } = await navigator.storage.estimate();
      teile.push(`Belegt ${fmtBytes(usage)} von ${fmtBytes(quota)}.`);
    } catch (err) { /* nicht kritisch */ }
  }
  if (navigator.storage?.persisted) {
    try {
      teile.push(await navigator.storage.persisted()
        ? 'Dauerhaft gespeichert: ja — Android räumt die Daten nicht bei Platzmangel weg.'
        : 'Dauerhaft gespeichert: nein — bei Speichermangel darf Android die Daten löschen. Umso wichtiger ist der CSV-Export.');
    } catch (err) { /* nicht kritisch */ }
  }
  $('storageNote').textContent = teile.join(' ');
}

/* ── Formular ──────────────────────────────────────────── */

function readForm() {
  return {
    date: $('f-date').value,
    weight: num($('f-weight').value),
    waist: num($('f-waist').value),
    neck: num($('f-neck').value),
    note: $('f-note').value.trim()
  };
}

function setFormPhoto(blob) {
  if (formPhotoUrl) { URL.revokeObjectURL(formPhotoUrl); formPhotoUrl = null; }
  const wrap = $('photoPreview');
  if (!blob) {
    wrap.hidden = true;
    $('photoPreviewImg').removeAttribute('src');
    $('photoBtn').textContent = 'Foto wählen';
  } else {
    formPhotoUrl = URL.createObjectURL(blob);
    $('photoPreviewImg').src = formPhotoUrl;
    wrap.hidden = false;
    $('photoBtn').textContent = 'Foto ersetzen';
  }
  updatePhotoField();
}

/** Das Foto gehört zur Taillenmessung — ohne Taille kein Foto. */
function updatePhotoField() {
  const hatTaille = num($('f-waist').value) != null;
  $('photoField').hidden = !(hatTaille || !$('photoPreview').hidden);
}

function resetForm() {
  editingId = null;
  pendingPhoto = null;
  photoCleared = false;
  $('entryForm').reset();
  $('f-date').value = todayISO();
  // Der Hals ändert sich kaum — letzten bekannten Wert vorschlagen.
  const rows = decorate(state.entries, state.settings.heightCm);
  const lastNeck = rows.length ? rows[rows.length - 1].d.neckUsed : null;
  if (lastNeck != null) $('f-neck').value = fmt(lastNeck, 1);
  $('formTitle').textContent = 'Neue Messung';
  $('submitBtn').textContent = 'Eintragen';
  $('cancelEdit').hidden = true;
  $('formError').hidden = true;
  setFormPhoto(null);
  updatePreview();
}

async function startEdit(id) {
  const e = state.entries.find(x => x.id === id);
  if (!e) return;
  editingId = id;
  pendingPhoto = null;
  photoCleared = false;
  $('f-date').value = e.date;
  $('f-weight').value = e.weight != null ? fmt(e.weight, 2) : '';
  $('f-waist').value = e.waist != null ? fmt(e.waist, 1) : '';
  $('f-neck').value = e.neck != null ? fmt(e.neck, 1) : '';
  $('f-note').value = e.note || '';
  $('formTitle').textContent = `Messung vom ${fmtDate(e.date)}`;
  $('submitBtn').textContent = 'Aktualisieren';
  $('cancelEdit').hidden = false;
  $('formError').hidden = true;
  setFormPhoto(photoIds.has(id) ? await photoGet(id) : null);
  updatePreview();
  showPage('messen');
  $('entryForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function updatePreview() {
  const f = readForm();
  const rows = decorate(state.entries, state.settings.heightCm);
  const neck = f.neck ?? (rows.length ? rows[rows.length - 1].d.neckUsed : null);
  const bf = navyBf(f.waist, neck, state.settings.heightCm);
  const box = $('preview');

  if (bf == null || f.weight == null) { box.hidden = true; return; }
  const fatMass = f.weight * bf / 100;
  box.hidden = false;
  box.innerHTML = `Körperfett <b>${fmt(bf, 1)} %</b> · Fettmasse <b>${fmt(fatMass, 1)} kg</b> · Magermasse <b>${fmt(f.weight - fatMass, 1)} kg</b>`;
}

async function submitForm(ev) {
  ev.preventDefault();
  const f = readForm();
  const err = $('formError');

  if (!isDate(f.date)) return fail(err, 'Bitte ein Datum wählen.');
  if (f.weight == null) return fail(err, 'Das Gewicht brauche ich — alles andere ist optional.');
  if (f.weight < 30 || f.weight > 300) return fail(err, 'Das Gewicht sieht nicht plausibel aus.');
  if (f.waist != null && (f.waist < 40 || f.waist > 200)) return fail(err, 'Der Taillenumfang sieht nicht plausibel aus.');
  if (f.neck != null && (f.neck < 20 || f.neck > 80)) return fail(err, 'Der Halsumfang sieht nicht plausibel aus.');
  if (f.waist != null && f.neck != null && f.waist <= f.neck) return fail(err, 'Die Taille muss größer als der Hals sein.');

  // Greift auch, wenn beim Bearbeiten das Datum auf einen belegten Tag gesetzt wird.
  const clash = state.entries.find(e => e.date === f.date && e.id !== editingId);
  if (clash) {
    if (!confirm(`Für den ${fmtDate(f.date)} gibt es schon eine Messung. Überschreiben?`)) return;
    await removeEntry(clash.id);
  }

  let id;
  if (editingId) {
    id = editingId;
    const i = state.entries.findIndex(e => e.id === id);
    if (i >= 0) state.entries[i] = { ...state.entries[i], ...f };
  } else {
    id = uid();
    state.entries.push({ id, ...f });
  }

  try {
    if (pendingPhoto) {
      await photoPut(id, pendingPhoto);
      forgetPhotoUrl(id);
      photoIds.add(id);
    } else if (photoCleared && photoIds.has(id)) {
      await photoDel(id);
      forgetPhotoUrl(id);
      photoIds.delete(id);
    }
  } catch (e) {
    console.error(e);
    toast('Das Foto konnte nicht gespeichert werden.');
  }

  err.hidden = true;
  save();
  toast(editingId ? 'Messung aktualisiert' : 'Messung eingetragen');
  resetForm();
  render();
}

function fail(el, msg) {
  el.textContent = msg;
  el.hidden = false;
}

async function removeEntry(id) {
  state.entries = state.entries.filter(x => x.id !== id);
  if (photoIds.has(id)) {
    try { await photoDel(id); } catch (e) { console.error(e); }
    forgetPhotoUrl(id);
    photoIds.delete(id);
  }
}

/* ── Fotoansicht ───────────────────────────────────────── */

let lightboxId = null;

async function openLightbox(id) {
  const entry = state.entries.find(e => e.id === id);
  const url = await photoUrl(id);
  if (!url || !entry) return;
  lightboxId = id;
  $('lightboxImg').src = url;
  $('lightboxImg').alt = `Foto vom ${fmtDate(entry.date)}`;
  $('lightboxDate').textContent = fmtDate(entry.date);
  $('lightbox').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  $('lightbox').hidden = true;
  $('lightboxImg').removeAttribute('src');
  lightboxId = null;
  document.body.style.overflow = '';
}

async function downloadPhoto() {
  if (!lightboxId) return;
  const entry = state.entries.find(e => e.id === lightboxId);
  const url = await photoUrl(lightboxId);
  if (!url) return;
  const a = document.createElement('a');
  a.href = url;
  a.download = `rekomposition-${entry.date}.jpg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast('Foto heruntergeladen');
}

async function deletePhotoFromLightbox() {
  if (!lightboxId) return;
  const entry = state.entries.find(e => e.id === lightboxId);
  if (!confirm(`Foto vom ${fmtDate(entry.date)} wirklich löschen? Die Messwerte bleiben erhalten.`)) return;
  const id = lightboxId;
  closeLightbox();
  try { await photoDel(id); } catch (e) { console.error(e); }
  forgetPhotoUrl(id);
  photoIds.delete(id);
  render();
  toast('Foto gelöscht');
}

/* ── CSV ───────────────────────────────────────────────
   Semikolon und Komma-Dezimaltrenner, damit die Datei in
   deutschem Excel direkt sauber aufgeht.
   ────────────────────────────────────────────────────── */

const CSV_COLS = ['Datum', 'Gewicht (kg)', 'Taille (cm)', 'Hals (cm)',
                  'Körperfett (%)', 'Fettmasse (kg)', 'Magermasse (kg)', 'Taille/Größe', 'Foto', 'Notiz'];

function exportCsv() {
  const rows = decorate(state.entries, state.settings.heightCm);
  const cell = v => (v == null ? '' : String(v).replace('.', ','));
  const lines = [CSV_COLS.join(';')];
  for (const r of rows) {
    lines.push([
      fmtDate(r.date),
      cell(r.weight?.toFixed(2)), cell(r.waist?.toFixed(1)), cell(r.neck?.toFixed(1)),
      cell(r.d.bf?.toFixed(1)), cell(r.d.fatMass?.toFixed(1)), cell(r.d.leanMass?.toFixed(1)),
      cell(r.d.whtr?.toFixed(3)),
      photoIds.has(r.id) ? 'ja' : 'nein',
      `"${(r.note || '').replace(/"/g, '""')}"`
    ].join(';'));
  }
  // BOM voran, sonst zeigt Excel die Umlaute falsch an.
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rekomposition-${todayISO()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status(`${rows.length} Messungen exportiert. Fotos sind nicht enthalten.`);
}

function parseCsv(text) {
  const clean = text.replace(/^\uFEFF/, '');
  const head = clean.split(/\r?\n/)[0] || '';
  const sep = (head.match(/;/g) || []).length >= (head.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [], cell = '', quoted = false;

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}

function importCsv(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return status('Die Datei enthält keine Messungen.', true);

  const head = rows[0].map(h => h.toLowerCase().trim());
  const col = (...keys) => head.findIndex(h => keys.some(k => h.includes(k)));
  const iDate = col('datum', 'date');
  const iWeight = col('gewicht', 'weight');
  if (iDate < 0 || iWeight < 0) return status('Spalten "Datum" und "Gewicht" fehlen.', true);
  // "taille (" zuerst, sonst greift die Spalte "Taille/Größe".
  const iWaist = col('taille (', 'taille', 'waist');
  const iNeck = col('hals', 'neck');
  const iNote = col('notiz', 'note');

  let added = 0, updated = 0, skipped = 0;
  for (const r of rows.slice(1)) {
    const date = toIso(r[iDate]);
    const weight = num(r[iWeight]);
    if (!date || weight == null) { skipped++; continue; }
    const entry = {
      date, weight,
      waist: iWaist >= 0 ? num(r[iWaist]) : null,
      neck: iNeck >= 0 ? num(r[iNeck]) : null,
      note: iNote >= 0 ? (r[iNote] || '').trim() : ''
    };
    const existing = state.entries.find(e => e.date === date);
    if (existing) { Object.assign(existing, entry); updated++; }
    else { state.entries.push({ id: uid(), ...entry }); added++; }
  }

  save();
  resetForm();
  render();
  status(`${added} neu, ${updated} aktualisiert${skipped ? `, ${skipped} übersprungen` : ''}. Fotos enthält eine CSV nicht.`);
}

/** Akzeptiert 01.03.2026 wie 2026-03-01. */
function toIso(s) {
  if (!s) return null;
  const v = s.trim();
  if (isDate(v)) return v;
  const m = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

/* ── Rückmeldungen ─────────────────────────────────────── */

let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('on'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('on');
    setTimeout(() => { el.hidden = true; }, 250);
  }, 2400);
}

let statusTimer;
function status(msg, isError = false) {
  const el = $('dataStatus');
  el.textContent = msg;
  el.className = isError ? 'status err' : 'status';
  el.hidden = false;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { el.hidden = true; }, 8000);
}

/* ── Verdrahtung ───────────────────────────────────────── */

function wire() {
  // Seitenwechsel
  document.querySelector('.tabs').addEventListener('click', ev => {
    const t = ev.target.closest('[data-page]');
    if (t) showPage(t.dataset.page);
  });

  // "?"-Verweise auf die Wissensseite. Die Ziel-ID beginnt mit dem Seitennamen.
  document.addEventListener('click', ev => {
    const g = ev.target.closest('[data-goto]');
    if (!g) return;
    const target = g.dataset.goto;
    showPage(target.split('-')[0]);
    $(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  $('entryForm').addEventListener('submit', submitForm);
  ['f-weight', 'f-waist', 'f-neck'].forEach(id => $(id).addEventListener('input', updatePreview));
  $('f-waist').addEventListener('input', updatePhotoField);
  $('cancelEdit').addEventListener('click', resetForm);

  // Foto wählen
  $('photoBtn').addEventListener('click', () => $('f-photo').click());
  $('photoRemove').addEventListener('click', () => {
    pendingPhoto = null;
    photoCleared = true;
    setFormPhoto(null);
  });
  $('f-photo').addEventListener('change', async ev => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    try {
      const blob = await shrinkImage(file);
      pendingPhoto = blob;
      photoCleared = false;
      setFormPhoto(blob);
      toast(`Foto bereit (${fmtBytes(blob.size)})`);
    } catch (err) {
      console.error(err);
      toast('Das Bild konnte nicht gelesen werden.');
    }
  });

  // Diagramm-Umschalter
  $('metricChips').addEventListener('click', ev => {
    const btn = ev.target.closest('[data-metric]');
    if (!btn) return;
    metric = btn.dataset.metric;
    renderChips();
    renderChart(decorate(state.entries, state.settings.heightCm));
  });

  // Messungsliste
  $('ledger').addEventListener('click', async ev => {
    const foto = ev.target.closest('[data-photo-id]');
    if (foto) return openLightbox(foto.dataset.photoId);

    const edit = ev.target.closest('[data-edit]');
    if (edit) return startEdit(edit.dataset.edit);

    const del = ev.target.closest('[data-del]');
    if (!del) return;
    const e = state.entries.find(x => x.id === del.dataset.del);
    if (!e) return;
    const mitFoto = photoIds.has(e.id) ? ' Das zugehörige Foto wird mitgelöscht.' : '';
    if (!confirm(`Messung vom ${fmtDate(e.date)} wirklich löschen?${mitFoto}`)) return;
    await removeEntry(del.dataset.del);
    save();
    if (editingId === del.dataset.del) resetForm();
    render();
    toast('Messung gelöscht');
  });

  // Fotoansicht
  $('lightboxClose').addEventListener('click', closeLightbox);
  $('lightboxDownload').addEventListener('click', downloadPhoto);
  $('lightboxDelete').addEventListener('click', deletePhotoFromLightbox);
  $('lightbox').addEventListener('click', ev => { if (ev.target === $('lightbox')) closeLightbox(); });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !$('lightbox').hidden) closeLightbox(); });

  // Einstellungen: Wert übernehmen, sobald das Feld verlassen wird.
  const settingFields = {
    's-height': v => { state.settings.heightCm = clamp(v, 100, 250) ?? state.settings.heightCm; },
    's-waistFirst': v => { state.settings.targets.waistFirst = clamp(v, 50, 200) ?? state.settings.targets.waistFirst; },
    's-waistLong': v => { state.settings.targets.waistLong = clamp(v, 50, 200) ?? state.settings.targets.waistLong; },
    's-bfLow': v => { state.settings.targets.bfLow = clamp(v, 3, 50) ?? state.settings.targets.bfLow; },
    's-bfHigh': v => { state.settings.targets.bfHigh = clamp(v, 3, 50) ?? state.settings.targets.bfHigh; }
  };
  for (const [id, apply] of Object.entries(settingFields)) {
    $(id).addEventListener('change', () => {
      apply(num($(id).value));
      const t = state.settings.targets;
      if (t.bfLow > t.bfHigh) [t.bfLow, t.bfHigh] = [t.bfHigh, t.bfLow];
      save();
      render();
      updatePreview();
    });
  }

  $('exportBtn').addEventListener('click', exportCsv);
  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', async ev => {
    const file = ev.target.files?.[0];
    if (!file) return;
    try { importCsv(await file.text()); }
    catch (err) { console.error(err); status('Die Datei konnte nicht gelesen werden.', true); }
    ev.target.value = '';
  });

  $('resetBtn').addEventListener('click', async () => {
    if (!confirm('Wirklich alle Messungen, Fotos und Einstellungen löschen? Das lässt sich nicht rückgängig machen — exportier vorher eine CSV und sichere deine Fotos.')) return;
    localStorage.removeItem(STORE_KEY);
    try { await photoClear(); } catch (e) { console.error(e); }
    photoUrlCache.forEach(u => URL.revokeObjectURL(u));
    photoUrlCache.clear();
    photoIds.clear();
    state = structuredClone(DEFAULTS);
    save();
    resetForm();
    render();
    toast('Alle Daten gelöscht');
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => renderChart(decorate(state.entries, state.settings.heightCm)), 150);
  });
}

const clamp = (v, lo, hi) => (v == null ? null : Math.min(hi, Math.max(lo, v)));

/* ── Installieren ──────────────────────────────────────── */

function wireInstall() {
  window.addEventListener('beforeinstallprompt', ev => {
    ev.preventDefault();
    installEvent = ev;
    if ($('installBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'installBtn';
    btn.className = 'btn';
    btn.style.cssText = 'padding:5px 11px;font-size:0.75rem;border-radius:99px';
    btn.textContent = 'Installieren';
    btn.addEventListener('click', async () => {
      if (!installEvent) return;
      installEvent.prompt();
      await installEvent.userChoice;
      installEvent = null;
      btn.remove();
    });
    document.querySelector('.topbar-inner').appendChild(btn);
  });
}

/* ── Start ─────────────────────────────────────────────── */

async function init() {
  state = load();

  // Foto-IDs einmalig einlesen, damit die Liste synchron zeichnen kann.
  try {
    (await photoAllKeys()).forEach(k => photoIds.add(k));
  } catch (err) {
    console.warn('Fotospeicher nicht verfügbar:', err);
  }

  wire();
  wireInstall();
  resetForm();
  render();
  showPage('messen');

  // Sofort registrieren, nicht erst beim load-Ereignis: Das kann bereits
  // durch sein, während weiter unten auf persist() gewartet wird — der
  // Zuhörer käme dann nie mehr zum Zug und die App wäre nicht installierbar.
  if ('serviceWorker' in navigator) {
    // Übernimmt eine neue Fassung, einmalig neu laden — sonst läuft die alte
    // aus dem Cache weiter, bis die App zweimal geschlossen und geöffnet wurde.
    // Bei der Erstinstallation gibt es noch keinen Vorgänger, da wäre der
    // Neustart überflüssig.
    const hatteVorgaenger = !!navigator.serviceWorker.controller;
    let laedtNeu = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hatteVorgaenger || laedtNeu) return;
      laedtNeu = true;
      location.reload();
    });
    navigator.serviceWorker.register('./sw.js')
      .catch(err => console.warn('Service Worker nicht registriert:', err));
  }

  // Bittet Android, den lokalen Speicher nicht bei Platzmangel zu räumen.
  if (navigator.storage?.persist) {
    try { await navigator.storage.persist(); } catch (err) { /* nicht kritisch */ }
    renderStorage();
  }
}

init();
