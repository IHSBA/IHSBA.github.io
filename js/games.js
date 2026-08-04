/*
 * games.js  --  Games list page
 * Sortable table of all games. Click a row -> game detail.
 */
UI.boot('games', function () {
  const { el } = UI;
  const page = UI.qs('#page');
  const games = DB.getGames();
  const record = Stats.teamRecord(games);

  let sortKey = 'date';
  let sortDir = -1; // newest first

  page.append(el('div', { class: 'section-head' }, [
    el('div', {}, [el('p', { class: 'eyebrow', text: 'Schedule & Results' }), el('h1', { text: 'Games' })]),
    el('div', { class: 'segmented' }, [
      el('span', { class: 'badge badge-w', style: 'margin:.3rem', text: `${record.W}W` }),
      el('span', { class: 'badge badge-l', style: 'margin:.3rem', text: `${record.L}L` }),
      el('span', { class: 'badge badge-t', style: 'margin:.3rem', text: `${record.T}T` }),
    ]),
  ]));

  if (!games.length) {
    page.append(el('div', { class: 'empty card card-pad' }, [
      el('div', { class: 'big', text: '⚾' }),
      el('p', { class: 'muted', text: 'No game records yet.' }),
      el('a', { class: 'btn btn-primary btn-sm', href: 'admin.html' }, ['Add Game']),
    ]));
    return;
  }

  const cols = [
    ['Date', 'date', false],
    ['Opponent', 'opponent', false],
    ['Event', 'event', false],
    ['Runs', 'ourScore', true],
    ['Allowed', 'theirScore', true],
    ['Result', 'result', false],
  ];

  const wrap = el('div', { class: 'table-wrap', 'data-reveal': '' });
  page.append(wrap);

  function render() {
    const sorted = games.slice().sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (av == null) av = sortDir === 1 ? Infinity : -Infinity;
      if (bv == null) bv = sortDir === 1 ? Infinity : -Infinity;
      if (av < bv) return -1 * sortDir;
      if (av > bv) return 1 * sortDir;
      return 0;
    });

    const thead = el('thead', {}, [el('tr', {}, cols.map(([label, key, isNum]) => {
      const active = key === sortKey;
      return el('th', {
        class: [isNum ? 'num' : '', 'sortable', active ? 'sort-active' : ''].join(' ').trim(),
        onclick: () => { if (sortKey === key) sortDir *= -1; else { sortKey = key; sortDir = isNum ? -1 : 1; } render(); },
      }, [label + ' ', active ? el('span', { class: 'arrow', text: sortDir === 1 ? '▲' : '▼' }) : '']);
    }))]);

    const tbody = el('tbody', {}, sorted.map((g) =>
      el('tr', { class: 'row-link', onclick: () => (location.href = `game.html?id=${g.id}`) }, [
        el('td', { class: 'num', text: g.date }),
        el('td', { text: 'vs ' + g.opponent }),
        el('td', { class: 'muted', text: g.event || '-' }),
        el('td', { class: 'num', text: g.ourScore != null ? String(g.ourScore) : '-' }),
        el('td', { class: 'num', text: g.theirScore != null ? String(g.theirScore) : '-' }),
        el('td', {}, [resultBadge(g.result)]),
      ])
    ));

    wrap.innerHTML = '';
    wrap.append(el('table', { class: 'stats' }, [thead, tbody]));
  }

  function resultBadge(result) {
    if (result === 'W') return el('span', { class: 'badge badge-w', text: 'W' });
    if (result === 'L') return el('span', { class: 'badge badge-l', text: 'L' });
    if (result === 'T') return el('span', { class: 'badge badge-t', text: 'T' });
    return el('span', { class: 'badge badge-na', text: 'TBD' });
  }

  render();
});
