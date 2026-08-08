import { useEffect, useState } from 'react';
import { getTeam, getGames, saveGame, deleteGame } from '../../lib/api';
import AdminLayout from './AdminLayout';
import Badge from '../../components/Badge';

const BLANK = { date: '', opponent: '', event_name: '', runs: '', allowed: '', result: '', location: '' };

export default function AdminGames() {
  const [team, setTeam] = useState(null);
  const [games, setGames] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [editingId, setEditingId] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function refresh(teamId) {
    setGames(await getGames(teamId));
  }

  useEffect(() => {
    getTeam().then(async (t) => {
      setTeam(t);
      if (t) await refresh(t.id);
    });
  }, []);

  function startEdit(g) {
    setEditingId(g.id);
    setForm({
      date: g.date, opponent: g.opponent, event_name: g.event_name || '',
      runs: g.runs ?? '', allowed: g.allowed ?? '', result: g.result || '', location: g.location || '',
    });
    setMsg(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function resetForm() {
    setEditingId(null);
    setForm(BLANK);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!team) return;
    setBusy(true);
    setMsg(null);
    try {
      const payload = {
        team_id: team.id,
        date: form.date,
        opponent: form.opponent,
        event_name: form.event_name || null,
        runs: form.runs === '' ? null : Number(form.runs),
        allowed: form.allowed === '' ? null : Number(form.allowed),
        result: form.result || null,
        location: form.location || null,
      };
      if (editingId) payload.id = editingId;
      await saveGame(payload);
      await refresh(team.id);
      setMsg({ type: 'ok', text: editingId ? 'Game updated.' : 'Game added.' });
      resetForm();
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this game?')) return;
    try {
      await deleteGame(id);
      await refresh(team.id);
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    }
  }

  return (
    <AdminLayout title="Games">
      {!team ? (
        <p className="muted">Set up a team first.</p>
      ) : (
        <>
          <form className="card card-pad form-grid" onSubmit={handleSubmit} style={{ maxWidth: 560, marginBottom: '1.6rem' }}>
            <h3 style={{ margin: 0 }}>{editingId ? 'Edit Game' : 'Add Game'}</h3>
            {msg && <p className={`admin-toast ${msg.type}`}>{msg.text}</p>}
            <div className="grid cols-2">
              <div className="field">
                <label htmlFor="g-date">Date</label>
                <input id="g-date" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="g-opponent">Opponent</label>
                <input id="g-opponent" required value={form.opponent} onChange={(e) => setForm({ ...form, opponent: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="g-event">Event</label>
              <input id="g-event" value={form.event_name} onChange={(e) => setForm({ ...form, event_name: e.target.value })} />
            </div>
            <div className="grid cols-3">
              <div className="field">
                <label htmlFor="g-runs">Runs</label>
                <input id="g-runs" type="number" value={form.runs} onChange={(e) => setForm({ ...form, runs: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="g-allowed">Allowed</label>
                <input id="g-allowed" type="number" value={form.allowed} onChange={(e) => setForm({ ...form, allowed: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="g-result">Result</label>
                <select id="g-result" value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })}>
                  <option value="">-</option>
                  <option value="W">W</option>
                  <option value="L">L</option>
                  <option value="T">T</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="g-location">Location</label>
              <input id="g-location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Saving…' : editingId ? 'Save Changes' : 'Add Game'}
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
                  <th className="left">Date</th><th className="left">Opponent</th>
                  <th className="right">Runs</th><th className="right">Allowed</th>
                  <th className="center">Result</th><th></th>
                </tr>
              </thead>
              <tbody>
                {games.map((g) => (
                  <tr key={g.id}>
                    <td className="left num">{g.date}</td>
                    <td className="left">vs {g.opponent}</td>
                    <td className="right num">{g.runs ?? '-'}</td>
                    <td className="right num">{g.allowed ?? '-'}</td>
                    <td className="center"><Badge result={g.result} /></td>
                    <td>
                      <div className="admin-table-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => startEdit(g)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(g.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
