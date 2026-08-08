/*
 * player.js  --  Player detail page
 * Profile header, season summary KPIs, and a per-game stat log.
 */
UI.boot('players', function () {
  const { el } = UI;
  const page = UI.qs('#page');
  const id = UI.param('id');
  const player = id && DB.getPlayer(id);

  if (!player) {
    page.append(el('div', { class: 'empty' }, [
      el('div', { class: 'big', text: '🤷' }),
      el('p', { class: 'muted', text: 'Player not found.' }),
      el('a', { class: 'btn btn-primary btn-sm', href: 'players.html' }, ['Back to Players']),
    ]));
    return;
  }

  const lines = DB.getBattingLines({ playerId: player.id });
  const season = Stats.derive(Stats.aggregate(lines));
  const school = DB.getSchool(player.schoolId);
  const gamesById = new Map(DB.getGames(player.schoolId).map((g) => [g.id, g]));
  const seasons = Stats.buildPlayerSeasons(player, lines, gamesById, school);
  const majorRecordRows = Stats.majorRecordRows(seasons)
    .map((row) => AdvancedStats.compute(row, player.position));

  // ---- back link ----
  page.append(el('a', { class: 'backlink', href: 'players.html' }, ['← Players']));

  // ---- profile hero ----
  const av = player.photo
    ? el('div', { class: 'avatar avatar-lg' }, [el('img', { src: player.photo, alt: player.name })])
    : el('div', { class: 'avatar avatar-lg', text: UI.initials(player.nameEn || player.name) });

  const chips = [
    player.position || null,
    `${season.G} GAMES`,
  ].filter(Boolean).map((c) => el('span', { class: 'chip', text: c }));

  page.append(el('div', { class: 'pd-hero', 'data-reveal': '' }, [
    player.number != null ? el('span', { class: 'pd-num', text: player.number }) : null,
    av,
    el('div', { class: 'pd-info' }, [
      el('div', { class: 'pd-name-en', text: player.name }),
      el('h1', { text: (player.number != null ? `#${player.number} ` : '') + (player.nameEn || player.name) }),
      el('div', { class: 'pd-meta' }, chips),
    ]),
    el('a', { class: 'btn btn-ghost btn-sm', style: 'position:relative;z-index:2', href: `admin.html?editPlayer=${player.id}` }, ['Edit Profile']),
  ]));

  // ---- season KPIs ----
  const kpiDefs = [
    ['AVG', season.AVG, true, 3],
    ['OBP', season.OBP, true, 3],
    ['SLG', season.SLG, true, 3],
    ['OPS', season.OPS, true, 3],
  ];
  page.append(el('div', { class: 'grid cols-4', style: 'margin-top:1.1rem' },
    kpiDefs.map(([label, val, rate, dec], i) =>
      el('div', { class: 'kpi', 'data-reveal': '', 'data-reveal-delay': String(i * 50) }, [
        el('div', { class: 'kpi-label', text: label }),
        el('div', { class: 'kpi-value num', 'data-countup': String(val), 'data-decimals': String(dec), 'data-rate': String(rate), text: '0' }),
      ])
    )
  ));

  // ---- counting stats row ----
  const counts = [
    ['G', season.G], ['AB', season.AB], ['H', season.H], ['HR', season.HR],
    ['RBI', season.RBI], ['R', season.R], ['BB', season.BB], ['SB', season.SB],
  ];
  page.append(el('div', { class: 'card card-pad', 'data-reveal': '', style: 'margin-top:1.1rem' }, [
    el('h3', { text: 'Season Totals' }),
    el('div', { class: 'counts-grid' },
      counts.map(([l, v]) => el('div', { class: 'count-cell' }, [
        el('div', { class: 'count-l', text: l }),
        el('div', { class: 'count-v', text: String(v) }),
      ]))
    ),
  ]));

  // ---- major record table ----
  page.append(el('div', { style: 'margin-top:1.5rem' }, [
    el('div', { class: 'section-head' }, [el('h2', { text: 'Major Records' })]),
    majorRecordRows.length
      ? el('div', { class: 'table-wrap', 'data-reveal': '' }, [UI.majorRecordTable(majorRecordRows)])
      : el('p', { class: 'muted', text: 'No records yet.' }),
  ]));

  // ---- per-game log ----
  // "This Game" columns are the raw box line plus wOBA -- a per-PA rate
  // stat that, like AVG, stays meaningful on a single game's sample.
  // "Season to Date" columns are the full advanced-stat suite computed
  // on every line UP TO AND INCLUDING that game -- oWAR/wRC+/etc need a
  // real accumulated-PA sample to mean anything, so they're only shown
  // as a running season total, never as a single-game number.
  const GAME_LOG_COLUMNS = [
    { key: 'date', label: 'Date', group: null, type: 'text' },
    { key: 'opp', label: 'Opp', group: null, type: 'text' },
    { key: 'AB', label: 'AB', group: 'game', type: 'int' },
    { key: 'H', label: 'H', group: 'game', type: 'int' },
    { key: '2B', label: '2B', group: 'game', type: 'int' },
    { key: '3B', label: '3B', group: 'game', type: 'int' },
    { key: 'HR', label: 'HR', group: 'game', type: 'int' },
    { key: 'RBI', label: 'RBI', group: 'game', type: 'int' },
    { key: 'R', label: 'R', group: 'game', type: 'int' },
    { key: 'BB', label: 'BB', group: 'game', type: 'int' },
    { key: 'SO', label: 'SO', group: 'game', type: 'int' },
    { key: 'AVG', label: 'AVG', group: 'game', type: 'rate-hl' },
    { key: 'wOBA', label: 'wOBA', group: 'game', type: 'woba' },
    { key: 'tdAVG', label: 'AVG', group: 'td', type: 'rate' },
    { key: 'tdOBP', label: 'OBP', group: 'td', type: 'rate' },
    { key: 'tdSLG', label: 'SLG', group: 'td', type: 'rate' },
    { key: 'tdOPS', label: 'OPS', group: 'td', type: 'rate' },
    { key: 'tdRePA', label: 'R/ePA', group: 'td', type: 'repa' },
    { key: 'tdWRCPlus', label: 'wRC+', group: 'td', type: 'wrc' },
    { key: 'tdOWAR', label: 'oWAR', group: 'td', type: 'war' },
    { key: 'tdDWAR', label: 'dWAR', group: 'td', type: 'war' },
    { key: 'tdWAR', label: 'WAR', group: 'td', type: 'war' },
  ];
  const GAME_LOG_GROUP_LABELS = { game: 'This Game', td: 'Season to Date' };

  function fmtGameLogCell(type, v) {
    switch (type) {
      case 'int': return String(v != null ? v : 0);
      case 'rate': case 'rate-hl': return Stats.fmtRate(v);
      case 'woba': return AdvancedStats.fmtWoba(v);
      case 'repa': return AdvancedStats.fmtRePA(v);
      case 'wrc': return AdvancedStats.fmtWRC(v);
      case 'war': return AdvancedStats.fmtWar(v);
      default: return v == null ? '-' : String(v);
    }
  }

  const gameRowsAsc = lines
    .map((l) => ({ line: l, game: DB.getGame(l.gameId) }))
    .filter((x) => x.game)
    .sort((a, b) => (a.game.date < b.game.date ? -1 : 1));

  // Walk games chronologically, accumulating lines so each game gets a
  // "season to date" totals snapshot as of that point in the season.
  const linesSoFar = [];
  const seasonToDateByGameId = new Map();
  gameRowsAsc.forEach(({ line, game }) => {
    linesSoFar.push(line);
    const totals = Stats.derive(Stats.aggregate(linesSoFar));
    seasonToDateByGameId.set(game.id, AdvancedStats.compute(totals, player.position));
  });

  const gameRows = gameRowsAsc.slice().sort((a, b) => (a.game.date < b.game.date ? 1 : -1));

  const logRows = gameRows.map(({ line, game }) => {
    const d = Stats.derive(line);
    const thisGame = AdvancedStats.compute(d, player.position);
    const td = seasonToDateByGameId.get(game.id);
    return {
      date: game.date, opp: 'vs ' + game.opponent,
      AB: line.AB, H: line.H, '2B': line['2B'], '3B': line['3B'], HR: line.HR,
      RBI: line.RBI, R: line.R, BB: line.BB, SO: line.SO,
      AVG: d.AVG, wOBA: thisGame.wOBA,
      tdAVG: td.AVG, tdOBP: td.OBP, tdSLG: td.SLG, tdOPS: td.OPS,
      tdRePA: td.RePA, tdWRCPlus: td.wRCPlus, tdOWAR: td.oWAR, tdDWAR: td.dWAR, tdWAR: td.WAR,
    };
  });

  // two-row grouped header, same pattern as UI.majorRecordTable
  const headRow1 = [];
  const headRow2 = [];
  let ci = 0;
  while (ci < GAME_LOG_COLUMNS.length) {
    const col = GAME_LOG_COLUMNS[ci];
    if (!col.group) {
      headRow1.push(el('th', { rowspan: '2', text: col.label }));
      ci++;
      continue;
    }
    let cj = ci;
    while (cj < GAME_LOG_COLUMNS.length && GAME_LOG_COLUMNS[cj].group === col.group) cj++;
    headRow1.push(el('th', { colspan: String(cj - ci), class: 'group-label', text: GAME_LOG_GROUP_LABELS[col.group] }));
    for (let k = ci; k < cj; k++) headRow2.push(el('th', { class: 'num', text: GAME_LOG_COLUMNS[k].label }));
    ci = cj;
  }

  const table = el('table', { class: 'stats major' }, [
    el('thead', {}, [el('tr', { class: 'group-row' }, headRow1), el('tr', {}, headRow2)]),
    el('tbody', {}, logRows.map((row) =>
      el('tr', {}, GAME_LOG_COLUMNS.map((col) =>
        el('td', {
          class: (col.type === 'text' ? '' : 'num') + (col.type === 'rate-hl' ? ' hl' : ''),
          text: col.type === 'text' ? row[col.key] : fmtGameLogCell(col.type, row[col.key]),
        })
      ))
    )),
  ]);

  page.append(el('div', { style: 'margin-top:1.5rem' }, [
    el('div', { class: 'section-head' }, [el('h2', { text: 'Game Log' })]),
    gameRows.length
      ? el('div', { class: 'table-wrap', 'data-reveal': '' }, [table])
      : el('p', { class: 'muted', text: 'No game records yet.' }),
  ]));
});
