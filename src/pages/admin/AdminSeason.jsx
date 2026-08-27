import { useEffect, useState } from 'react';
import { getTeam, upsertTeam, getDistinctSeasons, copyRosterToSeason } from '../../lib/api';
import { useAdminSchool } from '../../context/AdminSchoolContext';
import AdminLayout from './AdminLayout';

// The "active season" is just teams.season -- Home/Players/Leaderboards
// default their season picker to it. Switching it here changes what the
// public site shows as current, and pre-fills the season field when
// adding new games in the Games tab.
export default function AdminSeason() {
  const { teamId } = useAdminSchool();
  const [team, setTeam] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [picked, setPicked] = useState('');
  const [newSeason, setNewSeason] = useState('');
  const [copyRoster, setCopyRoster] = useState(true);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    if (!teamId) {
      setTeam(null);
      return;
    }
    const t = await getTeam(teamId);
    setTeam(t);
    setPicked(t.season);
    setSeasons(await getDistinctSeasons(t.id, t.season));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

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
    const target = newSeason.trim();
    if (!target || !team) return;
    const fromSeason = team.season;
    await switchTo(target);
    if (copyRoster && fromSeason && fromSeason !== target) {
      try {
        await copyRosterToSeason(team.id, fromSeason, target);
      } catch (err) {
        setMsg({ type: 'err', text: `Season created, but roster copy failed: ${err.message}` });
      }
    }
    setNewSeason('');
    setSeasons(await getDistinctSeasons(team.id, target));
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
            <label className="muted" style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.85rem' }}>
              <input type="checkbox" checked={copyRoster} onChange={(e) => setCopyRoster(e.target.checked)} />
              Copy current roster ({team.season}) into this season
            </label>
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
