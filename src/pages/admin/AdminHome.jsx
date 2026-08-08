import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTeam, getPlayers, getGames } from '../../lib/api';
import AdminLayout from './AdminLayout';

export default function AdminHome() {
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let cancelled = false;
    getTeam()
      .then(async (team) => {
        if (!team) return { team: null };
        const [players, games] = await Promise.all([getPlayers(team.id), getGames(team.id)]);
        return { team, players, games };
      })
      .then((s) => !cancelled && setState({ loading: false, ...s }))
      .catch((err) => !cancelled && setState({ loading: false, error: err.message }));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AdminLayout title="Overview">
      {state.loading ? (
        <p className="muted">Loading…</p>
      ) : !state.team ? (
        <div className="card card-pad">
          <p className="muted">No team set up yet.</p>
          <Link className="btn btn-primary btn-sm" to="/admin/team">Create Team</Link>
        </div>
      ) : (
        <div className="grid cols-3">
          <div className="kpi">
            <div className="kpi-label">Team</div>
            <div className="kpi-value" style={{ fontSize: '1.4rem' }}>{state.team.name}</div>
            <div className="kpi-sub">{state.team.season}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Roster</div>
            <div className="kpi-value num">{state.players.length}</div>
            <div className="kpi-sub"><Link to="/admin/players">Manage players →</Link></div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Games</div>
            <div className="kpi-value num">{state.games.length}</div>
            <div className="kpi-sub"><Link to="/admin/games">Manage games →</Link></div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
