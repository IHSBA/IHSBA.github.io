/*
 * advanced-stats.js  --  LEAGUE-CONTEXT STAT MATH
 * ------------------------------------------------------------------
 * wOBA, wRC+, R/ePA and WAR all require league-wide run-scoring
 * context that a single team's raw lines can't supply on their own
 * (league wOBA, league runs/PA, replacement level, positional value,
 * park factor). Those constants live in data/league-constants.json --
 * NOTHING here is hardcoded, so plugging in real league totals later
 * doesn't require touching this file.
 *
 * Where an input we don't track at all (a real defensive/fielding
 * metric for dWAR) is missing, the corresponding function returns
 * null and the UI renders "-" rather than a made-up number.
 *
 * Formula sources (widely-used, FanGraphs-style definitions):
 *   wOBA / wRC / wRC+ : https://library.fangraphs.com/offense/woba/
 *                        https://library.fangraphs.com/offense/wrc/
 *   WAR (position players): https://library.fangraphs.com/war/war-position-players/
 *   R/ePA (유효타석당 득점): Statiz uses this as the base rate that its
 *     own wRC+ is built from -- here it's wRC computed per ePA instead
 *     of per PA (see js/stats.js effectivePA / STATIZ.co.kr glossary).
 */
const AdvancedStats = (function () {
  const CONFIG_URL = 'data/league-constants.json';

  // Fallback constants if the config can't be fetched (e.g. file://).
  // Mirrors data/league-constants.json -- keep the two in sync.
  const DEFAULTS = {
    wOBAWeights: { wBB: 0.69, wHBP: 0.72, w1B: 0.89, w2B: 1.27, w3B: 1.62, wHR: 2.1 },
    wOBAScale: 1.15,
    leagueWOBA: 0.32,
    leagueRunsPerPA: 0.115,
    runsPerWin: 10,
    replacementRunsPer600PA: 20,
    leagueAdjustmentRuns: 0,
    parkFactor: 1.0,
    positionalAdjustmentsPer600PA: {
      C: 12.5, SS: 7.5, '2B': 2.5, '3B': 2.5, CF: 2.5, LF: -7.5, RF: -7.5, '1B': -12.5, DH: -17.5,
    },
    baserunningRunsPerSB: 0.2,
    baserunningRunsPerCS: -0.4,
  };

  let constants = null;
  const readyCallbacks = [];
  let isReady = false;

  function finishInit() {
    isReady = true;
    readyCallbacks.splice(0).forEach((cb) => cb());
  }
  function ready(cb) {
    if (isReady) cb();
    else readyCallbacks.push(cb);
  }
  function init() {
    fetch(CONFIG_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((c) => { constants = c; finishInit(); })
      .catch(() => { constants = DEFAULTS; finishInit(); });
  }

  // wOBA = (wBB*uBB + wHBP*HBP + w1B*1B + w2B*2B + w3B*3B + wHR*HR)
  //        / (AB + BB - IBB + SF + HBP)
  // Unintentional walks only in the numerator; IBB is excluded from
  // both, since an intentional pass isn't a real batting event.
  function woba(row, c) {
    const w = c.wOBAWeights;
    const singles = row.H - row['2B'] - row['3B'] - row.HR;
    const uBB = row.BB - (row.IBB || 0);
    const den = row.AB + row.BB - (row.IBB || 0) + row.SF + row.HBP;
    if (den <= 0) return null;
    const num = w.wBB * uBB + w.wHBP * row.HBP + w.w1B * singles + w.w2B * row['2B'] + w.w3B * row['3B'] + w.wHR * row.HR;
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

  // R/ePA: Statiz's "유효타석당 득점" -- run contribution per effective
  // PA, i.e. wRC computed against ePA instead of PA.
  function rPerEPA(row, c) {
    const runs = wrc(row, c);
    if (runs == null || !row.ePA) return null;
    return runs / row.ePA;
  }

  // wRC+ = (((wRAA/PA + lgR/PA) + (lgR/PA - park*lgR/PA)) / lgWRC/PA) * 100
  // League average wRAA is 0 by construction, so league wRC/PA == lgR/PA.
  function wrcPlus(row, c) {
    const raa = wraa(row, c);
    if (raa == null || !row.PA) return null;
    const lgRPerPA = c.leagueRunsPerPA;
    const parkAdj = lgRPerPA - c.parkFactor * lgRPerPA;
    return ((raa / row.PA + lgRPerPA + parkAdj) / lgRPerPA) * 100;
  }

  // Offensive WAR = (Batting Runs + Baserunning Runs + Positional
  // Adjustment + Replacement Runs) / Runs Per Win. Excludes fielding
  // (see dWAR below), matching the "offensive" half of fWAR.
  function oWar(row, c, position) {
    const raa = wraa(row, c);
    if (raa == null || !row.PA) return null;
    const battingRuns = raa + c.leagueAdjustmentRuns;
    const baserunningRuns = (row.SB || 0) * c.baserunningRunsPerSB + (row.CS || 0) * c.baserunningRunsPerCS;
    const posAdj = position && c.positionalAdjustmentsPer600PA[position] != null
      ? c.positionalAdjustmentsPer600PA[position] * (row.PA / 600)
      : 0;
    const replacementRuns = c.replacementRunsPer600PA * (row.PA / 600);
    return (battingRuns + baserunningRuns + posAdj + replacementRuns) / c.runsPerWin;
  }

  // dWAR needs a real fielding metric (UZR/DRS-style defensive runs),
  // which this team doesn't track (no putouts/assists/errors data).
  // Return null -- and WAR (which is oWAR + dWAR) can't honestly be
  // computed either without it, so it's also null.
  function dWar() {
    return null;
  }
  function totalWar(row, c, position) {
    const o = oWar(row, c, position);
    const d = dWar();
    return o != null && d != null ? o + d : null;
  }

  // Attach wOBA/RePA/wRCPlus/oWAR/dWAR/WAR to a Stats row (see
  // stats.js majorRecordRows). `row` must already have PA/ePA/AB/H/
  // 2B/3B/HR/BB/IBB/HBP/SF/SB/CS from Stats.derive(). wOBA alone is
  // safe to read off a single game (it's a per-PA rate stat, same
  // sample-size behavior as AVG); RePA/wRCPlus/oWAR/dWAR/WAR are only
  // meaningful once PA has accumulated over a real season sample --
  // see Stats.aggregate()'d "season-to-date" totals in player.js.
  function compute(row, position) {
    const c = constants || DEFAULTS;
    return Object.assign({}, row, {
      wOBA: woba(row, c),
      RePA: rPerEPA(row, c),
      wRCPlus: wrcPlus(row, c),
      oWAR: oWar(row, c, position),
      dWAR: dWar(),
      WAR: totalWar(row, c, position),
    });
  }

  function fmtWar(v) {
    return v == null || !isFinite(v) ? '-' : v.toFixed(2);
  }
  // Shared 3-decimal, leading-zero-dropped rate format (".312", "-").
  // wOBA and R/ePA are both per-PA rates on the same scale as AVG/OPS.
  function fmtRate3(v) {
    return v == null || !isFinite(v) ? '-' : v.toFixed(3).replace(/^0\./, '.');
  }
  function fmtWRC(v) {
    return v == null || !isFinite(v) ? '-' : v.toFixed(1);
  }

  init();

  return { ready, compute, fmtWar, fmtRePA: fmtRate3, fmtWoba: fmtRate3, fmtWRC, DEFAULTS };
})();
