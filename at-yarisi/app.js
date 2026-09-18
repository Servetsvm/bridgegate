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
  kulvar:           ['kulvar','kulvarno','startno','no','kapıno','kapino','n'],
  jokey:            ['jokey','jockey'],
  antrenor:         ['antrenor','trainer'],
  kilo:             ['kilo','weight','taşıdığıkilo','tasidigikilo','sıklet','siklet'],
  hp:               ['hp','handikappuani','handicap','hendikap','hendikappuani','ratıng','rating'],
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
};

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.rows)) {
        state = { rows: parsed.rows, weights: { ...DEFAULT_WEIGHTS, ...(parsed.weights || {}) }, fileName: parsed.fileName || '' };
      }
    }
  } catch (e) {}
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

function parseCSV(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const lines = text.split(/\r\n|\n|\r/).filter(l => l.trim().length > 0);
  if (!lines.length) return { headers: [], rows: [] };
  const delim = detectDelimiter(lines[0]);

  const parseLine = (line) => {
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
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

function mapCSVToRows(headers, rows) {
  const matched = [];
  const unmatched = [];
  const headerKeys = headers.map(h => {
    const norm = normalizeHeader(h);
    const key = ALIAS_LOOKUP[norm] || fuzzyMatchHeader(norm);
    if (key) matched.push({ header: h, field: key });
    else if (h.trim() !== '') unmatched.push(h);
    return key;
  });

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
  Object.keys(state.weights).forEach(key => {
    const meta = WEIGHT_META[key];
    const val = state.weights[key];
    const item = document.createElement('div');
    item.className = 'weight-item';
    item.innerHTML = `
      <label>${meta.label} <span class="wval">%${val}</span></label>
      <input type="range" min="0" max="100" value="${val}" data-weight-key="${key}">
      <div class="wdesc">${meta.desc}</div>
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
  container.innerHTML = '';
  if (!state.rows.length) return;

  const groups = groupByRace(state.rows);
  groups.forEach((rows, raceKey) => {
    const scored = computeRaceScores(rows, state.weights);
    const block = document.createElement('div');
    block.className = 'race-block';

    const first = rows[0];
    const metaParts = [];
    if (first.mesafe) metaParts.push(first.mesafe + ' m');
    if (first.pist) metaParts.push(first.pist);
    if (first.zemin) metaParts.push(first.zemin);

    block.innerHTML = `
      <div class="race-block-head">
        <h3>Yarış ${escapeHtml(raceKey)}</h3>
        <span class="race-meta">${metaParts.map(escapeHtml).join(' · ')} · ${scored.length} at</span>
      </div>
      <div class="horse-row header-row">
        <span></span><span>At</span><span>Form</span><span>Kilo/HP/Mesafe</span><span>Jokey/Antrenör</span><span>Pist/Zemin</span><span>Skor</span>
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
        ${subscoreBar(s.form, s.formPartial)}
        ${subscoreBar(s.cat2, s.cat2Partial)}
        ${subscoreBar(s.cat3, s.cat3Partial)}
        ${subscoreBar(s.cat4, s.cat4Partial)}
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

function subscoreBar(val, partial) {
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
  document.getElementById('emptyState').classList.toggle('hidden', has);

  renderDatasetInfo();
  if (has) {
    renderWeightsGrid();
    renderReviewTable();
    renderResults();
  }
}

function recalcAndRender() {
  renderDatasetInfo();
  renderResults();
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
      const { headers, rows } = parseCSV(text);
      const result = mapCSVToRows(headers, rows);
      renderImportReport(result);
      if (!result.rows.length) {
        toast('Dosyada okunabilir satır bulunamadı. Sütun başlıklarını kontrol edin.');
        return;
      }
      state.rows = result.rows;
      state.fileName = file.name;
      saveState();
      renderAll();
      toast(`${result.rows.length} at içeri aktarıldı.`);
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
  const groups = groupByRace(state.rows);
  const lines = ['YarisNo;Sira;AtIsmi;Kulvar;Jokey;Antrenor;FormPuan;KiloHendikapMesafePuan;JokeyAntrenorPuan;PistZeminPuan;KompozitSkor'];
  groups.forEach((rows, raceKey) => {
    const scored = computeRaceScores(rows, state.weights);
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
  document.getElementById('exportAllBtn').addEventListener('click', exportResults);
  renderAll();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
