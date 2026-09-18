'use strict';

/* ============================== FIELD MODEL ============================== */

const FIELDS = [
  { key:'yarisNo',          label:'Yarış No' },
  { key:'atIsmi',            label:'At İsmi' },
  { key:'kulvar',             label:'Kulvar' },
  { key:'jokey',              label:'Jokey' },
  { key:'antrenor',           label:'Antrenör' },
  { key:'kilo',                label:'Kilo (kg)' },
  { key:'hp',                  label:'HP' },
  { key:'mesafe',              label:'Mesafe (m)' },
  { key:'pist',                label:'Pist' },
  { key:'zemin',               label:'Zemin' },
  { key:'son5',                label:'Son Yarışlar (yeniden eskiye, TJK "Son 6 Y." formatı: 225662)' },
  { key:'mesafeGalibiyet',     label:'Mesafe Gal.' },
  { key:'mesafeKosu',          label:'Mesafe Koşu' },
  { key:'pistGalibiyet',       label:'Pist Gal.' },
  { key:'pistKosu',            label:'Pist Koşu' },
  { key:'zeminGalibiyet',      label:'Zemin Gal.' },
  { key:'zeminKosu',           label:'Zemin Koşu' },
  { key:'jokeyWinPct',         label:'Jokey Gal. %' },
  { key:'antrenorWinPct',      label:'Antrenör Gal. %' },
  { key:'ganyan',              label:'Ganyan' },
];

const ALIASES = {
  yarisNo:          ['yarisno','yaris','race','raceno','kosuno','koşuno'],
  atIsmi:           ['atismi','at','atadi','horsename','horse','name'],
  kulvar:           ['kulvar','kulvarno','startno','no','kapıno','kapino','n','atno'],
  jokey:            ['jokey','jockey'],
  antrenor:         ['antrenor','trainer'],
  kilo:             ['kilo','weight','taşıdığıkilo','tasidigikilo','sıklet','siklet'],
  hp:               ['hp','h','handikappuani','handicap','hendikap','hendikappuani','ratıng','rating'],
  mesafe:           ['mesafe','distance'],
  pist:             ['pist','surface','track'],
  zemin:            ['zemin','going','ground','pistdurumu'],
  son5:             ['son5','son6','sonsonuclar','form','last5','sonucları','sonuclari','son6y'],
  mesafeGalibiyet:  ['mesafegalibiyet','mesafegal','distwins'],
  mesafeKosu:       ['mesafekosu','mesafestart','diststarts','mesafekoşu'],
  pistGalibiyet:    ['pistgalibiyet','pistgal','surfacewins'],
  pistKosu:         ['pistkosu','surfacestarts','pistkoşu'],
  zeminGalibiyet:   ['zemingalibiyet','zemingal','goingwins'],
  zeminKosu:        ['zeminkosu','goingstarts','zeminkoşu'],
  jokeyWinPct:      ['jokeygalibiyetyuzde','jokeywinpct','jokeygal','jockeywin','jokeyyuzde'],
  antrenorWinPct:   ['antrenorgalibiyetyuzde','antrenorwinpct','antrenorgal','trainerwin','antrenoryuzde'],
  ganyan:           ['ganyan','odds','oran','gny'],
};

const ALIAS_LOOKUP = {};
Object.entries(ALIASES).forEach(([key, list]) => {
  list.forEach(a => { ALIAS_LOOKUP[normalizeHeader(a)] = key; });
  ALIAS_LOOKUP[normalizeHeader(key)] = key;
});

// Second-pass fallback when a header doesn't exactly match an alias (real-world
// bulletins use many header spellings). Checked in this order — more specific
// compound keywords first so e.g. "Jokey Galibiyet %" doesn't get caught by
// the plain "jokey" keyword before jokeyWinPct gets a chance.
const FUZZY_MATCHERS = [
  { field: 'jokeyWinPct',     kws: ['jokeygal', 'jokeywin', 'jokeyyuzde', 'jokeyorani'] },
  { field: 'antrenorWinPct',  kws: ['antrenorgal', 'antrenorwin', 'antrenoryuzde', 'antrenororani'] },
  { field: 'mesafeGalibiyet', kws: ['mesafegal', 'distwin'] },
  { field: 'mesafeKosu',      kws: ['mesafekosu', 'mesafestart', 'diststart'] },
  { field: 'pistGalibiyet',   kws: ['pistgal', 'surfacewin'] },
  { field: 'pistKosu',        kws: ['pistkosu', 'surfacestart'] },
  { field: 'zeminGalibiyet',  kws: ['zemingal', 'goingwin'] },
  { field: 'zeminKosu',       kws: ['zeminkosu', 'goingstart'] },
  { field: 'jokey',           kws: ['jokey', 'jockey'] },
  { field: 'antrenor',        kws: ['antrenor', 'trainer'] },
  { field: 'mesafe',          kws: ['mesafe', 'distance'] },
  { field: 'pist',            kws: ['pist', 'surface', 'track'] },
  { field: 'zemin',           kws: ['zemin', 'going', 'ground'] },
  { field: 'hp',              kws: ['handikap', 'hendikap', 'rating'] },
  { field: 'kilo',            kws: ['kilo', 'weight', 'tasidigikilo', 'siklet'] },
  { field: 'son5',            kws: ['son5', 'son6', 'sonsonuc', 'lastresult', 'form', 'sonucla', 'gecmis'] },
  { field: 'atIsmi',          kws: ['atismi', 'atadi', 'atinismi', 'atiniadi', 'hayvanismi', 'hayvanadi', 'horsename', 'horse'] },
  { field: 'kulvar',          kws: ['kulvar', 'startno', 'kapino'] },
  { field: 'yarisNo',         kws: ['yarisno', 'kosuno', 'raceno'] },
  { field: 'ganyan',          kws: ['ganyan', 'odds', 'oran'] },
];

function fuzzyMatchHeader(norm) {
  // A header ending in "puan"/"skor"/"score" is a computed result column
  // (this app's own "...Puan"/"KompozitSkor" export headers included), never
  // raw input data — without this, e.g. "KiloHendikapMesafePuan" fuzzy-
  // matches "mesafe" and "JokeyAntrenorPuan" fuzzy-matches "jokey", silently
  // overwriting the real column with a stray score value.
  if (/(puan|skor|score)$/.test(norm)) return null;
  for (const m of FUZZY_MATCHERS) {
    if (m.kws.some(k => norm.includes(k))) return m.field;
  }
  return null;
}

function normalizeHeader(h) {
  return String(h || '')
    .toLowerCase()
    .replace(/ı/g, 'i').replace(/i̇/g, 'i')
    .replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '');
}

const DEFAULT_WEIGHTS = { form: 35, kilo: 25, jokey: 25, pist: 15 };
const WEIGHT_META = {
  form:  { label: 'Form ve Son Yarış Sonuçları', desc: 'Son 5 koşudaki dereceler (yeniye ağırlıklı)' },
  kilo:  { label: 'Kilo, Hendikap ve Mesafe Uyumu', desc: 'Taşınan kilo, HP ve mesafe geçmişi' },
  jokey: { label: 'Jokey ve Antrenör İstatistikleri', desc: 'Jokey ve antrenörün galibiyet yüzdesi' },
  pist:  { label: 'Pist ve Zemin Durumu', desc: 'Pist (kum/çim) ve zemin geçmiş performansı' },
};

/* ================================ STATE =================================== */

const STORAGE_KEY = 'atYarisiState_v1';
const THEME_KEY = 'atYarisiTheme';

let state = {
  rows: [],       // array of {yarisNo, atIsmi, ... } all string values
  weights: { ...DEFAULT_WEIGHTS },
  fileName: '',
  syncCode: '',
};

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  pushSync();
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.rows)) {
        state = {
          rows: parsed.rows,
          weights: { ...DEFAULT_WEIGHTS, ...(parsed.weights || {}) },
          fileName: parsed.fileName || '',
          syncCode: parsed.syncCode || '',
        };
      }
    }
  } catch (e) {}
}

/* ================================ CROSS-DEVICE SYNC ========================= */

// firebase-sync.js is a separate <script type="module"> loading the Firebase
// SDK over the network — it may finish after this classic script has already
// run past the point where it'd want to call into it, so every use goes
// through this rather than assuming window.atYarisiSync exists yet.
function whenSyncReady(fn) {
  if (window.atYarisiSync) { fn(); return; }
  window.addEventListener('atyarisi-sync-ready', () => fn(), { once: true });
}

let syncFailureNotified = false;
function setSyncStatus(icon, title) {
  const el = document.getElementById('syncStatus');
  if (el) { el.textContent = icon; el.title = title; }
}

function pushSync() {
  if (!state.syncCode) return;
  whenSyncReady(() => {
    setSyncStatus('🔄', 'Senkronize ediliyor…');
    window.atYarisiSync.push(state.syncCode, { rows: state.rows, weights: state.weights, fileName: state.fileName }).then(ok => {
      if (ok) {
        setSyncStatus('🟢', 'Senkronize edildi');
        syncFailureNotified = false;
      } else {
        setSyncStatus('🔴', 'Senkron başarısız — Firebase izinleri /atYarisi yoluna izin vermiyor olabilir');
        if (!syncFailureNotified) {
          syncFailureNotified = true;
          toast('Senkron başarısız. Firebase güvenlik kurallarında "/atYarisi" yoluna izin verilmesi gerekebilir.');
        }
      }
    });
  });
}

// Applied when data arrives FROM another device — must not itself call
// saveState()/pushSync(), or every incoming update would immediately be
// pushed straight back out, updating its own timestamp and re-triggering
// the poll on both ends forever.
function applyRemoteState(data) {
  if (!data) return;
  state.rows = Array.isArray(data.rows) ? data.rows : [];
  state.weights = { ...DEFAULT_WEIGHTS, ...(data.weights || {}) };
  state.fileName = data.fileName || '';
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  couponState.legs = {};
  renderAll();
  toast('Diğer cihazdan senkronize edildi.');
}

function renderSyncBar() {
  const codeEl = document.getElementById('syncCodeDisplay');
  const copyBtn = document.getElementById('copySyncCodeBtn');
  if (!codeEl) return;
  if (state.syncCode) {
    codeEl.textContent = state.syncCode;
    copyBtn.classList.remove('hidden');
  } else {
    codeEl.textContent = '—';
    copyBtn.classList.add('hidden');
  }
}

function ensureSyncCode() {
  if (state.syncCode) return;
  state.syncCode = window.atYarisiSync ? window.atYarisiSync.generateCode() : Math.random().toString(36).slice(2, 8).toUpperCase();
  renderSyncBar();
  whenSyncReady(() => window.atYarisiSync.startPolling(state.syncCode, applyRemoteState));
}

function joinSyncCode(code) {
  code = code.trim().toUpperCase();
  if (!code) return;
  state.syncCode = code;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  renderSyncBar();
  whenSyncReady(() => {
    setSyncStatus('🔄', 'Bağlanıyor…');
    window.atYarisiSync.pull(code).then(result => {
      if (result && result.data) {
        applyRemoteState(result.data);
        setSyncStatus('🟢', 'Senkronize edildi');
      } else {
        setSyncStatus('🟡', 'Bu kodla henüz veri yok — diğer cihaz veri yükleyince otomatik gelecek');
        toast('Bu kodla henüz veri bulunamadı. Diğer cihazda veri yüklendiğinde otomatik olarak burada görünecek.');
      }
    });
    window.atYarisiSync.startPolling(code, applyRemoteState);
  });
}

/* ================================ THEME ==================================== */

function toggleTheme() {
  const html = document.documentElement;
  const next = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  html.setAttribute('data-theme', next);
  try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
}

function initTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) document.documentElement.setAttribute('data-theme', saved);
  } catch (e) {}
}

/* ================================ TOAST ==================================== */

let toastTimer = null;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ============================== CSV PARSING ================================ */

function detectDelimiter(line) {
  const commaCount = (line.match(/,/g) || []).length;
  const semiCount = (line.match(/;/g) || []).length;
  return semiCount > commaCount ? ';' : ',';
}

function parseCsvLine(line, delim) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = false; }
      } else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === delim) { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function parseCSV(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const lines = text.split(/\r\n|\n|\r/).filter(l => l.trim().length > 0);
  if (!lines.length) return { headers: [], rows: [] };
  const delim = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delim);
  const rows = lines.slice(1).map(l => parseCsvLine(l, delim));
  return { headers, rows };
}

// Each output field may be filled by at most one column. Exact alias matches
// always win regardless of column order; a fuzzy match is only accepted for
// a field no column has already claimed (exactly or by an earlier fuzzy
// match) — otherwise a later, unrelated column could silently overwrite an
// earlier, correctly-matched one.
function mapHeaderRowToKeys(fields) {
  const matched = [];
  const unmatched = [];
  const keys = new Array(fields.length).fill(null);
  const claimed = new Set();

  fields.forEach((h, i) => {
    const key = ALIAS_LOOKUP[normalizeHeader(h)];
    if (key) { keys[i] = key; claimed.add(key); matched.push({ header: h, field: key }); }
  });

  fields.forEach((h, i) => {
    if (keys[i] !== null) return;
    if (h.trim() === '') return;
    const key = fuzzyMatchHeader(normalizeHeader(h));
    if (key && !claimed.has(key)) { keys[i] = key; claimed.add(key); matched.push({ header: h, field: key }); }
    else unmatched.push(h);
  });

  return { keys, matched, unmatched };
}

function mapCSVToRows(headers, rows) {
  const { keys: headerKeys, matched, unmatched } = mapHeaderRowToKeys(headers);

  const mappedAll = rows.map(r => {
    const obj = {};
    FIELDS.forEach(f => { obj[f.key] = ''; });
    headerKeys.forEach((key, i) => {
      if (key && r[i] !== undefined) obj[key] = r[i];
    });
    return obj;
  });

  const withName = mappedAll.filter(obj => obj.atIsmi && obj.atIsmi.trim() !== '');
  return { rows: withName, matched, unmatched, skipped: mappedAll.length - withName.length, totalParsed: mappedAll.length };
}

// TJK's own "CSV Program" export (the "CSV Program" link on the daily race
// program page) is NOT a flat table — it's the PDF layout as CSV: a race
// header line ("1. Kosu :   15.00;Maiden; 2 Yaşlı İngilizler; 57.00kg;
// 1200m; Çim;...") holding that race's distance/surface, a prize-money
// block, a per-race column header row ("At No;At İsmi;...;H;Son 6 Yarış;..."),
// the horse rows, then betting-pool-type junk rows, repeated per race.
// This scans for that shape and extracts just the horse rows, applying the
// race's own distance/surface to every horse in it.
const RACE_HEADER_RE = /^(\d+)\s*\.\s*Kosu\s*:/im;

function isTjkProgramFormat(text) {
  return RACE_HEADER_RE.test(text);
}

// "KompozitSkor" only ever appears in this app's own "Sonuçları CSV Olarak
// İndir" export — a strong, unambiguous signal that a results file (not raw
// TJK data) is being fed back in as input, which produces a near-empty,
// meaningless import rather than an error, so it's worth catching explicitly.
function isOwnResultsExport(text) {
  const firstLine = text.split(/\r\n|\n|\r/)[0] || '';
  return normalizeHeader(firstLine).includes('kompozitskor');
}

function parseTjkProgramCSV(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const delim = ';';

  let raceNo = null;
  let raceMesafe = '';
  let racePist = '';
  let headerKeys = null;
  const allMatched = [];
  const allUnmatched = new Set();
  const mappedAll = [];

  text.split(/\r\n|\n|\r/).forEach(rawLine => {
    const line = rawLine.trim();
    if (!line) return;

    const raceMatch = line.match(RACE_HEADER_RE);
    if (raceMatch) {
      raceNo = raceMatch[1];
      raceMesafe = '';
      racePist = '';
      const parts = parseCsvLine(line, delim);
      for (let i = 0; i < parts.length; i++) {
        const m = parts[i].match(/^(\d+)\s*m$/i);
        if (m) {
          raceMesafe = m[1];
          racePist = (parts[i + 1] || '').trim();
          break;
        }
      }
      headerKeys = null; // require a fresh column-header line before trusting rows
      return;
    }

    const fields = parseCsvLine(line, delim);

    if (fields.length >= 2 && normalizeHeader(fields[0]) === 'atno' && normalizeHeader(fields[1]) === 'atismi') {
      const { keys, matched, unmatched } = mapHeaderRowToKeys(fields);
      headerKeys = keys;
      if (!allMatched.length) allMatched.push(...matched);
      unmatched.forEach(u => allUnmatched.add(u));
      return;
    }

    if (headerKeys && /^\d+$/.test(fields[0] || '')) {
      const obj = {};
      FIELDS.forEach(f => { obj[f.key] = ''; });
      headerKeys.forEach((key, i) => {
        if (key && fields[i] !== undefined) obj[key] = fields[i];
      });
      if (raceNo) obj.yarisNo = raceNo;
      if (raceMesafe) obj.mesafe = raceMesafe;
      if (racePist) obj.pist = racePist;
      mappedAll.push(obj);
    }
  });

  const withName = mappedAll.filter(obj => obj.atIsmi && obj.atIsmi.trim() !== '');
  return {
    rows: withName,
    matched: allMatched,
    unmatched: [...allUnmatched],
    skipped: mappedAll.length - withName.length,
    totalParsed: mappedAll.length,
  };
}

/* ============================== NUMBER HELPERS ============================= */

function parseNumSmart(v) {
  if (v === undefined || v === null) return NaN;
  let s = String(v).trim();
  if (s === '') return NaN;
  // TJK "Sıklet" (weight) shows apprentice allowances as e.g. "53+0.10" — treat
  // '+' as addition (53 + 0.10 = 53.10), not noise to strip.
  if (s.includes('+')) {
    const parts = s.split('+').map(p => parseNumSmart(p));
    if (parts.some(isNaN)) return NaN;
    return parts.reduce((a, b) => a + b, 0);
  }
  s = s.replace(/[^0-9,.\-]/g, '');
  if (s.includes(',') && s.includes('.')) {
    const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.');
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return n;
}

// TJK's own "Son 6 Y." column packs one finish per DIGIT, contiguously
// (e.g. "225662", or "8-22512" where '-' just marks a gap between race
// meetings) rather than as delimited numbers — so this reads digit-by-digit,
// not by splitting on non-digit runs. "0" is TJK's own code for "unplaced /
// 9th or worse", not the number zero — positionPoints() special-cases it.
// A plain hyphen-separated list like "1-2-1-4-3" still parses the same way
// since each digit is already single-character.
function parseSon5(v) {
  if (!v) return [];
  const digits = String(v).match(/[0-9]/g);
  if (!digits) return [];
  return digits.map(Number).slice(0, 8);
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

/* ============================== SCORING ENGINE ============================== */

// Geometrically-declining recency weights for however many results are given
// (TJK shows 6, some sources fewer/more) — always sums to 1.
function recencyWeights(n) {
  const raw = [];
  let w = 1;
  for (let i = 0; i < n; i++) { raw.push(w); w *= 0.72; }
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map(x => x / sum);
}

function positionPoints(pos) {
  if (pos === 0) return 15;   // TJK code for "unplaced / 9th or worse", not an actual 1st place
  if (pos === 1) return 100;
  if (pos === 2) return 85;
  if (pos === 3) return 72;
  if (pos === 4) return 60;
  if (pos === 5) return 48;
  if (pos === 6) return 38;
  if (pos === 7) return 30;
  if (pos === 8) return 24;
  return 15;
}

function formScoreFor(row) {
  const results = parseSon5(row.son5);
  if (!results.length) return 50;
  const w = recencyWeights(results.length);
  let total = 0;
  results.forEach((pos, i) => { total += positionPoints(pos) * w[i]; });
  return Math.round(total * 10) / 10;
}

function normalizeGroup(rows, getter, higherBetter) {
  const vals = rows.map(r => {
    const v = getter(r);
    return (v === null || v === undefined || isNaN(v)) ? null : v;
  });
  const valid = vals.filter(v => v !== null);
  if (valid.length < 2) return vals.map(() => 50);
  const min = Math.min(...valid), max = Math.max(...valid);
  if (min === max) return vals.map(v => v === null ? 50 : 100);
  return vals.map(v => {
    if (v === null) return 50;
    let t = (v - min) / (max - min);
    if (!higherBetter) t = 1 - t;
    return Math.round(t * 1000) / 10;
  });
}

function ratioScore(win, starts) {
  const w = parseNumSmart(win), s = parseNumSmart(starts);
  if (isNaN(s) || s <= 0) return 50;
  const wv = isNaN(w) ? 0 : w;
  return clamp(Math.round((wv / s) * 1000) / 10, 0, 100);
}

function pctScore(v) {
  const n = parseNumSmart(v);
  if (isNaN(n)) return 50;
  return clamp(Math.round(n * 10) / 10, 0, 100);
}

function hasNum(v) { return !isNaN(parseNumSmart(v)); }
function hasRatioData(win, starts) { const s = parseNumSmart(starts); return !isNaN(s) && s > 0; }

// TJK's official CSV export never includes jockey/trainer win% or distance/
// surface/going history — so those categories would show "50.0" for every
// single horse in every race: not a real score, just noise. This detects
// which categories have NO data anywhere in the imported set and moves
// their weight onto the categories that actually have data, proportionally.
function computeEmptyCategories(rows) {
  if (!rows.length) return { form: false, kilo: false, jokey: false, pist: false };
  return {
    form:  rows.every(r => parseSon5(r.son5).length === 0),
    kilo:  rows.every(r => !hasNum(r.kilo) && !hasNum(r.hp) && !hasRatioData(r.mesafeGalibiyet, r.mesafeKosu)),
    jokey: rows.every(r => !hasNum(r.jokeyWinPct) && !hasNum(r.antrenorWinPct)),
    pist:  rows.every(r => !hasRatioData(r.pistGalibiyet, r.pistKosu) && !hasRatioData(r.zeminGalibiyet, r.zeminKosu)),
  };
}

function computeEffectiveWeights(weights, empty) {
  const keys = Object.keys(weights);
  const activeKeys = keys.filter(k => !empty[k]);
  if (!activeKeys.length) return { ...weights };
  const emptySum = keys.filter(k => empty[k]).reduce((s, k) => s + weights[k], 0);
  const activeSum = activeKeys.reduce((s, k) => s + weights[k], 0);
  const result = {};
  keys.forEach(k => {
    if (empty[k]) { result[k] = 0; }
    else { result[k] = activeSum > 0 ? weights[k] + (weights[k] / activeSum) * emptySum : weights[k]; }
  });
  return result;
}

function computeRaceScores(rows, weights) {
  const kiloScores = normalizeGroup(rows, r => parseNumSmart(r.kilo), false);
  const hpScores = normalizeGroup(rows, r => parseNumSmart(r.hp), true);

  return rows.map((row, i) => {
    const form = formScoreFor(row);

    const distScore = ratioScore(row.mesafeGalibiyet, row.mesafeKosu);
    const cat2 = Math.round(((kiloScores[i] + hpScores[i] + distScore) / 3) * 10) / 10;

    const jokeyS = pctScore(row.jokeyWinPct);
    const antrenorS = pctScore(row.antrenorWinPct);
    const cat3 = Math.round(((jokeyS + antrenorS) / 2) * 10) / 10;

    const pistS = ratioScore(row.pistGalibiyet, row.pistKosu);
    const zeminS = ratioScore(row.zeminGalibiyet, row.zeminKosu);
    const cat4 = Math.round(((pistS + zeminS) / 2) * 10) / 10;

    const composite = Math.round(
      (form * weights.form + cat2 * weights.kilo + cat3 * weights.jokey + cat4 * weights.pist) / 100 * 10
    ) / 10;

    const formPartial = parseSon5(row.son5).length === 0;
    const cat2Partial = !(hasNum(row.kilo) && hasNum(row.hp) && hasRatioData(row.mesafeGalibiyet, row.mesafeKosu));
    const cat3Partial = !(hasNum(row.jokeyWinPct) && hasNum(row.antrenorWinPct));
    const cat4Partial = !(hasRatioData(row.pistGalibiyet, row.pistKosu) && hasRatioData(row.zeminGalibiyet, row.zeminKosu));

    return { row, form, cat2, cat3, cat4, composite, formPartial, cat2Partial, cat3Partial, cat4Partial };
  }).sort((a, b) => b.composite - a.composite);
}

function groupByRace(rows) {
  const map = new Map();
  rows.forEach(r => {
    const key = (r.yarisNo && r.yarisNo.trim()) || 'Genel';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  });
  return map;
}

/* ================================ RENDERING ================================= */

function renderFieldLegend() {
  const el = document.getElementById('fieldLegend');
  el.innerHTML = '<b>Beklenen sütunlar:</b> ' + FIELDS.map(f => f.label).join(' · ');
}

function renderWeightsGrid() {
  const grid = document.getElementById('weightsGrid');
  grid.innerHTML = '';
  const empty = computeEmptyCategories(state.rows);
  const effective = computeEffectiveWeights(state.weights, empty);
  Object.keys(state.weights).forEach(key => {
    const meta = WEIGHT_META[key];
    const val = state.weights[key];
    const item = document.createElement('div');
    item.className = 'weight-item';
    const emptyNote = empty[key]
      ? `<div class="wdesc wempty">⚠ Bu veri setinde bu kriter için hiç veri yok — devre dışı, ağırlığı diğer kriterlere dağıtıldı.</div>`
      : (Math.round(effective[key]) !== val
          ? `<div class="wdesc">Gerçek etki: %${Math.round(effective[key])} (diğer kriterlerden devralınan pay dahil)</div>`
          : '');
    item.innerHTML = `
      <label>${meta.label} <span class="wval">%${val}</span></label>
      <input type="range" min="0" max="100" value="${val}" data-weight-key="${key}">
      <div class="wdesc">${meta.desc}</div>
      ${emptyNote}
    `;
    grid.appendChild(item);
  });
  grid.querySelectorAll('input[type=range]').forEach(input => {
    input.addEventListener('input', () => setWeight(input.dataset.weightKey, Number(input.value)));
  });
}

function setWeight(key, newVal) {
  newVal = clamp(Math.round(newVal), 0, 100);
  const keys = Object.keys(state.weights);
  const others = keys.filter(k => k !== key);
  const remaining = 100 - newVal;
  const othersSum = others.reduce((s, k) => s + state.weights[k], 0);

  if (othersSum <= 0) {
    others.forEach(k => { state.weights[k] = Math.floor(remaining / others.length); });
  } else {
    others.forEach(k => { state.weights[k] = Math.round((state.weights[k] / othersSum) * remaining); });
  }
  state.weights[key] = newVal;

  const sum = keys.reduce((s, k) => s + state.weights[k], 0);
  const diff = 100 - sum;
  if (diff !== 0) state.weights[others[0]] += diff;

  renderWeightsGrid();
  saveState();
  recalcAndRender();
}

function resetWeights() {
  state.weights = { ...DEFAULT_WEIGHTS };
  renderWeightsGrid();
  saveState();
  recalcAndRender();
  toast('Ağırlıklar varsayılana sıfırlandı.');
}

function renderReviewTable() {
  const table = document.getElementById('reviewTable');
  table.innerHTML = '';
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  FIELDS.forEach(f => {
    const th = document.createElement('th');
    th.textContent = f.label;
    trh.appendChild(th);
  });
  const thDel = document.createElement('th');
  thDel.textContent = '';
  trh.appendChild(thDel);
  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  state.rows.forEach((row, rIdx) => {
    const tr = document.createElement('tr');
    FIELDS.forEach(f => {
      const td = document.createElement('td');
      td.contentEditable = 'true';
      td.textContent = row[f.key] || '';
      td.addEventListener('blur', () => {
        state.rows[rIdx][f.key] = td.textContent.trim();
        saveState();
        recalcAndRender();
      });
      tr.appendChild(td);
    });
    const tdDel = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-small';
    delBtn.style.background = 'var(--surface3)';
    delBtn.style.color = 'var(--red)';
    delBtn.textContent = '🗑';
    delBtn.addEventListener('click', () => {
      state.rows.splice(rIdx, 1);
      saveState();
      renderAll();
    });
    tdDel.appendChild(delBtn);
    tr.appendChild(tdDel);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
}

function addEmptyRow() {
  const empty = {};
  FIELDS.forEach(f => { empty[f.key] = ''; });
  state.rows.push(empty);
  saveState();
  renderAll();
}

function renderResults() {
  const container = document.getElementById('racesContainer');
  const legendEl = document.getElementById('resultsLegend');
  container.innerHTML = '';
  if (!state.rows.length) { if (legendEl) legendEl.innerHTML = ''; return; }

  const empty = computeEmptyCategories(state.rows);
  const effectiveWeights = computeEffectiveWeights(state.weights, empty);
  const emptyLabels = Object.keys(empty).filter(k => empty[k]).map(k => WEIGHT_META[k].label);

  if (legendEl) {
    legendEl.innerHTML = `
      <div class="legend-line"><span class="miss">•</span> = bu at için bu kriterde veri eksik; nötr (50) puan kısmen ya da tamamen varsayıldı.</div>
      ${emptyLabels.length ? `<div class="legend-line">⚠ Bu dosyada hiç veri yok: <b>${emptyLabels.map(escapeHtml).join(', ')}</b> — ağırlıkları otomatik diğer kriterlere dağıtıldı.</div>` : ''}
    `;
  }

  const groups = groupByRace(state.rows);
  groups.forEach((rows, raceKey) => {
    const scored = computeRaceScores(rows, effectiveWeights);
    const block = document.createElement('div');
    block.className = 'race-block';

    const first = rows[0];
    const metaParts = [];
    if (first.mesafe) metaParts.push(first.mesafe + ' m');
    if (first.pist) metaParts.push(first.pist);
    if (first.zemin) metaParts.push(first.zemin);

    const favorite = scored[0];

    block.innerHTML = `
      <div class="race-block-head">
        <h3>Yarış ${escapeHtml(raceKey)}</h3>
        <span class="race-meta">${metaParts.map(escapeHtml).join(' · ')} · ${scored.length} at</span>
      </div>
      <div class="favorite-line">🏆 Favori: <b>${escapeHtml(favorite.row.atIsmi)}</b> <span class="favorite-score">(Skor: ${favorite.composite.toFixed(1)})</span></div>
      <div class="horse-row header-row">
        <span></span><span>At</span><span>Form${empty.form ? ' (veri yok)' : ''}</span><span>Kilo/HP/Mesafe${empty.kilo ? ' (veri yok)' : ''}</span><span>Jokey/Antrenör${empty.jokey ? ' (veri yok)' : ''}</span><span>Pist/Zemin${empty.pist ? ' (veri yok)' : ''}</span><span>Skor</span>
      </div>
    `;

    scored.forEach((s, idx) => {
      const rankClass = idx < 3 ? ` rank-${idx + 1}` : '';
      const row = document.createElement('div');
      row.className = 'horse-row' + rankClass;
      row.innerHTML = `
        <div class="rank-badge">${idx + 1}</div>
        <div class="horse-name">${escapeHtml(s.row.atIsmi)}
          <small>${[s.row.kulvar && 'K' + s.row.kulvar, s.row.jokey, s.row.antrenor].filter(Boolean).map(escapeHtml).join(' · ')}</small>
        </div>
        ${subscoreBar(s.form, s.formPartial, empty.form)}
        ${subscoreBar(s.cat2, s.cat2Partial, empty.kilo)}
        ${subscoreBar(s.cat3, s.cat3Partial, empty.jokey)}
        ${subscoreBar(s.cat4, s.cat4Partial, empty.pist)}
        <div class="composite">
          <div class="composite-val">${s.composite.toFixed(1)}</div>
          <div class="composite-bar"><div class="composite-fill" style="width:${clamp(s.composite,0,100)}%"></div></div>
        </div>
      `;
      block.appendChild(row);
    });

    container.appendChild(block);
  });
}

function subscoreBar(val, partial, datasetEmpty) {
  if (datasetEmpty) {
    return `<div class="subscore" title="Bu dosyada bu kriter için hiç veri yok">
      <div class="subscore-val subscore-nodata">Veri Yok</div>
      <div class="subscore-bar"><div class="subscore-fill" style="width:0%"></div></div>
    </div>`;
  }
  const title = partial ? 'Bu kriter için veri eksik; nötr (50) puan kısmen ya da tamamen varsayıldı' : '';
  return `<div class="subscore"${title ? ` title="${title}"` : ''}>
    <div class="subscore-val">${val.toFixed(1)}${partial ? ' <span class="miss">•</span>' : ''}</div>
    <div class="subscore-bar"><div class="subscore-fill" style="width:${clamp(val,0,100)}%"></div></div>
  </div>`;
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function renderDatasetInfo() {
  const el = document.getElementById('datasetInfo');
  if (state.rows.length) {
    el.style.display = '';
    el.textContent = `${state.rows.length} at · ${groupByRace(state.rows).size} yarış${state.fileName ? ' · ' + state.fileName : ''}`;
  } else {
    el.style.display = 'none';
  }
}

function renderAll() {
  const has = state.rows.length > 0;
  document.getElementById('weightsCard').classList.toggle('hidden', !has);
  document.getElementById('reviewCard').classList.toggle('hidden', !has);
  document.getElementById('resultsSection').classList.toggle('hidden', !has);
  document.getElementById('couponCard').classList.toggle('hidden', !has);
  document.getElementById('emptyState').classList.toggle('hidden', has);

  renderDatasetInfo();
  if (has) {
    couponState.legs = {}; // new dataset — discard any previous per-race overrides
    renderWeightsGrid();
    renderReviewTable();
    renderResults();
    renderCoupon();
  }
}

function recalcAndRender() {
  renderDatasetInfo();
  renderResults();
  renderCoupon();
}

/* ================================ COUPON BUILDER ============================= */

// Per-race state (included?, which kulvar numbers are marked) for the
// current dataset only — intentionally not persisted; a fresh import resets
// it via renderAll(), since race keys/sizes may differ between files.
// `selected` is a Set of kulvar numbers as strings; always kept non-empty
// once a race has been rendered (defaults to the favorite).
let couponState = { legs: {} };

function renderCoupon() {
  const legsEl = document.getElementById('couponLegs');
  const summaryEl = document.getElementById('couponSummary');
  if (!legsEl || !summaryEl) return;
  legsEl.innerHTML = '';
  summaryEl.innerHTML = '';
  if (!state.rows.length) return;

  const unitPrice = parseNumSmart(document.getElementById('unitPriceInput').value) || 0;
  const effectiveWeights = computeEffectiveWeights(state.weights, computeEmptyCategories(state.rows));
  const groups = groupByRace(state.rows);

  let combos = 1;
  let anyIncluded = false;
  const summaryLines = [];

  groups.forEach((rows, raceKey) => {
    const scored = computeRaceScores(rows, effectiveWeights);
    const favoriteNum = String(scored[0].row.kulvar);

    if (!couponState.legs[raceKey]) {
      couponState.legs[raceKey] = { included: true, selected: new Set([favoriteNum]) };
    }
    const legState = couponState.legs[raceKey];
    if (legState.selected.size === 0) legState.selected.add(favoriteNum);

    const horseByNumber = {};
    scored.forEach(s => { horseByNumber[String(s.row.kulvar)] = s; });
    const maxNum = Math.max(22, scored.length);

    const leg = document.createElement('div');
    leg.className = 'coupon-leg' + (legState.included ? '' : ' leg-off');
    const numbersHtml = Array.from({ length: maxNum }, (_, i) => i + 1).map(n => {
      const key = String(n);
      const horse = horseByNumber[key];
      const marked = horse && legState.selected.has(key);
      const cls = 'coupon-leg-number' + (marked ? ' marked' : '') + (horse ? ' clickable' : ' empty-slot');
      const attrs = horse ? `data-leg="${escapeHtml(raceKey)}" data-num="${key}" title="${escapeHtml(horse.row.atIsmi)}"` : '';
      return `<div class="${cls}" ${attrs}>${n}</div>`;
    }).join('');

    leg.innerHTML = `
      <div class="coupon-leg-head">
        <label style="display:flex;align-items:center;gap:4px;justify-content:center;font-size:0.7rem;color:var(--text2);">
          <input type="checkbox" data-leg-toggle="${escapeHtml(raceKey)}" ${legState.included ? 'checked' : ''}>
          Dahil
        </label>
        <div class="coupon-leg-title">Yarış ${escapeHtml(raceKey)}</div>
        <div class="coupon-leg-meta">${scored.length} at · ${legState.selected.size} seçili</div>
      </div>
      <div class="coupon-leg-numbers">${numbersHtml}</div>
    `;
    legsEl.appendChild(leg);

    if (legState.included) {
      anyIncluded = true;
      const n = legState.selected.size;
      combos *= n;
      const chosen = scored.filter(s => legState.selected.has(String(s.row.kulvar)));
      const names = chosen.map(s => `${s.row.kulvar} ${s.row.atIsmi}`).join(', ');
      summaryLines.push(`<div class="coupon-line">Yarış ${escapeHtml(raceKey)}: <b>${n}</b> at — ${escapeHtml(names)}</div>`);
    }
  });

  const totalCombos = anyIncluded ? combos : 0;
  const totalCost = totalCombos * unitPrice;

  summaryEl.innerHTML = `
    ${summaryLines.join('')}
    <div class="coupon-line" style="margin-top:8px;">Toplam kombinasyon: <b>${totalCombos}</b></div>
    <div class="coupon-total">Toplam ücret: ${totalCost.toFixed(2)} TL</div>
  `;

  legsEl.querySelectorAll('input[data-leg-toggle]').forEach(cb => {
    cb.addEventListener('change', () => {
      couponState.legs[cb.dataset.legToggle].included = cb.checked;
      renderCoupon();
    });
  });
  legsEl.querySelectorAll('.coupon-leg-number.clickable').forEach(el => {
    el.addEventListener('click', () => toggleCouponNumber(el.dataset.leg, el.dataset.num));
  });
}

// Clicking a number in a leg marks/unmarks that specific horse — the coupon
// always keeps at least one horse selected per leg (there's no such thing
// as a leg with zero picks in a real combination bet).
function toggleCouponNumber(raceKey, numStr) {
  const leg = couponState.legs[raceKey];
  if (!leg) return;
  if (leg.selected.has(numStr)) {
    if (leg.selected.size > 1) leg.selected.delete(numStr);
  } else {
    leg.selected.add(numStr);
  }
  renderCoupon();
}

function resetCouponToFavorites() {
  if (!state.rows.length) return;
  const effectiveWeights = computeEffectiveWeights(state.weights, computeEmptyCategories(state.rows));
  const groups = groupByRace(state.rows);
  groups.forEach((rows, raceKey) => {
    const scored = computeRaceScores(rows, effectiveWeights);
    if (!couponState.legs[raceKey]) couponState.legs[raceKey] = { included: true, selected: new Set() };
    couponState.legs[raceKey].selected = new Set([String(scored[0].row.kulvar)]);
  });
  const budgetInput = document.getElementById('targetBudgetInput');
  if (budgetInput) budgetInput.value = '';
  renderCoupon();
}

// Resets every included leg to just its favorite, then repeatedly makes a
// pass over all included legs adding one more horse — the leg's next-
// highest-scored pick — to each in turn, skipping only a leg whose next
// horse would push the total over budget. Passes repeat until a full pass
// adds nothing. This spreads the budget evenly across every included race
// (each gets a 2nd pick, then a 3rd, and so on) rather than sinking it all
// into widening a single leg, which a pure "cheapest next combo" greedy
// would do since growing an already-wide leg is always relatively cheaper.
function fillCouponToBudget(budget) {
  if (!state.rows.length || !(budget > 0)) return;
  const unitPrice = parseNumSmart(document.getElementById('unitPriceInput').value) || 0;
  if (!(unitPrice > 0)) { toast('Önce geçerli bir birim ücret girin.'); return; }

  const effectiveWeights = computeEffectiveWeights(state.weights, computeEmptyCategories(state.rows));
  const groups = groupByRace(state.rows);
  const raceKeys = [...groups.keys()];
  const scoredByRace = {};

  raceKeys.forEach(raceKey => {
    const scored = computeRaceScores(groups.get(raceKey), effectiveWeights);
    scoredByRace[raceKey] = scored;
    if (!couponState.legs[raceKey]) couponState.legs[raceKey] = { included: true, selected: new Set() };
    if (couponState.legs[raceKey].included) {
      couponState.legs[raceKey].selected = new Set([String(scored[0].row.kulvar)]);
    }
  });

  const includedKeys = raceKeys.filter(k => couponState.legs[k].included);
  if (!includedKeys.length) { toast('Bütçeye göre doldurmak için en az bir yarış "Dahil" olmalı.'); return; }

  let combos = 1;
  if (combos * unitPrice > budget) {
    toast(`Bütçe tek at (1 kombinasyon × ${unitPrice} TL = ${(unitPrice).toFixed(2)} TL) için bile yetersiz.`);
    renderCoupon();
    return;
  }

  let grew = true;
  while (grew) {
    grew = false;
    for (const raceKey of includedKeys) {
      const leg = couponState.legs[raceKey];
      const scored = scoredByRace[raceKey];
      const n = leg.selected.size;
      if (n >= scored.length) continue;
      const candidate = (combos / n) * (n + 1);
      if (candidate * unitPrice > budget) continue;
      const nextHorse = scored.find(s => !leg.selected.has(String(s.row.kulvar)));
      if (!nextHorse) continue;
      leg.selected.add(String(nextHorse.row.kulvar));
      combos = candidate;
      grew = true;
    }
  }

  renderCoupon();
}

/* ================================ FILE IMPORT ================================ */

// Excel exports of Turkish data are frequently saved as Windows-1254, not UTF-8;
// decoding those as UTF-8 mangles ş/ğ/ı/ö/ü/ç. Decode both and keep whichever
// produces fewer replacement characters.
function decodeCSVBuffer(buffer) {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  const utf8Bad = (utf8.match(/�/g) || []).length;
  if (utf8Bad === 0) return utf8;
  try {
    const alt = new TextDecoder('windows-1254', { fatal: false }).decode(buffer);
    const altBad = (alt.match(/�/g) || []).length;
    return altBad < utf8Bad ? alt : utf8;
  } catch (e) {
    return utf8;
  }
}

function handleFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = decodeCSVBuffer(reader.result);
      if (isOwnResultsExport(text)) {
        toast('Bu, uygulamanın ürettiği SONUÇ dosyası — girdi olarak yüklenemez. Lütfen TJK\'nın orijinal CSV Program dosyasını yükleyin.');
        return;
      }
      let result;
      if (isTjkProgramFormat(text)) {
        result = parseTjkProgramCSV(text);
      } else {
        const { headers, rows } = parseCSV(text);
        result = mapCSVToRows(headers, rows);
      }
      renderImportReport(result);
      if (!result.rows.length) {
        toast('Dosyada okunabilir satır bulunamadı. Sütun başlıklarını kontrol edin.');
        return;
      }
      state.rows = result.rows;
      state.fileName = file.name;
      ensureSyncCode();
      saveState();
      renderAll();
      const raceCount = groupByRace(result.rows).size;
      toast(`${result.rows.length} at, ${raceCount} yarış içeri aktarıldı.`);
    } catch (e) {
      toast('Dosya okunamadı: ' + e.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

function renderImportReport(result) {
  const el = document.getElementById('importReport');
  if (!el) return;
  const parts = [];
  if (result.unmatched.length) {
    parts.push(`<div class="report-line report-warn">⚠ Tanınmayan sütunlar (yok sayıldı): ${result.unmatched.map(escapeHtml).join(', ')}</div>`);
  }
  if (result.skipped > 0) {
    parts.push(`<div class="report-line report-warn">⚠ ${result.skipped} satır "At İsmi" sütunu boş/eşleşmediği için atlandı.</div>`);
  }
  if (result.matched.length) {
    parts.push(`<div class="report-line report-ok">✓ ${result.rows.length} / ${result.totalParsed} satır aktarıldı. Eşleşen sütunlar: ${result.matched.map(m => escapeHtml(m.header)).join(', ')}</div>`);
  } else {
    parts.push('<div class="report-line report-warn">⚠ Hiçbir sütun tanınmadı. Başlıkları örnek CSV ile karşılaştırın.</div>');
  }
  el.innerHTML = parts.join('');
  el.classList.remove('hidden');
}

function wireDropzone() {
  const dz = document.getElementById('dropzone');
  const input = document.getElementById('fileInput');
  dz.addEventListener('click', () => input.click());
  input.addEventListener('change', () => { if (input.files[0]) handleFile(input.files[0]); input.value = ''; });
  ['dragenter', 'dragover'].forEach(evt => dz.addEventListener(evt, e => {
    e.preventDefault(); dz.classList.add('dragover');
  }));
  ['dragleave', 'drop'].forEach(evt => dz.addEventListener(evt, e => {
    e.preventDefault(); dz.classList.remove('dragover');
  }));
  dz.addEventListener('drop', e => {
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
}

/* ================================ CSV EXPORT ================================= */

function downloadBlob(text, filename) {
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportResults() {
  if (!state.rows.length) return;
  const effectiveWeights = computeEffectiveWeights(state.weights, computeEmptyCategories(state.rows));
  const groups = groupByRace(state.rows);
  const lines = ['YarisNo;Sira;AtIsmi;Kulvar;Jokey;Antrenor;FormPuan;KiloHendikapMesafePuan;JokeyAntrenorPuan;PistZeminPuan;KompozitSkor'];
  groups.forEach((rows, raceKey) => {
    const scored = computeRaceScores(rows, effectiveWeights);
    scored.forEach((s, idx) => {
      lines.push([
        raceKey, idx + 1, s.row.atIsmi, s.row.kulvar || '', s.row.jokey || '', s.row.antrenor || '',
        s.form.toFixed(1), s.cat2.toFixed(1), s.cat3.toFixed(1), s.cat4.toFixed(1), s.composite.toFixed(1)
      ].map(v => String(v).replace(/;/g, ',')).join(';'));
    });
  });
  downloadBlob(lines.join('\n'), 'at_yarisi_sonuclari.csv');
}

function downloadSample() {
  const sample = [
    'YarisNo;AtIsmi;Kulvar;Jokey;Antrenor;Kilo;HP;Mesafe;Pist;Zemin;Son5;MesafeGalibiyet;MesafeKosu;PistGalibiyet;PistKosu;ZeminGalibiyet;ZeminKosu;JokeyGalibiyetYuzde;AntrenorGalibiyetYuzde;Ganyan',
    '1;Yıldız Rüzgarı;3;A. Yılmaz;M. Kaya;56;72;1400;Kum;İyi;1-2-1-4-3;3;8;5;12;4;9;18;14;3.2',
    '1;Kara Şimşek;5;B. Demir;C. Öz;58;68;1400;Kum;İyi;3-1-5-2-1;2;6;3;10;3;7;22;11;4.5',
    '1;Efe Sultan;1;C. Şahin;M. Kaya;54;65;1400;Kum;İyi;5-4-3-6-2;1;7;2;9;2;8;9;14;7.0',
    '1;Doru Fırtına;7;D. Aksoy;E. Polat;60;75;1400;Kum;İyi;2-1-1-3-2;4;9;6;13;5;10;16;19;2.8',
    '2;Gece Yıldızı;2;A. Yılmaz;E. Polat;53;60;1800;Çim;Sağlam;4-3-5-4-6;1;5;2;7;1;6;18;19;5.5',
    '2;Rüzgar Gülü;4;E. Kara;C. Öz;55;63;1800;Çim;Sağlam;2-2-1-3-1;3;6;4;8;3;7;10;11;3.9',
    '2;Altın Ok;6;B. Demir;M. Kaya;57;70;1800;Çim;Sağlam;1-1-2-1-3;5;8;6;10;5;9;22;14;2.1',
  ].join('\n');
  downloadBlob(sample, 'ornek_at_yarisi.csv');
}

/* =================================== INIT ===================================== */

function init() {
  initTheme();
  loadState();
  renderFieldLegend();
  wireDropzone();
  document.getElementById('sampleBtn').addEventListener('click', downloadSample);
  document.getElementById('recalcBtn').addEventListener('click', recalcAndRender);
  document.getElementById('addRowBtn').addEventListener('click', addEmptyRow);
  document.getElementById('resetWeightsBtn').addEventListener('click', resetWeights);
  document.getElementById('exportAllBtn').addEventListener('click', exportResults);
  document.getElementById('unitPriceInput').addEventListener('input', renderCoupon);
  document.getElementById('resetCouponBtn').addEventListener('click', resetCouponToFavorites);
  let budgetDebounceTimer = null;
  document.getElementById('targetBudgetInput').addEventListener('input', (e) => {
    clearTimeout(budgetDebounceTimer);
    const raw = e.target.value;
    budgetDebounceTimer = setTimeout(() => {
      const budget = parseNumSmart(raw) || 0;
      if (budget > 0) fillCouponToBudget(budget);
    }, 500);
  });
  document.getElementById('copySyncCodeBtn').addEventListener('click', () => {
    if (!state.syncCode) return;
    navigator.clipboard?.writeText(state.syncCode).then(() => toast('Kod kopyalandı.')).catch(() => {});
  });
  document.getElementById('joinCodeBtn').addEventListener('click', () => {
    joinSyncCode(document.getElementById('joinCodeInput').value);
  });
  renderSyncBar();
  if (state.syncCode) whenSyncReady(() => window.atYarisiSync.startPolling(state.syncCode, applyRemoteState));
  renderAll();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
