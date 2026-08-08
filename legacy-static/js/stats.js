/*
 * stats.js  --  STAT MATH
 * ------------------------------------------------------------------
 * Pure functions. No storage, no DOM. Takes raw batting lines and
 * produces derived/aggregated baseball statistics.
 *
 * Raw inputs per line: AB, R, H, 2B, 3B, HR, RBI, BB, IBB, HBP, SF,
 *   SAC, SB, CS, SO, GIDP, LOB, TB.
 *
 * Derived:
 *   AVG = H / AB                         (타율 batting average)
 *   OBP = (H+BB+HBP) / (AB+BB+HBP+SF)    (출루율 on-base %)
 *   SLG = totalBases / AB                (장타율 slugging)
 *   OPS = OBP + SLG
 *   totalBases = singles + 2*2B + 3*3B + 4*HR
 *     singles = H - 2B - 3B - HR
 *
 * NOTE on 타율 vs 안타율: the user mentioned both. 타율 is the standard
 * batting average (AVG = H/AB), which is what we implement. There is no
 * separate standard "안타율" metric, so we treat them as the same thing.
 */
const Stats = (function () {
  const RAW_KEYS = [
    'AB', 'R', 'H', '2B', '3B', 'HR', 'RBI', 'BB', 'IBB', 'HBP',
    'SF', 'SAC', 'SB', 'CS', 'SO', 'GIDP', 'LOB', 'TB',
  ];

  function empty() {
    const o = {};
    RAW_KEYS.forEach((k) => (o[k] = 0));
    o.G = 0; // games / appearances
    return o;
  }

  // Sum an array of batting lines into one totals object.
  function aggregate(lines) {
    const t = empty();
    lines.forEach((l) => {
      RAW_KEYS.forEach((k) => (t[k] += Number(l[k]) || 0));
      t.G += 1;
    });
    return t;
  }

  // Total bases from a totals/line object. Uses recorded TB if present
  // and non-zero, otherwise computes from the hit breakdown.
  function totalBases(s) {
    const computed =
      (s.H - s['2B'] - s['3B'] - s.HR) + 2 * s['2B'] + 3 * s['3B'] + 4 * s.HR;
    // Prefer the computed value; it is always internally consistent.
    return Math.max(0, computed);
  }

  function avg(s) {
    return s.AB > 0 ? s.H / s.AB : 0;
  }
  function obp(s) {
    const denom = s.AB + s.BB + s.HBP + s.SF;
    return denom > 0 ? (s.H + s.BB + s.HBP) / denom : 0;
  }
  function slg(s) {
    return s.AB > 0 ? totalBases(s) / s.AB : 0;
  }
  function ops(s) {
    return obp(s) + slg(s);
  }

  // Effective plate appearances (Statiz-style 유효타석): PA minus the
  // "non-competitive" plate appearances -- intentional walks and sac
  // bunts -- that don't reflect a real batter/pitcher confrontation.
  function effectivePA(pa, s) {
    return Math.max(0, pa - (s.IBB || 0) - (s.SAC || 0));
  }

  // Attach derived rate stats to a totals object -> a "stat card".
  function derive(s) {
    const pa = s.AB + s.BB + s.HBP + s.SF + s.SAC; // plate appearances
    return Object.assign({}, s, {
      TB: totalBases(s),
      PA: pa,
      ePA: effectivePA(pa, s),
      AVG: avg(s),
      OBP: obp(s),
      SLG: slg(s),
      OPS: ops(s),
    });
  }

  // Format a rate stat as ".312" / "1.045". Divide-by-zero -> ".000".
  function fmtRate(v) {
    if (!isFinite(v) || isNaN(v)) return '.000';
    const s = v.toFixed(3);
    // Drop the leading zero for values below 1 (baseball convention).
    return v < 1 ? s.replace(/^0/, '') : s;
  }

  // Build a per-player season summary for a list of players using all
  // their batting lines. Returns [{ player, totals(derived) }].
  function seasonByPlayer(players, allLines) {
    const byPlayer = new Map();
    allLines.forEach((l) => {
      if (!byPlayer.has(l.playerId)) byPlayer.set(l.playerId, []);
      byPlayer.get(l.playerId).push(l);
    });
    return players.map((p) => ({
      player: p,
      totals: derive(aggregate(byPlayer.get(p.id) || [])),
    }));
  }

  // Team season record from games (only games with a known result count).
  function teamRecord(games) {
    const rec = { W: 0, L: 0, T: 0, played: 0, runsFor: 0, runsAgainst: 0 };
    games.forEach((g) => {
      if (g.result === 'W') rec.W++;
      else if (g.result === 'L') rec.L++;
      else if (g.result === 'T') rec.T++;
      if (g.result) rec.played++;
      if (typeof g.ourScore === 'number') rec.runsFor += g.ourScore;
      if (typeof g.theirScore === 'number') rec.runsAgainst += g.theirScore;
    });
    rec.winPct = rec.played > 0 ? rec.W / rec.played : 0;
    return rec;
  }

  // ------------------------------------------------------------------
  // "주요기록" (major-record) table rows -- Div. aggregation views.
  // These do NOT invent new per-game inputs; they only re-slice/re-sum
  // a player's existing season records. See advanced-stats.js for the
  // oWAR/dWAR/WAR/R-ePA/wRC+ columns, which need league context.
  // ------------------------------------------------------------------

  // The stat used to pick the "베스트" (single best) season. Documented
  // as a constant so it's a one-line change if the definition should
  // move to WAR once oWAR/dWAR are trustworthy.
  const BEST_SEASON_METRIC = 'OPS';

  // Group batting lines into one record per season, using (in priority
  // order) the game's own season tag, the school's season label, or the
  // calendar year of the game date. Returns
  // [{ year, team, pos, totals(derived w/ ePA) }], sorted oldest->newest.
  // `meta` supplies the Team/Pos values to stamp on each season (a
  // player's position, or a team-wide label for the roster summary).
  function buildSeasons(lines, gamesById, school, meta) {
    meta = meta || {};
    const byKey = new Map();
    lines.forEach((line) => {
      const game = gamesById.get(line.gameId);
      const year = (game && game.season) || (school && school.season) ||
        (game && game.date ? game.date.slice(0, 4) : '-');
      if (!byKey.has(year)) byKey.set(year, []);
      byKey.get(year).push(line);
    });
    return Array.from(byKey.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .map(([year, seasonLines]) => ({
        year,
        team: (school && (school.shortName || school.name)) || '-',
        pos: meta.pos || '-',
        totals: derive(aggregate(seasonLines)),
      }));
  }

  // Convenience wrapper for a single player's seasons.
  function buildPlayerSeasons(player, lines, gamesById, school) {
    return buildSeasons(lines, gamesById, school, { pos: player && player.position });
  }

  // Shared metadata + counting/ratio fields for one table row.
  function rowFrom(div, meta, totals) {
    return Object.assign({ Div: div, Year: meta.year, Team: meta.team, Age: meta.age != null ? meta.age : '-', Pos: meta.pos }, totals);
  }

  // Season (This Season): the player's most recent season, as-is.
  function thisSeasonRow(seasons) {
    const latest = seasons[seasons.length - 1];
    if (!latest) return null;
    return rowFrom('Season', latest, latest.totals);
  }

  // 144G (144-Game Pace): most recent season's counting stats prorated
  // to a 144-game season. Ratio stats are unchanged (rate stays a rate).
  function pace144Row(seasons) {
    const latest = seasons[seasons.length - 1];
    if (!latest || !latest.totals.G) return null;
    const rate = 144 / latest.totals.G;
    const scaled = {};
    Object.keys(latest.totals).forEach((k) => {
      const v = latest.totals[k];
      const isRatio = k === 'AVG' || k === 'OBP' || k === 'SLG' || k === 'OPS';
      scaled[k] = typeof v === 'number' && !isRatio ? Math.round(v * rate) : v;
    });
    return rowFrom('144G', latest, scaled);
  }

  // Best: the single season with the highest BEST_SEASON_METRIC.
  function bestSeasonRow(seasons) {
    if (!seasons.length) return null;
    const best = seasons.reduce((a, b) =>
      b.totals[BEST_SEASON_METRIC] > a.totals[BEST_SEASON_METRIC] ? b : a
    );
    return rowFrom('Best', best, best.totals);
  }

  // Career: sum every season's counting stats, then recompute
  // ratio stats from the summed totals (never average per-season rates).
  function careerRow(seasons) {
    if (!seasons.length) return null;
    // aggregate() expects raw lines with per-line G=1 semantics; season
    // totals already carry a real G, so sum manually instead.
    const summed = empty();
    seasons.forEach((s) => {
      RAW_KEYS.forEach((k) => (summed[k] += s.totals[k] || 0));
      summed.G += s.totals.G || 0;
    });
    const meta = {
      year: String(seasons.length),
      team: seasons[seasons.length - 1].team,
      pos: seasons[seasons.length - 1].pos,
    };
    return rowFrom('Career', meta, derive(summed));
  }

  // Build all four Div. rows for a player in reference-table order.
  function majorRecordRows(seasons) {
    return [thisSeasonRow(seasons), pace144Row(seasons), bestSeasonRow(seasons), careerRow(seasons)]
      .filter(Boolean);
  }

  return {
    RAW_KEYS,
    BEST_SEASON_METRIC,
    empty,
    aggregate,
    derive,
    totalBases,
    avg,
    obp,
    slg,
    ops,
    fmtRate,
    seasonByPlayer,
    teamRecord,
    buildSeasons,
    buildPlayerSeasons,
    majorRecordRows,
  };
})();
