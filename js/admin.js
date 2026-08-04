/*
 * admin.js  --  Data entry
 * Tabs: 선수 (players), 경기 (games), 데이터 (backup/reset).
 * The user enters RAW numbers only; derived stats are computed elsewhere.
 * All writes go through the DB data layer (never localStorage directly).
 */
UI.boot('admin', function () {
  const { el } = UI;
  const page = UI.qs('#page');

  // ---- toast helper ----
  const toast = UI.qs('#toast');
  function notify(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(notify._t);
    notify._t = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  // ---- tab shell ----
  let tab = UI.param('editPlayer') ? 'players' : 'players';
  const tabs = [['players', 'Players'], ['games', 'Games'], ['data', 'Data']];
  const tabBar = el('div', { class: 'segmented', style: 'margin-bottom:1.5rem' },
    tabs.map(([key, label]) => el('button', {
      class: key === tab ? 'active' : '',
      onclick: () => { tab = key; renderTab(); },
    }, [label]))
  );
  page.append(
    el('div', { class: 'section-head' }, [
      el('div', {}, [el('p', { class: 'eyebrow', text: 'Data Entry' }), el('h1', { text: 'Data Entry' })]),
    ]),
    tabBar
  );
  const body = el('div', {});
  page.append(body);

  function renderTab() {
    UI.qsa('button', tabBar).forEach((b, i) => b.classList.toggle('active', tabs[i][0] === tab));
    body.innerHTML = '';
    if (tab === 'players') renderPlayers();
    else if (tab === 'games') renderGames();
    else renderData();
  }

  // ================= PLAYERS TAB =================
  function renderPlayers() {
    const editId = UI.param('editPlayer');
    const editing = editId ? DB.getPlayer(editId) : null;

    const f = {
      name: input('Name (Korean)', 'text', editing ? editing.name : '', true),
      nameEn: input('Name (English)', 'text', editing ? editing.nameEn : ''),
      number: input('Number', 'number', editing && editing.number != null ? editing.number : ''),
      position: posSelect(editing ? editing.position : ''),
      photo: input('Photo path/URL (optional)', 'text', editing ? editing.photo : ''),
    };

    const form = el('form', { class: 'card card-pad form-grid', style: 'max-width:520px' }, [
      el('h3', { text: editing ? `Edit Player: ${editing.nameEn || editing.name}` : 'Add New Player' }),
      el('div', { class: 'grid cols-2' }, [f.name.field, f.nameEn.field]),
      el('div', { class: 'grid cols-2' }, [f.number.field, f.position.field]),
      f.photo.field,
      el('div', { class: 'form-actions' }, [
        el('button', { type: 'submit', class: 'btn btn-primary' }, [editing ? 'Save' : 'Add']),
        editing ? el('a', { class: 'btn btn-ghost', href: 'admin.html' }, ['Cancel']) : null,
      ]),
    ]);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = f.name.input.value.trim();
      if (!name) { notify('Please enter a name.'); return; }
      const rec = {
        name,
        nameEn: f.nameEn.input.value.trim(),
        number: f.number.input.value === '' ? null : parseInt(f.number.input.value, 10),
        position: f.position.input.value,
        photo: f.photo.input.value.trim(),
      };
      if (editing) rec.id = editing.id;
      DB.savePlayer(rec);
      notify('Saved.');
      if (editing) { location.href = 'admin.html'; return; }
      form.reset();
      listPlayers();
    });

    body.append(form);

    // roster list
    const listWrap = el('div', { style: 'margin-top:1.5rem' });
    body.append(listWrap);
    function listPlayers() {
      const players = DB.getPlayers();
      listWrap.innerHTML = '';
      listWrap.append(el('h3', { text: `Roster (${players.length})` }));
      if (!players.length) { listWrap.append(el('p', { class: 'muted', text: 'No players yet.' })); return; }
      listWrap.append(el('div', { class: 'card' }, players.map((p) =>
        el('div', { class: 'game-row' }, [
          el('div', { class: 'num', style: 'min-width:40px', text: p.number != null ? '#' + p.number : '-' }),
          el('div', {}, [
            el('div', { class: 'g-opp', text: p.nameEn || p.name }),
            el('div', { class: 'g-event', text: p.position || 'No position set' }),
          ]),
          el('div', { style: 'display:flex;gap:.4rem;justify-content:flex-end' }, [
            el('a', { class: 'btn btn-ghost btn-sm', href: `admin.html?editPlayer=${p.id}` }, ['Edit']),
            el('button', { class: 'btn btn-danger btn-sm', onclick: () => {
              if (confirm(`Delete ${p.nameEn || p.name}? Their game records will be deleted too.`)) {
                DB.deletePlayer(p.id); notify('Deleted.'); listPlayers();
              }
            } }, ['Delete']),
          ]),
        ])
      )));
    }
    listPlayers();
  }

  // ================= GAMES TAB =================
  function renderGames() {
    const players = DB.getPlayers();

    if (!players.length) {
      body.append(el('div', { class: 'empty card card-pad' }, [
        el('div', { class: 'big', text: '👤' }),
        el('p', { class: 'muted', text: 'You need to add players before entering game records.' }),
        el('button', { class: 'btn btn-primary btn-sm', onclick: () => { tab = 'players'; renderTab(); } }, ['Go Add Players']),
      ]));
      return;
    }

    // --- game meta fields ---
    const m = {
      date: input('Date', 'date', new Date().toISOString().slice(0, 10), true),
      opponent: input('Opponent', 'text', '', true),
      event: input('Event/Tournament', 'text', ''),
      ourScore: input('Our Score (optional)', 'number', ''),
      theirScore: input('Opponent Score (optional)', 'number', ''),
      location: input('Location (optional)', 'text', ''),
    };

    const metaCard = el('div', { class: 'card card-pad form-grid' }, [
      el('h3', { text: 'Game Info' }),
      el('div', { class: 'grid cols-2' }, [m.date.field, m.opponent.field]),
      m.event.field,
      el('div', { class: 'grid cols-3' }, [m.ourScore.field, m.theirScore.field, m.location.field]),
      el('p', { class: 'muted', style: 'font-size:.82rem;margin:0', text: 'Entering both scores automatically determines W/L/T. Leave blank to show "TBD".' }),
    ]);

    // --- batting line entry table ---
    const rawCols = [
      ['AB', 'AB'], ['R', 'R'], ['H', 'H'], ['2B', '2B'], ['3B', '3B'], ['HR', 'HR'],
      ['RBI', 'RBI'], ['SB', 'SB'], ['CS', 'CS'], ['SAC', 'SAC'], ['SF', 'SF'],
      ['BB', 'BB'], ['IBB', 'IBB'], ['HBP', 'HBP'], ['SO', 'SO'], ['GIDP', 'GIDP'], ['LOB', 'LOB'],
    ];

    const rowState = new Map(); // playerId -> { include: bool, inputs: {key:input} }

    const tbody = el('tbody', {}, players.map((p) => {
      const inputs = {};
      const tds = rawCols.map(([_, key]) =>
        el('td', { class: 'num' }, [
          inputs[key] = el('input', {
            type: 'number', min: '0', value: '0', inputmode: 'numeric',
            style: 'width:54px;padding:.3rem;text-align:right;border:1px solid var(--line-2);border-radius:6px;background:var(--ink-2);color:var(--text)',
          }),
        ])
      );
      const include = el('input', { type: 'checkbox' });
      rowState.set(p.id, { include, inputs });
      return el('tr', {}, [
        el('td', {}, [el('label', { style: 'display:flex;gap:.5rem;align-items:center;white-space:nowrap' }, [include, p.nameEn || p.name])]),
      ].concat(tds));
    }));

    const lineTable = el('table', { class: 'stats', style: 'min-width:960px' }, [
      el('thead', {}, [el('tr', {}, [el('th', { text: 'Player (check = played)' })]
        .concat(rawCols.map(([label]) => el('th', { class: 'num', text: label }))))]),
      tbody,
    ]);

    const saveBtn = el('button', { class: 'btn btn-primary' }, ['Save Game']);
    saveBtn.addEventListener('click', () => {
      const opponent = m.opponent.input.value.trim();
      if (!opponent) { notify('Please enter an opponent.'); return; }

      const us = m.ourScore.input.value;
      const them = m.theirScore.input.value;
      const ourScore = us === '' ? null : parseInt(us, 10);
      const theirScore = them === '' ? null : parseInt(them, 10);
      let result = null;
      if (ourScore != null && theirScore != null) {
        result = ourScore > theirScore ? 'W' : ourScore < theirScore ? 'L' : 'T';
      }

      const lines = [];
      players.forEach((p) => {
        const st = rowState.get(p.id);
        const vals = {};
        let any = false;
        rawCols.forEach(([_, key]) => {
          const v = parseInt(st.inputs[key].value, 10) || 0;
          vals[key] = v;
          if (v !== 0) any = true;
        });
        // include row if checkbox ticked OR any stat entered
        if (st.include.checked || any) lines.push(Object.assign({ playerId: p.id }, vals));
      });

      if (!lines.length) { notify('Enter records for at least 1 player.'); return; }

      DB.saveGame(
        { date: m.date.input.value, opponent, event: m.event.input.value.trim(),
          location: m.location.input.value.trim(), ourScore, theirScore, result, innings: null },
        lines
      );
      notify('Game saved.');
      setTimeout(() => (location.href = 'games.html'), 700);
    });

    body.append(
      metaCard,
      el('div', { style: 'margin-top:1.2rem' }, [
        el('h3', { text: 'Batting Stats (raw entry)' }),
        el('p', { class: 'muted', style: 'font-size:.82rem', text: 'AVG/OBP/SLG/OPS are calculated automatically after saving. Check or enter stats only for players who played.' }),
        el('div', { class: 'table-wrap' }, [lineTable]),
      ]),
      el('div', { class: 'form-actions', style: 'margin-top:1.2rem' }, [saveBtn]),
    );
  }

  // ================= DATA TAB =================
  function renderData() {
    body.append(el('div', { class: 'card card-pad stack', style: 'max-width:620px' }, [
      el('h3', { text: 'Backup / Restore Data' }),
      el('p', { class: 'muted', text: 'All records are stored in this browser (localStorage). You can export a JSON backup below, or reset back to the default seed data.' }),
      el('div', { class: 'form-actions' }, [
        el('button', { class: 'btn btn-primary', onclick: exportData }, ['Export JSON']),
        el('button', { class: 'btn btn-danger', onclick: resetData }, ['Reset to Seed Data']),
      ]),
    ]));

    function exportData() {
      const blob = new Blob([DB.exportJSON()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = el('a', { href: url, download: `hsbb-backup-${new Date().toISOString().slice(0,10)}.json` });
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      notify('Backup file downloaded.');
    }
    function resetData() {
      if (!confirm('This will erase all changes stored in this browser and reset to the default seed data. Continue?')) return;
      DB.resetToSeed();
      DB.ready(() => { notify('Reset complete.'); });
      setTimeout(() => location.reload(), 600);
    }
  }

  // ---- small form helpers ----
  function input(label, type, value, required) {
    const inp = el('input', { type, value: value == null ? '' : value });
    if (required) inp.required = true;
    const field = el('div', { class: 'field' }, [el('label', { text: label }), inp]);
    return { field, input: inp };
  }
  function posSelect(value) {
    const positions = ['', 'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'UT'];
    const labels = { '': 'Select Position', P: 'Pitcher', C: 'Catcher', '1B': 'First Base', '2B': 'Second Base', '3B': 'Third Base', SS: 'Shortstop', LF: 'Left Field', CF: 'Center Field', RF: 'Right Field', DH: 'Designated Hitter', UT: 'Utility' };
    const sel = el('select', {}, positions.map((p) => {
      const o = el('option', { value: p }, [labels[p]]);
      if (p === value) o.selected = true;
      return o;
    }));
    const field = el('div', { class: 'field' }, [el('label', { text: 'Position' }), sel]);
    return { field, input: sel };
  }

  renderTab();
});
