/*
 * game.js  --  Game detail page
 * Scoreboard (line score if available) + full box score table.
 */
UI.boot('games', function () {
  const { el } = UI;
  const page = UI.qs('#page');
  const id = UI.param('id');
  const game = id && DB.getGame(id);

  if (!game) {
    page.append(el('div', { class: 'empty' }, [
      el('div', { class: 'big', text: '🤷' }),
      el('p', { class: 'muted', text: 'Game not found.' }),
      el('a', { class: 'btn btn-primary btn-sm', href: 'games.html' }, ['Back to Games']),
    ]));
    return;
  }

  const school = DB.getSchool(game.schoolId) || { name: 'Fayston' };
  page.append(el('a', { class: 'backlink', href: 'games.html' }, ['← Games']));

  // ---- scoreboard header ----
  const scoreTxt = game.ourScore != null ? `${game.ourScore} : ${game.theirScore}` : 'No score';
  page.append(el('div', { class: 'card card-pad', 'data-reveal': '' }, [
    el('p', { class: 'muted', style: 'margin:0', text: `${game.date} · ${game.event || 'Game'}` }),
    el('div', { style: 'display:flex;align-items:center;gap:1rem;flex-wrap:wrap;margin-top:.4rem' }, [
      el('h1', { style: 'margin:0', text: `${school.name} vs ${game.opponent}` }),
      resultBadge(game.result),
    ]),
    el('div', { class: 'num', style: 'font-size:2.2rem;font-weight:800;margin-top:.3rem', text: scoreTxt }),
  ]));

  // ---- line score (innings) ----
  if (game.innings && game.innings.us && game.innings.us.length) {
    const n = Math.max(game.innings.us.length, game.innings.them.length);
    const header = el('tr', {}, [el('th', { text: '' })]
      .concat(Array.from({ length: n }, (_, i) => el('th', { class: 'num', text: String(i + 1) })))
      .concat([el('th', { class: 'num', text: 'R' })]));
    function lineRow(name, arr) {
      const total = arr.reduce((a, b) => a + b, 0);
      return el('tr', {}, [el('td', { text: name })]
        .concat(Array.from({ length: n }, (_, i) => el('td', { class: 'num', text: arr[i] != null ? String(arr[i]) : '-' })))
        .concat([el('td', { class: 'num hl', text: String(total) })]));
    }
    page.append(el('div', { class: 'table-wrap', 'data-reveal': '', style: 'margin-top:1.1rem' }, [
      el('table', { class: 'stats' }, [
        el('thead', {}, [header]),
        el('tbody', {}, [lineRow(school.name, game.innings.us), lineRow(game.opponent, game.innings.them)]),
      ]),
    ]));
  }

  // ---- box score ----
  const lines = DB.getBattingLines({ gameId: game.id });
  const cols = [
    ['Player', 'name'], ['AB', 'AB'], ['R', 'R'], ['H', 'H'], ['2B', '2B'], ['3B', '3B'],
    ['HR', 'HR'], ['RBI', 'RBI'], ['BB', 'BB'], ['SO', 'SO'], ['SB', 'SB'], ['AVG', 'AVG'],
  ];

  const rows = lines.map((l) => ({ line: l, player: DB.getPlayer(l.playerId) })).filter((x) => x.player);

  // team totals row
  const totals = Stats.aggregate(lines);
  const totalsD = Stats.derive(totals);

  const table = el('table', { class: 'stats' }, [
    el('thead', {}, [el('tr', {}, cols.map(([label, key]) =>
      el('th', { class: key === 'name' ? '' : 'num', text: label })))]),
    el('tbody', {}, rows.map(({ line, player }) => {
      const d = Stats.derive(line);
      return el('tr', { class: 'row-link', onclick: () => (location.href = `player.html?id=${player.id}`) },
        cols.map(([_, key]) => {
          if (key === 'name') return el('td', { text: player.nameEn || player.name });
          if (key === 'AVG') return el('td', { class: 'num hl', text: Stats.fmtRate(d.AVG) });
          return el('td', { class: 'num', text: String(line[key] != null ? line[key] : 0) });
        }));
    })),
    el('tfoot', {}, [el('tr', { style: 'font-weight:800' },
      cols.map(([_, key]) => {
        if (key === 'name') return el('td', { text: 'Team Total' });
        if (key === 'AVG') return el('td', { class: 'num hl', text: Stats.fmtRate(totalsD.AVG) });
        return el('td', { class: 'num', text: String(totals[key] != null ? totals[key] : 0) });
      }))]),
  ]);

  page.append(el('div', { style: 'margin-top:1.5rem' }, [
    el('div', { class: 'section-head' }, [el('h2', { text: 'Box Score' })]),
    rows.length ? el('div', { class: 'table-wrap', 'data-reveal': '' }, [table])
                : el('p', { class: 'muted', text: 'No player records yet.' }),
  ]));

  function resultBadge(result) {
    if (result === 'W') return el('span', { class: 'badge badge-w', text: 'W' });
    if (result === 'L') return el('span', { class: 'badge badge-l', text: 'L' });
    if (result === 'T') return el('span', { class: 'badge badge-t', text: 'T' });
    return el('span', { class: 'badge badge-na', text: 'TBD' });
  }
});
