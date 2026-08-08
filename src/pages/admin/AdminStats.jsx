import { useEffect, useState } from 'react';
import {
  getTeam, getPlayers, getPlayerSeasonStats, savePlayerSeasonStats, deletePlayerSeasonStats,
} from '../../lib/api';
import { RAW_KEYS, derive, fmtRate } from '../../stats/stats';
import AdminLayout from './AdminLayout';

function blankForm(season) {
  const f = { season: season || '', G: 0 };
  RAW_KEYS.forEach((k) => (f[k] = 0));
  return f;
}

export default function AdminStats() {
  const [team, setTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [playerId, setPlayerId] = useState('');
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(blankForm(''));
  const [editingId, setEditingId] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getTeam().then(async (t) => {
      setTeam(t);
      if (t) {
        const ps = await getPlayers(t.id);
        setPlayers(ps);
        if (ps.length) setPlayerId(ps[0].id);
        setForm(blankForm(t.season));
      }
    });
  }, []);

  useEffect(() => {
    if (!playerId) return;
    getPlayerSeasonStats(playerId).then(setRows);
    setEditingId(null);
    setForm(blankForm(team?.season));
  }, [playerId]); // eslint-disable-line react-hooks/exhaustive-deps

  function startEdit(row) {
    setEditingId(row.id);
    const f = { season: row.season };
    RAW_KEYS.forEach((k) => (f[k] = row[k] || 0));
    f.G = row.G || 0;
    setForm(f);
    setMsg(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function resetForm() {
    setEditingId(null);
    setForm(blankForm(team?.season));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!playerId) return;
    setBusy(true);
    setMsg(null);
    try {
      const payload = { player_id: playerId, season: form.season, G: Number(form.G) || 0 };
      RAW_KEYS.forEach((k) => (payload[k] = Number(form[k]) || 0));
      if (editingId) payload.id = editingId;
      await savePlayerSeasonStats(payload);
      setRows(await getPlayerSeasonStats(playerId));
      setMsg({ type: 'ok', text: 'Season stats saved. AVG/OBP/SLG/OPS recompute automatically.' });
      resetForm();
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this season record?')) return;
    try {
      await deletePlayerSeasonStats(id);
      setRows(await getPlayerSeasonStats(playerId));
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    }
  }

  return (
    <AdminLayout title="Season Stats">
      {!team ? (
        <p className="muted">Set up a team first.</p>
      ) : !players.length ? (
        <p className="muted">Add a player first.</p>
      ) : (
        <>
          <div className="field" style={{ maxWidth: 320, marginBottom: '1.2rem' }}>
            <label htmlFor="stat-player">Player</label>
            <select id="stat-player" value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
              {players.map((p) => (
                <option key={p.id} value={p.id}>{p.name_en || p.name} ({p.name})</option>
              ))}
            </select>
          </div>

          <form className="card card-pad form-grid" onSubmit={handleSubmit} style={{ marginBottom: '1.6rem' }}>
            <h3 style={{ margin: 0 }}>{editingId ? 'Edit Season' : 'Add Season'}</h3>
            <p className="muted" style={{ margin: 0, fontSize: '.82rem' }}>
              Enter raw counting stats only. TB, PA, ePA, and AVG/OBP/SLG/OPS are computed automatically on save.
            </p>
            {msg && <p className={`admin-toast ${msg.type}`}>{msg.text}</p>}
            <div className="field" style={{ maxWidth: 200 }}>
              <label htmlFor="s-season">Season</label>
              <input id="s-season" required placeholder="2025-2026" value={form.season} onChange={(e) => setForm({ ...form, season: e.target.value })} />
            </div>
            <div className="grid cols-4">
              {['G', ...RAW_KEYS].map((k) => (
                <div className="field" key={k}>
                  <label htmlFor={`s-${k}`}>{k}</label>
                  <input
                    id={`s-${k}`}
                    type="number"
                    min="0"
                    value={form[k]}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Saving…' : editingId ? 'Save Changes' : 'Add Season'}
              </button>
              {editingId && (
                <button type="button" className="btn btn-ghost" onClick={resetForm}>Cancel</button>
              )}
            </div>
          </form>

          <div className="table-wrap">
            <table className="stats">
              <thead>
                <tr>
                  <th>Season</th><th className="num">G</th><th className="num">AB</th><th className="num">H</th>
                  <th className="num">AVG</th><th className="num">OPS</th><th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const d = derive(r);
                  return (
                    <tr key={r.id}>
                      <td>{r.season}</td>
                      <td className="num">{r.G}</td>
                      <td className="num">{r.AB}</td>
                      <td className="num">{r.H}</td>
                      <td className="num">{fmtRate(d.AVG)}</td>
                      <td className="num">{fmtRate(d.OPS)}</td>
                      <td>
                        <div className="admin-table-actions">
                          <button className="btn btn-ghost btn-sm" onClick={() => startEdit(r)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
