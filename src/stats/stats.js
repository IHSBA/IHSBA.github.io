/*
 * stats.js -- pure baseball stat math. No fetching, no React, no DOM.
 * Operates on player_season_stats rows (see supabase/migrations/0001_init.sql)
 * plus games rows for team records.
 *
 * Raw counting fields the admin actually types per season:
 *   G, AB, R, H, 2B, 3B, HR, RBI, SB, CS, BB, HBP, IB, SO, GDP, SH, SF
 * PA, ePA, TB are always derived by this module and written alongside
 * the raw fields on save -- the admin never types them by hand.
 *
 * Derived rate stats:
 *   1B  = H - 2B - 3B - HR
 *   TB  = 1B + 2*(2B) + 3*(3B) + 4*(HR)
 *   AVG = H / AB
 *   OBP = (H + BB + HBP) / (AB + BB + HBP + SF)
 *   SLG = TB / AB
 *   OPS = OBP + SLG
 * Divide-by-zero guards to ".000" everywhere per spec.
 */

export const RAW_KEYS = [
  'AB', 'R', 'H', '2B', '3B', 'HR', 'RBI', 'BB', 'HBP', 'IB',
  'SB', 'CS', 'SO', 'GDP', 'SH', 'SF',
];

export function emptyRaw() {
  const o = { G: 0 };
  RAW_KEYS.forEach((k) => (o[k] = 0));
  return o;
}

export function totalBases(s) {
  const singles = (s.H || 0) - (s['2B'] || 0) - (s['3B'] || 0) - (s.HR || 0);
  return Math.max(0, singles + 2 * (s['2B'] || 0) + 3 * (s['3B'] || 0) + 4 * (s.HR || 0));
}

export function plateAppearances(s) {
  return (s.AB || 0) + (s.BB || 0) + (s.HBP || 0) + (s.SF || 0) + (s.SH || 0);
}

// Effective plate appearances (Statiz-style 유효타석): PA minus
// intentional walks and sac bunts, which aren't a real AB/pitcher duel.
export function effectivePA(pa, s) {
  return Math.max(0, pa - (s.IB || 0) - (s.SH || 0));
}

export function avg(s) {
  return s.AB > 0 ? s.H / s.AB : 0;
}
export function obp(s) {
  const denom = (s.AB || 0) + (s.BB || 0) + (s.HBP || 0) + (s.SF || 0);
  return denom > 0 ? ((s.H || 0) + (s.BB || 0) + (s.HBP || 0)) / denom : 0;
}
export function slg(s) {
  return s.AB > 0 ? totalBases(s) / s.AB : 0;
}
export function ops(s) {
  return obp(s) + slg(s);
}

// Given the raw fields an admin enters, compute TB/PA/ePA to persist
// alongside them (see player_season_stats columns).
export function computeStoredFields(raw) {
  const pa = plateAppearances(raw);
  return {
    TB: totalBases(raw),
    PA: pa,
    ePA: effectivePA(pa, raw),
  };
}

// Attach derived rate stats to a stats row (raw + TB/PA/ePA already set).
export function derive(row) {
  return {
    ...row,
    AVG: avg(row),
    OBP: obp(row),
    SLG: slg(row),
    OPS: ops(row),
  };
}

// Format a rate stat as ".312" / "1.045". Divide-by-zero -> ".000".
export function fmtRate(v) {
  if (v == null || !isFinite(v) || isNaN(v)) return '.000';
  const s = v.toFixed(3);
  return v < 1 ? s.replace(/^0/, '') : s;
}

// Sum an array of raw+derived rows into one totals object, then
// recompute ratio stats from the summed totals (never average rates).
const SUM_KEYS = ['G', 'PA', 'ePA', ...RAW_KEYS, 'TB'];
export function aggregate(rows) {
  const t = emptyRaw();
  t.PA = 0; t.ePA = 0; t.TB = 0;
  rows.forEach((r) => {
    SUM_KEYS.forEach((k) => (t[k] = (t[k] || 0) + (Number(r[k]) || 0)));
  });
  return derive(t);
}

// Team season record from games (W/L/T + runs for/against).
export function teamRecord(games) {
  const rec = { W: 0, L: 0, T: 0, played: 0, runsFor: 0, runsAgainst: 0 };
  games.forEach((g) => {
    if (g.result === 'W') rec.W++;
    else if (g.result === 'L') rec.L++;
    else if (g.result === 'T') rec.T++;
    if (g.result) rec.played++;
    if (typeof g.runs === 'number') rec.runsFor += g.runs;
    if (typeof g.allowed === 'number') rec.runsAgainst += g.allowed;
  });
  rec.winPct = rec.played > 0 ? rec.W / rec.played : 0;
  return rec;
}

// ------------------------------------------------------------------
// "주요기록" (major-record) table rows -- Div. aggregation views.
// Operates directly on a player's player_season_stats rows (one row
// per season already). Does not invent new inputs, only re-slices.
// ------------------------------------------------------------------

// Stat used to pick the "베스트" (single best) season. One-line change
// if the definition should move to WAR once oWAR/dWAR are trustworthy.
export const BEST_SEASON_METRIC = 'OPS';

function rowFrom(div, meta, totals) {
  return {
    Div: div,
    Year: meta.season ?? meta.year ?? '-',
    Team: meta.team ?? '-',
    Age: meta.age ?? '-',
    Pos: meta.pos ?? '-',
    ...totals,
  };
}

function thisSeasonRow(seasons, team, pos) {
  const latest = seasons[seasons.length - 1];
  if (!latest) return null;
  return rowFrom('Season', { season: latest.season, team, pos }, derive(latest));
}

// 144G pace: latest season's counting stats prorated to a 144-game
// season. Ratio stats stay equal to the actual season (a rate is a rate).
function pace144Row(seasons, team, pos) {
  const latest = seasons[seasons.length - 1];
  if (!latest || !latest.G) return null;
  const rate = 144 / latest.G;
  const scaled = {};
  const d = derive(latest);
  Object.keys(d).forEach((k) => {
    const v = d[k];
    const isRatio = k === 'AVG' || k === 'OBP' || k === 'SLG' || k === 'OPS';
    scaled[k] = typeof v === 'number' && !isRatio ? Math.round(v * rate) : v;
  });
  return rowFrom('144G', { season: latest.season, team, pos }, scaled);
}

function bestSeasonRow(seasons, team, pos) {
  if (!seasons.length) return null;
  const best = seasons.reduce((a, b) => (ops(b) > ops(a) ? b : a));
  return rowFrom('Best', { season: best.season, team, pos }, derive(best));
}

// Career: sum every season's counting stats, then recompute ratio
// stats from the summed totals (never average per-season rates).
function careerRow(seasons, team, pos) {
  if (!seasons.length) return null;
  const summed = aggregate(seasons);
  return rowFrom('Career', { season: String(seasons.length), team, pos }, summed);
}

// Build all four Div. rows for a player, in reference-table order.
export function majorRecordRows(seasons, team, pos) {
  const sorted = seasons.slice().sort((a, b) => (a.season < b.season ? -1 : a.season > b.season ? 1 : 0));
  return [
    thisSeasonRow(sorted, team, pos),
    pace144Row(sorted, team, pos),
    bestSeasonRow(sorted, team, pos),
    careerRow(sorted, team, pos),
  ].filter(Boolean);
}
