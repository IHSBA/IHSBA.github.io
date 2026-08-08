import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getGame } from '../lib/api';
import Badge from '../components/Badge';
import Empty from '../components/Empty';
import Reveal from '../components/Reveal';

// Note: the games table (see supabase/migrations/0001_init.sql) stores
// one row per game with a final score/result -- there's no per-player
// box-score table in this schema, so this page shows game metadata only.
export default function GameDetail() {
  const { id } = useParams();
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let cancelled = false;
    getGame(id)
      .then((game) => !cancelled && setState({ loading: false, game }))
      .catch((err) => !cancelled && setState({ loading: false, error: err.message }));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.loading) return <div className="container section">Loading…</div>;
  if (state.error || !state.game) {
    return (
      <div className="container section">
        <Empty message="Game not found." cta={{ to: '/games', label: 'Back to Games' }} />
      </div>
    );
  }

  const { game } = state;
  return (
    <div className="container section">
      <Link className="backlink" to="/games">← Games</Link>
      <Reveal className="pd-hero">
        <div className="pd-info">
          <div className="pd-name-en">{game.event_name || 'Game'}</div>
          <h1>vs {game.opponent}</h1>
          <div className="pd-meta">
            <span className="chip">{game.date}</span>
            {game.location && <span className="chip">{game.location}</span>}
            <Badge result={game.result} />
          </div>
        </div>
      </Reveal>
      <div className="grid cols-2" style={{ marginTop: '1.1rem' }}>
        <div className="kpi">
          <div className="kpi-label">Runs</div>
          <div className="kpi-value num">{game.runs != null ? game.runs : '-'}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Allowed</div>
          <div className="kpi-value num">{game.allowed != null ? game.allowed : '-'}</div>
        </div>
      </div>
    </div>
  );
}
