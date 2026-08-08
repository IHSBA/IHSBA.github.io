/*
 * players.js  --  Players grid page
 * Card per player (avatar + name + number + key stats). Sort + search.
 * Click a card -> player detail.
 */
UI.boot('players', function () {
  const { el } = UI;
  const page = UI.qs('#page');
  const players = DB.getPlayers();
  const lines = DB.getBattingLines({ schoolId: DB.getActiveSchoolId() });
  let season = Stats.seasonByPlayer(players, lines);

  let sortKey = 'AVG';
  let query = '';

  // ---- header + controls ----
  const search = el('input', {
    type: 'search', class: 'control', placeholder: 'Search players...', 'aria-label': 'Search players',
    oninput: (e) => { query = e.target.value.trim(); render(); },
  });
  const sortSel = el('select', {
    class: 'control', 'aria-label': 'Sort by',
    onchange: (e) => { sortKey = e.target.value; render(); },
  }, [
    optize('AVG', 'AVG'),
    optize('OPS', 'OPS'),
    optize('H', 'Hits'),
    optize('HR', 'HR'),
    optize('RBI', 'RBI'),
    optize('R', 'Runs'),
    optize('SB', 'SB'),
    optize('name', 'Name'),
  ]);
  function optize(v, label) { return el('option', { value: v }, [label]); }

  const head = el('div', { class: 'section-head' }, [
    el('div', {}, [el('p', { class: 'eyebrow', text: 'Roster' }), el('h1', { text: 'Players' })]),
    el('div', { style: 'display:flex;gap:.6rem;flex-wrap:wrap' }, [search, sortSel]),
  ]);

  const gridWrap = el('div', {});
  page.append(head, gridWrap);

  function render() {
    let list = season.slice();
    if (query) list = list.filter((s) => s.player.name.includes(query) || (s.player.nameEn || '').toLowerCase().includes(query.toLowerCase()));
    list.sort((a, b) => {
      if (sortKey === 'name') return (a.player.nameEn || a.player.name).localeCompare(b.player.nameEn || b.player.name);
      return (b.totals[sortKey] || 0) - (a.totals[sortKey] || 0);
    });

    gridWrap.innerHTML = '';
    if (!list.length) {
      gridWrap.append(el('div', { class: 'empty card card-pad' }, [
        el('div', { class: 'big', text: '🔍' }),
        el('p', { class: 'muted', text: 'No players found.' }),
        el('a', { class: 'btn btn-primary btn-sm', href: 'admin.html' }, ['Add Player']),
      ]));
      return;
    }
    const grid = el('div', { class: 'player-grid' }, list.map((s, i) => card(s, i)));
    gridWrap.append(grid);
    UI.activate(); // re-run reveal + tilt for the new nodes
  }

  function card(s, i) {
    const t = s.totals;
    const p = s.player;
    // Photo fills the media area; fall back to big initials on a color block.
    const media = el('div', { class: 'pc-media' }, [
      p.number != null ? el('span', { class: 'pc-num', text: p.number }) : null,
      p.photo
        ? el('img', { class: 'pc-img', src: p.photo, alt: p.name, loading: 'lazy' })
        : el('span', { class: 'pc-initials', text: UI.initials(p.nameEn || p.name) }),
      el('div', { class: 'pc-scrim' }),
      el('div', { class: 'pc-id' }, [
        el('div', { class: 'pc-name', text: p.nameEn || p.name }),
        el('div', { class: 'pc-name-en', text: p.name }),
        el('span', { class: 'pc-pos', text: p.position || (t.G ? `${t.G} GP` : 'ROSTER') }),
      ]),
    ]);
    return el('a', {
      class: 'player-card', href: `player.html?id=${p.id}`,
      'data-tilt': '', 'data-reveal': '', 'data-reveal-delay': String((i % 8) * 45),
    }, [
      media,
      el('div', { class: 'pc-stats' }, [
        miniStat('AVG', Stats.fmtRate(t.AVG)),
        miniStat('HR', String(t.HR)),
        miniStat('OPS', Stats.fmtRate(t.OPS)),
      ]),
    ]);
  }
  function miniStat(label, val) {
    return el('div', { class: 'pc-stat' }, [
      el('span', { class: 'v', text: val }),
      el('span', { class: 'l', text: label }),
    ]);
  }

  render();
});
