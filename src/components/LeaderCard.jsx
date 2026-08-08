import { Link } from 'react-router-dom';
import Avatar from './Avatar';
import Reveal from './Reveal';
import { fmtRate } from '../stats/stats';

// Home page leaderboard card: rank number (scaled/colored for 1-2-3),
// small photo, name, value.
export default function LeaderCard({ title, list, statKey, rate, delay = 0 }) {
  const rows = list
    .filter((s) => (s.totals[statKey] || 0) > 0)
    .sort((a, b) => (b.totals[statKey] || 0) - (a.totals[statKey] || 0))
    .slice(0, 5);

  return (
    <Reveal className="card card-pad" delay={delay}>
      <h3>{title}</h3>
      {rows.length ? (
        <div className="leader-list">
          {rows.map((r, idx) => {
            const place = idx + 1;
            const val = rate ? fmtRate(r.totals[statKey]) : String(r.totals[statKey] || 0);
            return (
              <Link key={r.player.id} to={`/players/${r.player.id}`} className="leader-item row-link">
                <span className={`rank num rank-${place <= 3 ? place : 'rest'}`}>{place}</span>
                <Avatar player={r.player} size="sm" />
                <span>
                  <div className="li-name">{r.player.name_en || r.player.name}</div>
                  <div className="li-en">{r.player.name}</div>
                </span>
                <span className="li-val num">{val}</span>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="muted">Not enough data yet.</p>
      )}
    </Reveal>
  );
}
