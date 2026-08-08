/*
 * advancedStats.js -- league-context stat math: wOBA, wRC+, R/ePA, WAR.
 *
 * These can't be derived from a single team's raw lines alone -- they
 * need league-wide run-scoring context (league wOBA, league runs/PA,
 * replacement level, positional adjustment, park factor). Those live in
 * data/league-constants.json. NOTHING here is hardcoded, so plugging in
 * real league totals later only means editing that file.
 *
 * dWAR needs a real fielding metric (UZR/DRS-style defensive runs) this
 * team doesn't track. Its function returns null, and WAR (oWAR + dWAR)
 * is null too, rather than a made-up number. The UI renders "-" for null.
 *
 * Formula sources (FanGraphs-style linear weights):
 *   wOBA / wRC / wRC+ : https://library.fangraphs.com/offense/woba/
 *                        https://library.fangraphs.com/offense/wrc/
 *   WAR (position players): https://library.fangraphs.com/war/war-position-players/
 *   R/ePA (유효타석당 득점): Statiz's base rate for its own wRC+, computed
 *     here as wRC per effective PA instead of per raw PA.
 */
import leagueConstants from '../../data/league-constants.json';

export const DEFAULT_CONSTANTS = leagueConstants;

// wOBA = (wBB*uBB + wHBP*HBP + w1B*1B + w2B*2B + w3B*3B + wHR*HR)
//        / (AB + BB - IB + SF + HBP)
// Unintentional walks only in the numerator; intentional walks (IB) are
// excluded from both -- an intentional pass isn't a real batting event.
function woba(row, c) {
  const w = c.wOBAWeights;
  const singles = (row.H || 0) - (row['2B'] || 0) - (row['3B'] || 0) - (row.HR || 0);
  const uBB = (row.BB || 0) - (row.IB || 0);
  const den = (row.AB || 0) + (row.BB || 0) - (row.IB || 0) + (row.SF || 0) + (row.HBP || 0);
  if (den <= 0) return null;
  const num =
    w.wBB * uBB + w.wHBP * (row.HBP || 0) + w.w1B * singles +
    w.w2B * (row['2B'] || 0) + w.w3B * (row['3B'] || 0) + w.wHR * (row.HR || 0);
  return num / den;
}

// wRAA = ((wOBA - lgwOBA) / wOBAScale) * PA
function wraa(row, c) {
  const w = woba(row, c);
  if (w == null || !row.PA) return null;
  return ((w - c.leagueWOBA) / c.wOBAScale) * row.PA;
}

// wRC = wRAA + lgR/PA * PA
function wrc(row, c) {
  const raa = wraa(row, c);
  if (raa == null) return null;
  return raa + c.leagueRunsPerPA * row.PA;
}

// R/ePA: wRC computed against ePA instead of PA.
function rPerEPA(row, c) {
  const runs = wrc(row, c);
  if (runs == null || !row.ePA) return null;
  return runs / row.ePA;
}

// wRC+ = (((wRAA/PA + lgR/PA) + (lgR/PA - park*lgR/PA)) / lgR/PA) * 100
// League-average wRAA is 0 by construction, so league wRC/PA == lgR/PA.
function wrcPlus(row, c) {
  const raa = wraa(row, c);
  if (raa == null || !row.PA) return null;
  const lgRPerPA = c.leagueRunsPerPA;
  const parkAdj = lgRPerPA - c.parkFactor * lgRPerPA;
  return ((raa / row.PA + lgRPerPA + parkAdj) / lgRPerPA) * 100;
}

// Offensive WAR = (Batting Runs + Baserunning Runs + Positional
// Adjustment + Replacement Runs) / Runs Per Win. Excludes fielding.
function oWar(row, c, position) {
  const raa = wraa(row, c);
  if (raa == null || !row.PA) return null;
  const battingRuns = raa + c.leagueAdjustmentRuns;
  const baserunningRuns = (row.SB || 0) * c.baserunningRunsPerSB + (row.CS || 0) * c.baserunningRunsPerCS;
  const posAdj =
    position && c.positionalAdjustmentsPer600PA[position] != null
      ? c.positionalAdjustmentsPer600PA[position] * (row.PA / 600)
      : 0;
  const replacementRuns = c.replacementRunsPer600PA * (row.PA / 600);
  return (battingRuns + baserunningRuns + posAdj + replacementRuns) / c.runsPerWin;
}

function dWar() {
  return null;
}
function totalWar(row, c, position) {
  const o = oWar(row, c, position);
  const d = dWar();
  return o != null && d != null ? o + d : null;
}

// Attach wOBA/RePA/wRCPlus/oWAR/dWAR/WAR to an already-derived stats row
// (row must have PA/ePA/AB/H/2B/3B/HR/BB/IB/HBP/SF/SB/CS).
export function computeAdvanced(row, position, constants) {
  const c = constants || DEFAULT_CONSTANTS;
  return {
    ...row,
    wOBA: woba(row, c),
    RePA: rPerEPA(row, c),
    wRCPlus: wrcPlus(row, c),
    oWAR: oWar(row, c, position),
    dWAR: dWar(),
    WAR: totalWar(row, c, position),
  };
}

export function fmtWar(v) {
  return v == null || !isFinite(v) ? '-' : v.toFixed(2);
}
// Shared 3-decimal, leading-zero-dropped rate format (".312", "-").
export function fmtRate3(v) {
  return v == null || !isFinite(v) ? '-' : v.toFixed(3).replace(/^0\./, '.');
}
export function fmtWRC(v) {
  return v == null || !isFinite(v) ? '-' : v.toFixed(1);
}
