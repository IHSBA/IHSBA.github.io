import { useEffect, useState } from 'react';
import { getTeam, upsertTeam, getDistinctSeasons } from '../../lib/api';
import AdminLayout from './AdminLayout';

// The "active season" is just teams.season -- Home/Players/Leaderboards
// already read it to decide what counts as "this season". Switching it
// here changes what the public site shows as current, and pre-fills the
// season field when adding new games in the Games tab.
export default function AdminSeason() {
  const [team, setTeam] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [picked, setPicked] = useState('');
  const [newSeason, setNewSeason] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const t = await getTeam();
    setTeam(t);
    if (t) {
      setPicked(t.season);
      setSeasons(await getDistinctSeasons(t.id, t.season));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function switchTo(season) {
    if (!team || !season) return;
    setBusy(true);
    setMsg(null);
    try {
      const saved = await upsertTeam({ id: team.id, season });
      setTeam(saved);
      setPicked(season);
      setMsg({ type: 'ok', text: `Active season is now ${season}.` });
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!newSeason.trim()) return;
    await switchTo(newSeason.trim());
    setNewSeason('');
    if (team) setSeasons(await getDistinctSeasons(team.id, newSeason.trim()));
  }

  return (
    <AdminLayout title="Season">
      {!team ? (
        <p className="muted">Set up a team first.</p>
      ) : (
        <>
          <p className="muted" style={{ maxWidth: 560 }}>
            Pick which season is active. New games and player stats you add in the Games tab default
            to this season, and it's what the public site shows as "this season".
          </p>

          {msg && <p className={`admin-toast ${msg.type}`}>{msg.text}</p>}

          <div className="card card-pad" style={{ maxWidth: 480, marginBottom: '1.2rem' }}>
            <h3 style={{ marginTop: 0 }}>Current season</h3>
            <p className="kpi-value num" style={{ margin: 0 }}>{team.season}</p>
          </div>

          {seasons.length > 1 && (
            <div className="field" style={{ maxWidth: 320, marginBottom: '1.2rem' }}>
              <label htmlFor="season-pick">Switch to an existing season</label>
              <select
                id="season-pick"
                value={picked}
                onChange={(e) => switchTo(e.target.value)}
                disabled={busy}
              >
                {seasons.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}

          <form className="card card-pad form-grid" onSubmit={handleAdd} style={{ maxWidth: 480 }}>
            <h3 style={{ margin: 0 }}>Add a new season</h3>
            <div className="field">
              <label htmlFor="new-season">Season label</label>
              <input
                id="new-season"
                placeholder="2026-2027"
                value={newSeason}
                onChange={(e) => setNewSeason(e.target.value)}
              />
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={busy || !newSeason.trim()}>
                Add &amp; Switch
              </button>
            </div>
          </form>
        </>
      )}
    </AdminLayout>
  );
}
