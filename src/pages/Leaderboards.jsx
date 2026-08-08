import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTeam, getPlayers, getAllSeasonStats } from '../lib/api';
import { derive, fmtRate } from '../stats/stats';
import Podium from '../components/Podium';
import Avatar from '../components/Avatar';
import Reveal from '../components/Reveal';

const RATE_KEYS = new Set(['AVG', 'OBP', 'SLG', 'OPS']);
const COLS = [
  ['Player', 'name', false], ['G', 'G', true], ['AB', 'AB', true], ['H', 'H', true],
  ['AVG', 'AVG', true], ['OBP', 'OBP', true], ['SLG', 'SLG', true], ['OPS', 'OPS', true],
  ['HR', 'HR', true], ['RBI', 'RBI', true], ['R', 'R', true], ['SB', 'SB', true],
  ['BB', 'BB', true], ['SO', 'SO', true],
];
const CHIPS = [['AVG', 'AVG'], ['OPS', 'OPS'], ['HR', 'HR'], ['RBI', 'RBI'], ['H', 'H'], ['SB', 'SB']];

export default function Leaderboards() {
  const [season, setSeason] = useState(null);
  const [sortKey, setSortKey] = useState('OPS');
  const [sortDir, setSortDir] = useState(-1);
  const [minAB, setMinAB] = useState(2);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const team = await getTeam();
      if (!team) {
        if (!cancelled) setSeason([]);
        return;
      }
      const [players, allStats] = await Promise.all([getPlayers(team.id), getAllSeasonStats(team.id)]);
      const currentSeasonStats = allStats.filter((s) => s.season === team.season);
      const list = players
        .map((p) => ({ player: p, totals: derive(currentSeasonStats.find((s) => s.player_id === p.id) || {}) }))
        .filter((s) => s.totals.G > 0);
      if (!cancelled) setSeason(list);
    }
    load().catch((err) => console.error(err));
    return () => {
      cancelled = true;
    };
  }, []);

  if (season === null) return <div className="container section">Loading…</div>;

  const qualified = (s) => (s.totals.AB || 0) >= minAB;
  const list = season.slice().sort((a, b) => {
    if (sortKey === 'name') {
      return (a.player.name_en || a.player.name).localeCompare(b.player.name_en || b.player.name) * sortDir;
    }
    if (RATE_KEYS.has(sortKey)) {
      const aq = qualified(a);
      const bq = qualified(b);
      if (aq !== bq) return aq ? -1 : 1;
    }
    return (value(b, sortKey) - value(a, sortKey)) * (sortDir === -1 ? 1 : -1);
  });
  const podiumList = list.filter((s) => (RATE_KEYS.has(sortKey) ? qualified(s) : true));

  function value(s, key) {
    if (key === 'name') return s.player.name_en || s.player.name;
    return s.totals[key] || 0;
  }
  function onHeaderSort(key, isNum) {
    if (sortKey === key) setSortDir((d) => d * -1);
    else {
      setSortKey(key);
      setSortDir(isNum ? -1 : 1);
    }
  }

  return (
    <div className="container section">
      <div className="section-head">
        <div>
          <p className="eyebrow">Leaderboards</p>
          <h1>Leaderboards</h1>
        </div>
      </div>

      <Podium items={podiumList} statKey={sortKey} />

      <div className="segmented" style={{ marginBottom: '1rem' }}>
        {CHIPS.map(([label, key]) => (
          <button
            key={key}
            className={key === sortKey ? 'active' : ''}
            onClick={() => {
              setSortKey(key);
              setSortDir(-1);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="muted" style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.85rem', marginBottom: '1rem' }}>
        Min. AB to qualify for rate stats:
        <input
          type="number"
          min="0"
          value={minAB}
          style={{ width: 70, padding: '.3rem .5rem', border: '1px solid var(--line-2)', borderRadius: 8, background: 'var(--ink-2)', color: 'var(--text)' }}
          onChange={(e) => setMinAB(parseInt(e.target.value, 10) || 0)}
        />
      </label>

      <Reveal className="table-wrap">
        <table className="stats">
          <thead>
            <tr>
              {COLS.map(([label, key, isNum]) => {
                const active = key === sortKey;
                return (
                  <th
                    key={key}
                    className={[isNum ? 'num' : '', 'sortable', active ? 'sort-active' : ''].join(' ').trim()}
                    onClick={() => onHeaderSort(key, isNum)}
                  >
                    {label}{' '}
                    {active && <span className="arrow">{sortDir === 1 ? '▲' : '▼'}</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {list.map((s, idx) => {
              const t = s.totals;
              const unq = RATE_KEYS.has(sortKey) && !qualified(s);
              return (
                <tr key={s.player.id} className="row-link" onClick={() => navigate(`/players/${s.player.id}`)}>
                  {COLS.map(([, key]) => {
                    if (key === 'name') {
                      return (
                        <td key={key} className="name-cell">
                          <span className="num" style={{ color: 'var(--faint)', marginRight: '.5rem' }}>{idx + 1}</span>
                          <Avatar player={s.player} size="xs" />
                          <span>{(s.player.name_en || s.player.name) + (unq ? ' *' : '')}</span>
                        </td>
                      );
                    }
                    if (RATE_KEYS.has(key)) {
                      return <td key={key} className={key === sortKey ? 'num hl' : 'num'}>{fmtRate(t[key])}</td>;
                    }
                    return <td key={key} className={key === sortKey ? 'num hl' : 'num'}>{t[key] || 0}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Reveal>
      <p className="muted" style={{ fontSize: '.8rem', marginTop: '.8rem' }}>
        * marks players who don&apos;t qualify for rate stats (min. {minAB} AB). Click a row to view player details.
      </p>
    </div>
  );
}
