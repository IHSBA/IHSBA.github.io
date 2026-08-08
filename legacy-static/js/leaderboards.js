/*
 * leaderboards.js  --  Full sortable leaderboard table
 * Sort players by any stat. Rate stats require a minimum AB to qualify.
 */
UI.boot('leaders', function () {
  const { el } = UI;
  const page = UI.qs('#page');
  const players = DB.getPlayers();
  const lines = DB.getBattingLines({ schoolId: DB.getActiveSchoolId() });
  const season = Stats.seasonByPlayer(players, lines).filter((s) => s.totals.G > 0);

  let sortKey = 'OPS';
  let sortDir = -1;
  let minAB = 2; // qualifier for rate stats

  const rateKeys = new Set(['AVG', 'OBP', 'SLG', 'OPS']);
  const cols = [
    ['Player', 'name', false],
    ['G', 'G', true],
    ['AB', 'AB', true],
    ['H', 'H', true],
    ['AVG', 'AVG', true],
    ['OBP', 'OBP', true],
    ['SLG', 'SLG', true],
    ['OPS', 'OPS', true],
    ['HR', 'HR', true],
    ['RBI', 'RBI', true],
    ['R', 'R', true],
    ['SB', 'SB', true],
    ['BB', 'BB', true],
    ['SO', 'SO', true],
  ];

  page.append(el('div', { class: 'section-head' }, [
    el('div', {}, [el('p', { class: 'eyebrow', text: 'Leaderboards' }), el('h1', { text: 'Leaderboards' })]),
  ]));

  // quick-sort chips
  const chips = [
    ['AVG', 'AVG'], ['OPS', 'OPS'], ['HR', 'HR'], ['RBI', 'RBI'], ['H', 'H'], ['SB', 'SB'],
  ];
  const chipBar = el('div', { class: 'segmented', style: 'margin-bottom:1rem' },
    chips.map(([label, key]) => el('button', {
      class: key === sortKey ? 'active' : '',
      onclick: () => { sortKey = key; sortDir = -1; render(); },
    }, [label]))
  );

  const qualNote = el('label', { class: 'muted', style: 'display:flex;align-items:center;gap:.5rem;font-size:.85rem;margin-bottom:1rem' }, [
    'Min. AB to qualify for rate stats: ',
    el('input', {
      type: 'number', min: '0', value: String(minAB),
      style: 'width:70px;padding:.3rem .5rem;border:1px solid var(--line-2);border-radius:8px;background:var(--ink-2);color:var(--text)',
      onchange: (e) => { minAB = parseInt(e.target.value, 10) || 0; render(); },
    }),
  ]);

  const podium = el('div', { class: 'podium', 'data-reveal': '' });
  page.append(podium);

  page.append(chipBar, qualNote);
  const wrap = el('div', { class: 'table-wrap', 'data-reveal': '' });
  page.append(wrap);

  function value(s, key) {
    if (key === 'name') return s.player.nameEn || s.player.name;
    return s.totals[key] || 0;
  }

  function playerAvatar(p, cls) {
    return p.photo
      ? el('div', { class: cls }, [el('img', { src: p.photo, alt: p.name, loading: 'lazy' })])
      : el('div', { class: cls, text: UI.initials(p.nameEn || p.name) });
  }

  function renderPodium(list) {
    podium.innerHTML = '';
    const top3 = list.slice(0, 3);
    if (!top3.length) return;
    podium.append(...top3.map((s, idx) => {
      const place = idx + 1;
      const rate = rateKeys.has(sortKey);
      const val = rate ? Stats.fmtRate(s.totals[sortKey]) : String(s.totals[sortKey] || 0);
      return el('a', { class: `podium-card rank-${place}`, href: `player.html?id=${s.player.id}` }, [
        el('div', { class: 'podium-rank num', text: String(place) }),
        playerAvatar(s.player, 'avatar podium-avatar'),
        el('div', { class: 'podium-name', text: s.player.nameEn || s.player.name }),
        el('div', { class: 'podium-en', text: s.player.name }),
        el('div', { class: 'podium-val num', text: val }),
        el('div', { class: 'podium-stat', text: sortKey }),
      ]);
    }));
  }

  function render() {
    // refresh chip active state
    UI.qsa('button', chipBar).forEach((b, i) => b.classList.toggle('active', chips[i][1] === sortKey));

    let list = season.slice();
    // For rate-stat sorting, push unqualified players to the bottom.
    const qualified = (s) => s.totals.AB >= minAB;

    list.sort((a, b) => {
      if (sortKey === 'name') return (a.player.nameEn || a.player.name).localeCompare(b.player.nameEn || b.player.name) * sortDir;
      if (rateKeys.has(sortKey)) {
        const aq = qualified(a), bq = qualified(b);
        if (aq !== bq) return aq ? -1 : 1; // qualified first
      }
      return (value(b, sortKey) - value(a, sortKey)) * (sortDir === -1 ? 1 : -1);
    });

    renderPodium(list.filter((s) => (rateKeys.has(sortKey) ? qualified(s) : true)));

    const thead = el('thead', {}, [el('tr', {}, cols.map(([label, key, isNum]) => {
      const active = key === sortKey;
      return el('th', {
        class: [isNum ? 'num' : '', 'sortable', active ? 'sort-active' : ''].join(' ').trim(),
        onclick: () => { if (sortKey === key) sortDir *= -1; else { sortKey = key; sortDir = isNum ? -1 : 1; } render(); },
      }, [label + ' ', active ? el('span', { class: 'arrow', text: sortDir === 1 ? '▲' : '▼' }) : '']);
    }))]);

    const tbody = el('tbody', {}, list.map((s, idx) => {
      const t = s.totals;
      return el('tr', { class: 'row-link', onclick: () => (location.href = `player.html?id=${s.player.id}`) },
        cols.map(([_, key]) => {
          if (key === 'name') {
            const unq = rateKeys.has(sortKey) && !qualified(s);
            return el('td', { class: 'name-cell' }, [
              el('span', { class: 'num', style: 'color:var(--faint);margin-right:.5rem', text: String(idx + 1) }),
              playerAvatar(s.player, 'avatar avatar-xs'),
              el('span', { text: (s.player.nameEn || s.player.name) + (unq ? ' *' : '') }),
            ]);
          }
          if (rateKeys.has(key)) {
            const cls = key === sortKey ? 'num hl' : 'num';
            return el('td', { class: cls, text: Stats.fmtRate(t[key]) });
          }
          return el('td', { class: key === sortKey ? 'num hl' : 'num', text: String(t[key] || 0) });
        }));
    }));

    wrap.innerHTML = '';
    wrap.append(el('table', { class: 'stats' }, [thead, tbody]));
  }

  render();

  page.append(el('p', { class: 'muted', style: 'font-size:.8rem;margin-top:.8rem',
    text: `* marks players who don't qualify for rate stats (min. ${minAB} AB). Click a row to view player details.` }));
});
