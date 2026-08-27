import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTeams } from '../lib/api';
import { initials } from '../lib/format';
import Reveal from '../components/Reveal';
import Empty from '../components/Empty';

export default function LeagueHome() {
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let cancelled = false;
    getTeams()
      .then((teams) => !cancelled && setState({ loading: false, teams }))
      .catch((err) => !cancelled && setState({ loading: false, error: err.message }));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <section className="hero">
        <div className="container">
          <p className="eyebrow">The League</p>
          <h1>
            International High School
            <br />
            Baseball <span className="acc">Analytics</span>
          </h1>
          <p className="lede">
            Pick a school to see its roster, schedule, and season stats.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="eyebrow">Schools</p>
              <h2>Teams in the League</h2>
            </div>
          </div>

          {state.loading ? (
            <p className="muted">Loading…</p>
          ) : state.error ? (
            <p className="muted">Failed to load: {state.error}</p>
          ) : state.teams.length ? (
            <div className="grid cols-3">
              {state.teams.map((t, i) => (
                <Reveal
                  key={t.id}
                  as={Link}
                  to={`/schools/${t.slug}`}
                  className="card card-pad school-card"
                  delay={i * 60}
                >
                  <div className="avatar avatar-sm school-card-avatar">
                    {t.logo_url ? (
                      <img src={t.logo_url} alt={t.name} />
                    ) : (
                      <span>{initials(t.name)}</span>
                    )}
                  </div>
                  <div className="school-card-name">{t.name}</div>
                  <div className="school-card-season muted">{t.season} Season</div>
                </Reveal>
              ))}
            </div>
          ) : (
            <Empty message="No schools set up yet." cta={{ to: '/login', label: 'Admin Login' }} />
          )}
        </div>
      </section>
    </>
  );
}
