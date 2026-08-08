import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getPlayer, getPlayerSeasonStats, getTeam } from '../lib/api';
import { derive, aggregate, majorRecordRows } from '../stats/stats';
import { computeAdvanced } from '../stats/advancedStats';
import Avatar from '../components/Avatar';
import StatsTable from '../components/StatsTable';
import Reveal from '../components/Reveal';
import CountUp from '../components/CountUp';
import Empty from '../components/Empty';

export default function PlayerDetail() {
  const { id } = useParams();
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [player, team] = await Promise.all([getPlayer(id), getTeam()]);
      const seasons = await getPlayerSeasonStats(id);
      if (!cancelled) setState({ loading: false, player, team, seasons });
    }
    load().catch((err) => {
      console.error(err);
      if (!cancelled) setState({ loading: false, error: err.message });
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.loading) return <div className="container section">Loading…</div>;
  if (state.error || !state.player) {
    return (
      <div className="container section">
        <Empty message="Player not found." cta={{ to: '/players', label: 'Back to Players' }} />
      </div>
    );
  }

  const { player, team, seasons } = state;
  const season = seasons.length ? derive(aggregate([seasons[seasons.length - 1]])) : derive(aggregate([]));
  const rows = majorRecordRows(seasons, team?.name || '-', player.position).map((row) =>
    computeAdvanced(row, player.position)
  );

  const kpis = [
    ['AVG', season.AVG, true, 3],
    ['OBP', season.OBP, true, 3],
    ['SLG', season.SLG, true, 3],
    ['OPS', season.OPS, true, 3],
  ];
  const counts = [
    ['G', season.G], ['AB', season.AB], ['H', season.H], ['HR', season.HR],
    ['RBI', season.RBI], ['R', season.R], ['BB', season.BB], ['SB', season.SB],
  ];

  return (
    <div className="container section">
      <Link className="backlink" to="/players">← Players</Link>

      <Reveal className="pd-hero">
        {player.number != null && <span className="pd-num">{player.number}</span>}
        <Avatar player={player} size="lg" />
        <div className="pd-info">
          <div className="pd-name-en">{player.name}</div>
          <h1>{player.number != null ? `#${player.number} ` : ''}{player.name_en || player.name}</h1>
          <div className="pd-meta">
            {player.position && <span className="chip">{player.position}</span>}
            <span className="chip">{season.G} GAMES</span>
          </div>
        </div>
      </Reveal>

      <div className="grid cols-4" style={{ marginTop: '1.1rem' }}>
        {kpis.map(([label, val, rate, dec], i) => (
          <Reveal key={label} className="kpi" delay={i * 50}>
            <div className="kpi-label">{label}</div>
            <CountUp value={val} decimals={dec} rate={rate} className="kpi-value num" />
          </Reveal>
        ))}
      </div>

      <Reveal className="card card-pad" style={{ marginTop: '1.1rem' }}>
        <h3>Season Totals</h3>
        <div className="counts-grid">
          {counts.map(([l, v]) => (
            <div key={l} className="count-cell">
              <div className="count-l">{l}</div>
              <div className="count-v">{v || 0}</div>
            </div>
          ))}
        </div>
      </Reveal>

      <div style={{ marginTop: '1.5rem' }}>
        <div className="section-head">
          <h2>Major Records</h2>
        </div>
        {rows.length ? (
          <Reveal className="table-wrap">
            <StatsTable rows={rows} />
          </Reveal>
        ) : (
          <p className="muted">No records yet.</p>
        )}
      </div>
    </div>
  );
}
