import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTeam, getPlayers, getAllSeasonStats } from '../lib/api';
import { derive, fmtRate } from '../stats/stats';
import { initials } from '../lib/format';
import Reveal from '../components/Reveal';
import Empty from '../components/Empty';

export default function Players() {
  const [state, setState] = useState({ loading: true });
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState('AVG');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const team = await getTeam();
      if (!team) {
        if (!cancelled) setState({ loading: false, list: [] });
        return;
      }
      const [players, allStats] = await Promise.all([getPlayers(team.id), getAllSeasonStats(team.id)]);
      const currentSeasonStats = allStats.filter((s) => s.season === team.season);
      const list = players.map((p) => ({
        player: p,
        totals: derive(currentSeasonStats.find((s) => s.player_id === p.id) || {}),
      }));
      if (!cancelled) setState({ loading: false, list });
    }
    load().catch((err) => {
      console.error(err);
      if (!cancelled) setState({ loading: false, error: err.message, list: [] });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.loading) return <div className="container section">Loading…</div>;

  let list = state.list.slice();
  if (query) {
    const q = query.toLowerCase();
    list = list.filter((s) => s.player.name.includes(query) || (s.player.name_en || '').toLowerCase().includes(q));
  }
  list.sort((a, b) => {
    if (sortKey === 'name') return (a.player.name_en || a.player.name).localeCompare(b.player.name_en || b.player.name);
    return (b.totals[sortKey] || 0) - (a.totals[sortKey] || 0);
  });

  return (
    <div className="container section">
      <div className="section-head">
        <div>
          <p className="eyebrow">Roster</p>
          <h1>Players</h1>
        </div>
        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
          <input
            type="search"
            className="control"
            placeholder="Search players..."
            aria-label="Search players"
            value={query}
            onChange={(e) => setQuery(e.target.value.trim())}
          />
          <select className="control" aria-label="Sort by" value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
            <option value="AVG">AVG</option>
            <option value="OPS">OPS</option>
            <option value="H">Hits</option>
            <option value="HR">HR</option>
            <option value="RBI">RBI</option>
            <option value="R">Runs</option>
            <option value="SB">SB</option>
            <option value="name">Name</option>
          </select>
        </div>
      </div>

      {list.length ? (
        <div className="player-grid">
          {list.map((s, i) => (
            <PlayerCard key={s.player.id} s={s} delay={(i % 8) * 45} />
          ))}
        </div>
      ) : (
        <Empty message="No players found." cta={{ to: '/login', label: 'Add Player' }} />
      )}
    </div>
  );
}

function PlayerCard({ s, delay }) {
  const { player: p, totals: t } = s;
  return (
    <Reveal as={Link} to={`/players/${p.id}`} className="player-card" delay={delay} data-tilt="">
      <div className="pc-media">
        {p.number != null && <span className="pc-num">{p.number}</span>}
        {p.profile_photo_url ? (
          <img className="pc-img" src={p.profile_photo_url} alt={p.name} loading="lazy" />
        ) : (
          <span className="pc-initials">{initials(p.name_en || p.name)}</span>
        )}
        <div className="pc-scrim" />
        <div className="pc-id">
          <div className="pc-name">{p.name_en || p.name}</div>
          <div className="pc-name-en">{p.name}</div>
          <span className="pc-pos">{p.position || (t.G ? `${t.G} GP` : 'ROSTER')}</span>
        </div>
      </div>
      <div className="pc-stats">
        <MiniStat label="AVG" val={fmtRate(t.AVG)} />
        <MiniStat label="HR" val={String(t.HR || 0)} />
        <MiniStat label="OPS" val={fmtRate(t.OPS)} />
      </div>
    </Reveal>
  );
}

function MiniStat({ label, val }) {
  return (
    <div className="pc-stat">
      <span className="v">{val}</span>
      <span className="l">{label}</span>
    </div>
  );
}
