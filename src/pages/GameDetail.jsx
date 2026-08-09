import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getGame, getGameStats } from '../lib/api';
import { RAW_KEYS } from '../stats/stats';
import Badge from '../components/Badge';
import Empty from '../components/Empty';
import Reveal from '../components/Reveal';
import Avatar from '../components/Avatar';

export default function GameDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let cancelled = false;
    // Fetch independently: a box-score failure (e.g. game_stats table
    // missing a migration) shouldn't make the whole page say "not found"
    // when the game itself loaded fine.
    getGame(id)
      .then(async (game) => {
        if (cancelled) return;
        try {
          const boxScore = await getGameStats(id);
          if (!cancelled) setState({ loading: false, game, boxScore });
        } catch (err) {
          if (!cancelled) setState({ loading: false, game, boxScore: [], boxScoreError: err.message });
        }
      })
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

  const { game, boxScore, boxScoreError } = state;
  return (
    <div className="container section">
      <Link className="backlink" to="/games">← Games</Link>
      <Reveal className="pd-hero">
        <div className="pd-info">
          <div className="pd-name-en">{game.event_name || 'Game'}</div>
          <h1>vs {game.opponent}</h1>
          <div className="pd-meta">
            <span className="chip">{game.date}</span>
            <span className="chip">{game.season}</span>
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

      <div style={{ marginTop: '1.5rem' }}>
        <div className="section-head">
          <h2>Box Score</h2>
        </div>
        {boxScoreError ? (
          <p className="muted">Couldn't load the box score ({boxScoreError}).</p>
        ) : boxScore.length ? (
          <Reveal className="table-wrap">
            <table className="stats">
              <thead>
                <tr>
                  <th className="left">Player</th>
                  {RAW_KEYS.map((k) => <th key={k} className="num">{k}</th>)}
                </tr>
              </thead>
              <tbody>
                {boxScore.map((row) => (
                  <tr key={row.id} className="row-link" onClick={() => navigate(`/players/${row.players.id}`)}>
                    <td className="left name-cell">
                      <Avatar player={row.players} size="xs" />
                      <span>{row.players.name_en || row.players.name}</span>
                    </td>
                    {RAW_KEYS.map((k) => <td key={k} className="num">{row[k] || 0}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        ) : (
          <p className="muted">No player stats entered for this game yet.</p>
        )}
      </div>
    </div>
  );
}
