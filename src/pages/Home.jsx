import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTeam, getPlayers, getGames, getAllSeasonStats } from '../lib/api';
import { derive, aggregate, teamRecord, fmtRate, majorRecordRows } from '../stats/stats';
import { computeAdvanced } from '../stats/advancedStats';
import Reveal from '../components/Reveal';
import CountUp from '../components/CountUp';
import LeaderCard from '../components/LeaderCard';
import StatsTable from '../components/StatsTable';
import Badge from '../components/Badge';
import Empty from '../components/Empty';

export default function Home() {
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const team = await getTeam();
      if (!team) {
        if (!cancelled) setState({ loading: false, team: null });
        return;
      }
      const [players, games, allStats] = await Promise.all([
        getPlayers(team.id),
        getGames(team.id),
        getAllSeasonStats(team.id),
      ]);
      if (!cancelled) setState({ loading: false, team, players, games, allStats });
    }
    load().catch((err) => {
      console.error(err);
      if (!cancelled) setState({ loading: false, error: err.message });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.loading) return <div className="container section">Loading…</div>;
  if (state.error) return <div className="container section">Failed to load: {state.error}</div>;
  if (!state.team) {
    return (
      <div className="container section">
        <Empty message="No team set up yet. Sign in to add one." cta={{ to: '/login', label: 'Admin Login' }} />
      </div>
    );
  }

  const { team, players, games, allStats } = state;
  const record = teamRecord(games);
  const currentSeasonStats = allStats.filter((s) => s.season === team.season);

  const season = players.map((p) => ({
    player: p,
    totals: derive(currentSeasonStats.find((s) => s.player_id === p.id) || emptyForPlayer()),
  }));
  const qualified = season.filter((s) => s.totals.AB >= 2);

  const teamTotals = aggregate(currentSeasonStats);

  // Team-wide Major Records: sum all players' stats per season into one
  // synthetic team-season row, then run the same Div. logic per player.
  const bySeason = new Map();
  allStats.forEach((s) => {
    if (!bySeason.has(s.season)) bySeason.set(s.season, []);
    bySeason.get(s.season).push(s);
  });
  const teamSeasons = Array.from(bySeason.entries()).map(([seasonLabel, rows]) => ({
    ...aggregate(rows),
    season: seasonLabel,
  }));
  const teamMajorRows = majorRecordRows(teamSeasons, team.name, 'TEAM').map((row) => computeAdvanced(row, null));

  const recent = games.slice(0, 5);
  const boards = [
    { title: 'AVG Leaders', key: 'AVG', rate: true, list: qualified },
    { title: 'OPS Leaders', key: 'OPS', rate: true, list: qualified },
    { title: 'Hits Leaders', key: 'H', rate: false, list: season },
    { title: 'RBI Leaders', key: 'RBI', rate: false, list: season },
  ];

  return (
    <>
      <section className="hero">
        <div className="container">
          <p className="eyebrow">{team.name} · {team.season} SEASON</p>
          <h1>
            International High School
            <br />
            Baseball <span className="acc">Analytics</span>
          </h1>
          <p className="lede">
            A comprehensive sabermetrics platform that helps high school baseball players track
            performance, discover strengths, and reach their full potential.
          </p>
          <div className="record-strip">
            <RecStat label="Record" value={`${record.W}-${record.L}-${record.T}`} />
            <RecStat label="Win %" value={record.played ? fmtRate(record.winPct) : '-'} />
            <RecStat label="Games" value={String(games.length)} />
            <RecStat label="Roster" value={String(players.length)} />
          </div>
          <div className="hero-actions">
            <Link className="btn btn-accent" to="/players">View Players</Link>
            <Link className="btn btn-ghost" to="/games">Schedule &amp; Results</Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="eyebrow">Team</p>
              <h2>Team Season Totals</h2>
            </div>
          </div>
          <div className="grid cols-4">
            <Kpi label="Team AVG" value={teamTotals.AVG} rate decimals={3} sub="AVG" />
            <Kpi label="Team OPS" value={teamTotals.OPS} rate decimals={3} sub="OBP+SLG" />
            <Kpi label="Total Hits" value={teamTotals.H} sub={`incl. ${teamTotals.HR} HR`} />
            <Kpi label="Total RBI" value={teamTotals.RBI} sub={`${teamTotals.R} runs scored`} />
          </div>
        </div>
      </section>

      <section className="section major-records-section">
        <div className="container">
          <div className="section-head major-records-head">
            <div>
              <p className="eyebrow">Team</p>
              <h2 className="major-records-title">Major Records</h2>
            </div>
          </div>
          {teamMajorRows.length ? (
            <Reveal className="table-wrap">
              <StatsTable rows={teamMajorRows} />
            </Reveal>
          ) : (
            <Empty message="No game records yet." cta={{ to: '/login', label: 'Enter Data' }} />
          )}
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="eyebrow">Schedule</p>
              <h2>Recent Games</h2>
            </div>
            <Link className="btn btn-ghost btn-sm" to="/games">View All</Link>
          </div>
          {recent.length ? (
            <Reveal className="card">
              {recent.map((g) => (
                <Link key={g.id} to={`/games/${g.id}`} className="game-row row-link">
                  <span className="g-date num">{g.date}</span>
                  <div>
                    <div className="g-opp">vs {g.opponent}</div>
                    <div className="g-event">{g.event_name || ''}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.7rem', justifyContent: 'flex-end' }}>
                    <span className="g-score num">
                      {g.runs != null ? `${g.runs} : ${g.allowed}` : 'No score'}
                    </span>
                    <Badge result={g.result} />
                  </div>
                </Link>
              ))}
            </Reveal>
          ) : (
            <Empty message="No game records yet." cta={{ to: '/login', label: 'Enter Data' }} />
          )}
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="eyebrow">Leaders</p>
              <h2>Season Top Performers</h2>
            </div>
            <Link className="btn btn-ghost btn-sm" to="/leaderboards">Full Leaderboard</Link>
          </div>
          <div className="grid cols-2">
            {boards.map((b, i) => (
              <LeaderCard key={b.title} title={b.title} list={b.list} statKey={b.key} rate={b.rate} delay={i * 60} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function emptyForPlayer() {
  return { G: 0, AB: 0, R: 0, H: 0, '2B': 0, '3B': 0, HR: 0, RBI: 0, BB: 0, HBP: 0, IB: 0, SB: 0, CS: 0, SO: 0, GDP: 0, SH: 0, SF: 0, TB: 0, PA: 0, ePA: 0 };
}

function RecStat({ label, value }) {
  return (
    <div className="rec">
      <div className="l">{label}</div>
      <div className="v num">{value}</div>
    </div>
  );
}

function Kpi({ label, value, rate = false, decimals = 0, sub }) {
  return (
    <Reveal className="kpi">
      <div className="kpi-label">{label}</div>
      <CountUp value={value} decimals={decimals} rate={rate} className="kpi-value num" />
      <div className="kpi-sub">{sub}</div>
    </Reveal>
  );
}
