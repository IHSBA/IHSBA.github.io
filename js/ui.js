/*
 * ui.js  --  SHARED UI HELPERS
 * ------------------------------------------------------------------
 * Navigation injection, scroll-reveal, count-up number animation,
 * 3D card tilt, and small DOM utilities used across all pages.
 *
 * No storage access here. Pure presentation + DOM.
 */
const UI = (function () {
  const prefersReducedMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- tiny DOM helpers ---------------------------------------------
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.entries(attrs).forEach(([k, v]) => {
        if (k === 'class') node.className = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (v !== null && v !== undefined) node.setAttribute(k, v);
      });
    }
    (children || []).forEach((c) => {
      if (c == null) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }
  const qs = (sel, root) => (root || document).querySelector(sel);
  const qsa = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const param = (name) => new URLSearchParams(location.search).get(name);

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  // Initials for a photo-less avatar (handles Korean + latin names).
  function initials(name) {
    if (!name) return '?';
    const n = name.trim();
    // For Korean names use the last 2 characters (given name).
    if (/[가-힣]/.test(n)) return n.slice(-2);
    const parts = n.split(/\s+/);
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }

  // ---- top navigation ------------------------------------------------
  // Injected into every page so the markup stays DRY.
  function renderNav(active) {
    const links = [
      { href: 'index.html', label: 'Home', key: 'home' },
      { href: 'players.html', label: 'Players', key: 'players' },
      { href: 'games.html', label: 'Games', key: 'games' },
      { href: 'leaderboards.html', label: 'Leaderboards', key: 'leaders' },
      { href: 'admin.html', label: 'Data Entry', key: 'admin' },
    ];

    const schools = DB.getSchools();
    const activeSchool = DB.getActiveSchoolId();
    const select = el('select', {
      class: 'school-select',
      'aria-label': 'Select school',
      onchange: (e) => {
        DB.setActiveSchoolId(e.target.value);
        location.reload();
      },
    });
    schools.forEach((s) => {
      const opt = el('option', { value: s.id }, [s.name]);
      if (s.id === activeSchool) opt.selected = true;
      select.appendChild(opt);
    });

    const toggle = el('button', {
      class: 'nav-toggle',
      'aria-label': 'Open menu',
      'aria-expanded': 'false',
      html: '<span></span><span></span><span></span>',
    });

    const navLinks = el(
      'nav',
      { class: 'nav-links', id: 'navLinks' },
      links.map((l) =>
        el('a', { href: l.href, class: l.key === active ? 'active' : '' }, [l.label])
      )
    );

    const header = el('header', { class: 'site-header' }, [
      el('div', { class: 'nav-inner container' }, [
        el('a', { href: 'index.html', class: 'brand' }, [
          el('span', { class: 'brand-mark', text: '⚾' }),
          el('span', { class: 'brand-text' }, [
            el('strong', { text: 'IHBA' }),
            el('small', { text: 'International High School Baseball Analytics' }),
          ]),
        ]),
        navLinks,
        el('div', { class: 'nav-right' }, [select, toggle]),
      ]),
    ]);

    toggle.addEventListener('click', () => {
      const open = header.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', String(open));
    });

    const mount = qs('#nav') || document.body;
    if (qs('#nav')) mount.replaceWith(header);
    else document.body.insertBefore(header, document.body.firstChild);
  }

  function renderFooter() {
    const f = el('footer', { class: 'site-footer' }, [
      el('div', { class: 'container' }, [
        el('p', {
          html:
            'International High School Baseball Analytics (IHBA) &middot; Static site (GitHub Pages) &middot; Data is stored in your browser.',
        }),
      ]),
    ]);
    document.body.appendChild(f);
  }

  // ---- scroll reveal (IntersectionObserver) -------------------------
  function initReveal() {
    const items = qsa('[data-reveal]');
    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      items.forEach((i) => i.classList.add('revealed'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const delay = entry.target.getAttribute('data-reveal-delay') || 0;
            entry.target.style.transitionDelay = delay + 'ms';
            entry.target.classList.add('revealed');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    items.forEach((i) => io.observe(i));
  }

  // ---- count-up numbers ---------------------------------------------
  // Animates [data-countup] elements when they enter the viewport.
  // Respects an optional data-decimals attribute and a leading-dot
  // baseball format via data-rate="true".
  function initCountUp() {
    const nodes = qsa('[data-countup]');
    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      nodes.forEach((n) => (n.textContent = formatCount(n)));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          animateCount(entry.target);
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.5 }
    );
    nodes.forEach((n) => io.observe(n));
  }

  function formatCount(node) {
    const target = parseFloat(node.getAttribute('data-countup')) || 0;
    const decimals = parseInt(node.getAttribute('data-decimals') || '0', 10);
    const rate = node.getAttribute('data-rate') === 'true';
    let s = target.toFixed(decimals);
    if (rate && target < 1) s = s.replace(/^0/, '');
    return s;
  }

  function animateCount(node) {
    const target = parseFloat(node.getAttribute('data-countup')) || 0;
    const decimals = parseInt(node.getAttribute('data-decimals') || '0', 10);
    const rate = node.getAttribute('data-rate') === 'true';
    const duration = 900;
    const start = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const val = target * eased;
      let s = val.toFixed(decimals);
      if (rate && target < 1) s = s.replace(/^0/, '');
      node.textContent = s;
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // ---- 3D tilt on cards ---------------------------------------------
  // Lightweight pointermove tilt using CSS custom properties.
  // Disabled for reduced-motion and touch (no hover) users.
  function initTilt() {
    if (prefersReducedMotion) return;
    const canHover = window.matchMedia('(hover: hover)').matches;
    if (!canHover) return;

    qsa('[data-tilt]').forEach((card) => {
      const max = 8; // degrees
      function move(e) {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        card.style.setProperty('--ry', (px - 0.5) * 2 * max + 'deg');
        card.style.setProperty('--rx', -(py - 0.5) * 2 * max + 'deg');
        card.style.setProperty('--mx', px * 100 + '%');
        card.style.setProperty('--my', py * 100 + '%');
      }
      function reset() {
        card.style.setProperty('--ry', '0deg');
        card.style.setProperty('--rx', '0deg');
      }
      card.addEventListener('pointermove', move);
      card.addEventListener('pointerleave', reset);
    });
  }

  // ---- "주요기록" (major record) stat table --------------------------
  // Same column set/order for the player-detail page and the homepage
  // summary. `rows` are Stats.majorRecordRows() entries already merged
  // with AdvancedStats.compute() output.
  const MAJOR_RECORD_COLUMNS = [
    { key: 'Div', label: 'Div.', group: null, type: 'text' },
    { key: 'Year', label: 'Year', group: null, type: 'text' },
    { key: 'Team', label: 'Team', group: null, type: 'text' },
    { key: 'Age', label: 'Age', group: null, type: 'text' },
    { key: 'Pos', label: 'Pos.', group: null, type: 'text' },
    { key: 'G', label: 'G', group: null, type: 'int' },
    { key: 'oWAR', label: 'oWAR', group: null, type: 'war' },
    { key: 'dWAR', label: 'dWAR', group: null, type: 'war' },
    { key: 'PA', label: 'PA', group: null, type: 'int' },
    { key: 'ePA', label: 'ePA', group: null, type: 'int' },
    { key: 'AB', label: 'AB', group: null, type: 'int' },
    { key: 'R', label: 'R', group: null, type: 'int' },
    { key: 'H', label: 'H', group: null, type: 'int' },
    { key: '2B', label: '2B', group: null, type: 'int' },
    { key: '3B', label: '3B', group: null, type: 'int' },
    { key: 'HR', label: 'HR', group: null, type: 'int' },
    { key: 'TB', label: 'TB', group: null, type: 'int' },
    { key: 'RBI', label: 'RBI', group: null, type: 'int' },
    { key: 'SB', label: 'SB', group: null, type: 'int' },
    { key: 'CS', label: 'CS', group: null, type: 'int' },
    { key: 'BB', label: 'BB', group: null, type: 'int' },
    { key: 'HBP', label: 'HP', group: null, type: 'int' },
    { key: 'IBB', label: 'IB', group: null, type: 'int' },
    { key: 'SO', label: 'SO', group: null, type: 'int' },
    { key: 'GIDP', label: 'GDP', group: null, type: 'int' },
    { key: 'SAC', label: 'SH', group: null, type: 'int' },
    { key: 'SF', label: 'SF', group: null, type: 'int' },
    { key: 'AVG', label: 'AVG', group: 'ratio', type: 'rate' },
    { key: 'OBP', label: 'OBP', group: 'ratio', type: 'rate' },
    { key: 'SLG', label: 'SLG', group: 'ratio', type: 'rate' },
    { key: 'OPS', label: 'OPS', group: 'ratio', type: 'rate' },
    { key: 'RePA', label: 'R/ePA', group: null, type: 'repa' },
    { key: 'wRCPlus', label: 'wRC+', group: null, type: 'wrc' },
    { key: 'WAR', label: 'WAR', group: null, type: 'war' },
  ];
  const GROUP_LABELS = { ratio: 'Rate' };

  function fmtMajorCell(type, val) {
    switch (type) {
      case 'text': return val == null || val === '' ? '-' : String(val);
      case 'int': return String(val != null ? val : 0);
      case 'rate': return Stats.fmtRate(val);
      case 'war': return AdvancedStats.fmtWar(val);
      case 'repa': return AdvancedStats.fmtRePA(val);
      case 'wrc': return AdvancedStats.fmtWRC(val);
      default: return val != null ? String(val) : '-';
    }
  }

  function majorRecordTable(rows) {
    // Two-row header: a spanning group label (currently just "비율"
    // over AVG/OBP/SLG/OPS) plus the individual column labels.
    const row1 = [];
    const row2 = [];
    let i = 0;
    while (i < MAJOR_RECORD_COLUMNS.length) {
      const col = MAJOR_RECORD_COLUMNS[i];
      if (!col.group) {
        row1.push(el('th', { rowspan: '2', class: col.key === 'Div' ? 'div-cell' : '', text: col.label }));
        i++;
        continue;
      }
      let j = i;
      while (j < MAJOR_RECORD_COLUMNS.length && MAJOR_RECORD_COLUMNS[j].group === col.group) j++;
      row1.push(el('th', { colspan: String(j - i), class: 'group-label', text: GROUP_LABELS[col.group] || '' }));
      for (let k = i; k < j; k++) row2.push(el('th', { text: MAJOR_RECORD_COLUMNS[k].label }));
      i = j;
    }

    const thead = el('thead', {}, [el('tr', { class: 'group-row' }, row1), el('tr', {}, row2)]);
    const tbody = el('tbody', {}, rows.map((row) =>
      el('tr', { class: row.Div === 'Career' ? 'career-row' : '' }, MAJOR_RECORD_COLUMNS.map((col) =>
        el('td', {
          class: (col.type === 'text' ? '' : 'num') + (col.key === 'Div' ? ' div-cell' : ''),
          text: fmtMajorCell(col.type, row[col.key]),
        })
      ))
    ));
    return el('table', { class: 'stats major' }, [thead, tbody]);
  }

  // Run all entrance/interaction effects after a page renders content.
  function activate() {
    initReveal();
    initCountUp();
    initTilt();
  }

  // Standard page boot: wait for data, render chrome, run the page fn.
  function boot(activeKey, pageFn) {
    DB.ready(function () {
      AdvancedStats.ready(function () {
        renderNav(activeKey);
        try {
          pageFn();
        } catch (e) {
          console.error(e);
        }
        renderFooter();
        activate();
      });
    });
  }

  return {
    el,
    qs,
    qsa,
    param,
    escapeHtml,
    initials,
    renderNav,
    renderFooter,
    initReveal,
    initCountUp,
    initTilt,
    activate,
    boot,
    majorRecordTable,
    prefersReducedMotion,
  };
})();
