/*
 * home.js  --  Dashboard page controller
 * Team summary, season record, recent games, top performers.
 */
UI.boot('home', function () {
  const { el } = UI;
  const main = UI.qs('#main');
  const school = DB.getSchool(DB.getActiveSchoolId());
  const games = DB.getGames();
  const players = DB.getPlayers();
  const lines = DB.getBattingLines({ schoolId: DB.getActiveSchoolId() });
  const record = Stats.teamRecord(games);

  // Season leaders (min 2 AB to qualify for rate stats, keeps it honest).
  const season = Stats.seasonByPlayer(players, lines).filter((s) => s.totals.G > 0);
  const qualified = season.filter((s) => s.totals.AB >= 2);

  function topBy(list, key, rate) {
    return list
      .slice()
      .sort((a, b) => b.totals[key] - a.totals[key])
      .filter((s) => s.totals[key] > 0)
      .slice(0, 5)
      .map((s) => ({
        player: s.player,
        val: rate ? Stats.fmtRate(s.totals[key]) : String(s.totals[key]),
      }));
  }

  const recPct = record.played ? Stats.fmtRate(record.winPct) : '-';

  // ---------- HERO ----------
  const hero = el('section', { class: 'hero' }, [
    el('div', { class: 'container' }, [
      el('p', { class: 'eyebrow', text: (school ? school.name : '') + ' · ' + (school ? school.season : '') + ' SEASON' }),
      el('h1', { html: 'International High School<br>Baseball <span class="acc">Analytics</span>' }),
      el('p', { class: 'lede', text: 'A comprehensive sabermetrics platform that helps high school baseball players track performance, discover strengths, and reach their full potential.' }),
      el('div', { class: 'record-strip' }, [
        recStat('Record', `${record.W}-${record.L}-${record.T}`),
        recStat('Win %', recPct),
        recStat('Games', String(games.length)),
        recStat('Roster', String(players.length)),
      ]),
      el('div', { class: 'hero-actions' }, [
        el('a', { class: 'btn btn-accent', href: 'players.html' }, ['View Players']),
        el('a', { class: 'btn btn-ghost', href: 'games.html' }, ['Schedule & Results']),
      ]),
    ]),
  ]);

  function recStat(label, value) {
    return el('div', { class: 'rec' }, [
      el('div', { class: 'l', text: label }),
      el('div', { class: 'v num', text: value }),
    ]);
  }

  // ---------- TEAM KPIS ----------
  const teamTotals = Stats.derive(Stats.aggregate(lines));

  // ---------- 주요기록 (team summary, same table as the player page) ----------
  const gamesById = new Map(games.map((g) => [g.id, g]));
  const teamSeasons = Stats.buildSeasons(lines, gamesById, school, { pos: 'TEAM' });
  const teamMajorRows = Stats.majorRecordRows(teamSeasons).map((row) => AdvancedStats.compute(row, null));
  const majorRecordSection = el('section', { class: 'section major-records-section' }, [
    el('div', { class: 'container' }, [
      el('div', { class: 'section-head major-records-head' }, [
        el('div', {}, [el('p', { class: 'eyebrow', text: 'Team' }), el('h2', { class: 'major-records-title', text: 'Major Records' })]),
      ]),
      teamMajorRows.length
        ? el('div', { class: 'table-wrap', 'data-reveal': '' }, [UI.majorRecordTable(teamMajorRows)])
        : emptyBox('No game records yet.'),
    ]),
  ]);
  const kpis = el('section', { class: 'section' }, [
    el('div', { class: 'container' }, [
      el('div', { class: 'section-head' }, [
        el('div', {}, [el('p', { class: 'eyebrow', text: 'Team' }), el('h2', { text: 'Team Season Totals' })]),
      ]),
      el('div', { class: 'grid cols-4' }, [
        kpi('Team AVG', Stats.fmtRate(teamTotals.AVG), teamTotals.AVG, true, 3, 'AVG'),
        kpi('Team OPS', Stats.fmtRate(teamTotals.OPS), teamTotals.OPS, true, 3, 'OBP+SLG'),
        kpi('Total Hits', String(teamTotals.H), teamTotals.H, false, 0, `incl. ${teamTotals.HR} HR`),
        kpi('Total RBI', String(teamTotals.RBI), teamTotals.RBI, false, 0, `${teamTotals.R} runs scored`),
      ]),
    ]),
  ]);

  function kpi(label, _txt, countTo, rate, decimals, sub) {
    return el('div', { class: 'kpi', 'data-reveal': '' }, [
      el('div', { class: 'kpi-label', text: label }),
      el('div', {
        class: 'kpi-value num',
        'data-countup': String(countTo),
        'data-decimals': String(decimals),
        'data-rate': String(!!rate),
        text: '0',
      }),
      el('div', { class: 'kpi-sub', text: sub }),
    ]);
  }

  // ---------- RECENT GAMES ----------
  const recent = games.slice(0, 5);
  const recentSection = el('section', { class: 'section' }, [
    el('div', { class: 'container' }, [
      el('div', { class: 'section-head' }, [
        el('div', {}, [el('p', { class: 'eyebrow', text: 'Schedule' }), el('h2', { text: 'Recent Games' })]),
        el('a', { class: 'btn btn-ghost btn-sm', href: 'games.html' }, ['View All']),
      ]),
      recent.length
        ? el('div', { class: 'card', 'data-reveal': '' }, recent.map(gameRow))
        : emptyBox('No game records yet.'),
    ]),
  ]);

  function gameRow(g) {
    const badge = resultBadge(g.result);
    const scoreTxt =
      typeof g.ourScore === 'number' ? `${g.ourScore} : ${g.theirScore}` : 'No score';
    return el('a', { class: 'game-row row-link', href: `game.html?id=${g.id}` }, [
      el('span', { class: 'g-date num', text: g.date }),
      el('div', {}, [
        el('div', { class: 'g-opp', text: 'vs ' + g.opponent }),
        el('div', { class: 'g-event', text: g.event || '' }),
      ]),
      el('div', { style: 'display:flex;align-items:center;gap:.7rem;justify-content:flex-end' }, [
        el('span', { class: 'g-score num', text: scoreTxt }),
        badge,
      ]),
    ]);
  }

  // ---------- TOP PERFORMERS ----------
  const boards = [
    { title: 'AVG Leaders', key: 'AVG', rate: true, list: qualified },
    { title: 'OPS Leaders', key: 'OPS', rate: true, list: qualified },
    { title: 'Hits Leaders', key: 'H', rate: false, list: season },
    { title: 'RBI Leaders', key: 'RBI', rate: false, list: season },
  ];
  const performers = el('section', { class: 'section' }, [
    el('div', { class: 'container' }, [
      el('div', { class: 'section-head' }, [
        el('div', {}, [el('p', { class: 'eyebrow', text: 'Leaders' }), el('h2', { text: 'Season Top Performers' })]),
        el('a', { class: 'btn btn-ghost btn-sm', href: 'leaderboards.html' }, ['Full Leaderboard']),
      ]),
      el('div', { class: 'grid cols-2' }, boards.map((b, i) => leaderCard(b, i))),
    ]),
  ]);

  function leaderCard(b, i) {
    const rows = topBy(b.list, b.key, b.rate);
    return el('div', { class: 'card card-pad', 'data-reveal': '', 'data-reveal-delay': String(i * 60) }, [
      el('h3', { text: b.title }),
      rows.length
        ? el('div', { class: 'leader-list' }, rows.map((r, idx) => {
            const p = r.player;
            const place = idx + 1;
            const av = p.photo
              ? el('div', { class: 'avatar avatar-sm' }, [el('img', { src: p.photo, alt: p.name, loading: 'lazy' })])
              : el('div', { class: 'avatar avatar-sm', text: UI.initials(p.nameEn || p.name) });
            return el('a', { class: 'leader-item row-link', href: `player.html?id=${p.id}` }, [
              el('span', { class: 'rank num rank-' + (place <= 3 ? place : 'rest'), text: String(place) }),
              av,
              el('span', {}, [
                el('div', { class: 'li-name', text: p.nameEn || p.name }),
                el('div', { class: 'li-en', text: p.name }),
              ]),
              el('span', { class: 'li-val num', text: r.val }),
            ]);
          }))
        : el('p', { class: 'muted', text: 'Not enough data yet.' }),
    ]);
  }

  // ---------- helpers ----------
  function resultBadge(result) {
    if (result === 'W') return el('span', { class: 'badge badge-w', text: 'W' });
    if (result === 'L') return el('span', { class: 'badge badge-l', text: 'L' });
    if (result === 'T') return el('span', { class: 'badge badge-t', text: 'T' });
    return el('span', { class: 'badge badge-na', text: 'TBD' });
  }
  function emptyBox(msg) {
    return el('div', { class: 'card card-pad empty' }, [
      el('div', { class: 'big', text: '⚾' }),
      el('p', { class: 'muted', text: msg }),
      el('a', { class: 'btn btn-primary btn-sm', href: 'admin.html' }, ['Enter Data']),
    ]);
  }

  main.append(hero, kpis, majorRecordSection, recentSection, performers);
});
