import { Link } from 'react-router-dom';
import Avatar from './Avatar';
import Reveal from './Reveal';
import { fmtRate } from '../stats/stats';

const RATE_KEYS = new Set(['AVG', 'OBP', 'SLG', 'OPS']);

// Top-3 showcase block: player photos, larger/centered for 1st place.
export default function Podium({ items, statKey }) {
  const top3 = items.slice(0, 3);
  if (!top3.length) return null;
  const rate = RATE_KEYS.has(statKey);
  return (
    <Reveal className="podium">
      {top3.map((s, idx) => {
        const place = idx + 1;
        const val = rate ? fmtRate(s.totals[statKey]) : String(s.totals[statKey] || 0);
        return (
          <Link key={s.player.id} to={`/players/${s.player.id}`} className={`podium-card rank-${place}`}>
            <div className="podium-rank num">{place}</div>
            <Avatar player={s.player} className="podium-avatar" />
            <div className="podium-name">{s.player.name_en || s.player.name}</div>
            <div className="podium-en">{s.player.name}</div>
            <div className="podium-val num">{val}</div>
            <div className="podium-stat">{statKey}</div>
          </Link>
        );
      })}
    </Reveal>
  );
}
