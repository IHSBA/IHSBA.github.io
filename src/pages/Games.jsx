import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { getGames } from '../lib/api';
import { teamRecord } from '../stats/stats';
import { useSeason } from '../hooks/useSeason';
import SeasonPicker from '../components/SeasonPicker';
import Badge from '../components/Badge';
import Empty from '../components/Empty';
import Reveal from '../components/Reveal';

// [label, key, isNum (default sort direction), align]
const COLS = [
  ['Date', 'date', false, 'left'],
  ['Opponent', 'opponent', false, 'left'],
  ['Event', 'event_name', false, 'left'],
  ['Runs', 'runs', true, 'right'],
  ['Allowed', 'allowed', true, 'right'],
  ['Result', 'result', false, 'center'],
];

export default function Games() {
  const { team } = useOutletContext();
  const { season, seasons, setSeason } = useSeason(team);
  const [games, setGames] = useState(null);
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState(-1);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    getGames(team.id, season)
      .then((g) => !cancelled && setGames(g))
      .catch((err) => console.error(err));
    return () => {
      cancelled = true;
    };
  }, [team, season]);

  if (games === null) return <div className="container section">Loading…</div>;

  const record = teamRecord(games);
  const sorted = games.slice().sort((a, b) => {
    let av = a[sortKey];
    let bv = b[sortKey];
    if (av == null) av = sortDir === 1 ? Infinity : -Infinity;
    if (bv == null) bv = sortDir === 1 ? Infinity : -Infinity;
    if (av < bv) return -1 * sortDir;
    if (av > bv) return 1 * sortDir;
    return 0;
  });

  function onSort(key, isNum) {
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
          <p className="eyebrow">Schedule & Results</p>
          <h1>Games</h1>
        </div>
        <div style={{ display: 'flex', gap: '.6rem', alignItems: 'center' }}>
          <SeasonPicker season={season} seasons={seasons} onChange={setSeason} />
          <div className="segmented">
            <span className="badge badge-w" style={{ margin: '.3rem' }}>{record.W}W</span>
            <span className="badge badge-l" style={{ margin: '.3rem' }}>{record.L}L</span>
            <span className="badge badge-t" style={{ margin: '.3rem' }}>{record.T}T</span>
          </div>
        </div>
      </div>

      {!games.length ? (
        <Empty message="No game records yet." cta={{ to: '/login', label: 'Add Game' }} />
      ) : (
        <Reveal className="table-wrap">
          <table className="stats">
            <thead>
              <tr>
                {COLS.map(([label, key, isNum, align]) => {
                  const active = key === sortKey;
                  return (
                    <th
                      key={key}
                      className={[align, 'sortable', active ? 'sort-active' : ''].join(' ').trim()}
                      onClick={() => onSort(key, isNum)}
                    >
                      {label}{' '}
                      {active && <span className="arrow">{sortDir === 1 ? '▲' : '▼'}</span>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.map((g) => (
                <tr key={g.id} className="row-link" onClick={() => navigate(`/schools/${team.slug}/games/${g.id}`)}>
                  <td className="left num">{g.date}</td>
                  <td className="left">vs {g.opponent}</td>
                  <td className="left muted">{g.event_name || '-'}</td>
                  <td className="right num">{g.runs != null ? g.runs : '-'}</td>
                  <td className="right num">{g.allowed != null ? g.allowed : '-'}</td>
                  <td className="center"><Badge result={g.result} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
      )}
    </div>
  );
}
