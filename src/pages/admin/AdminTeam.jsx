import { useEffect, useState } from 'react';
import { getTeam, upsertTeam } from '../../lib/api';
import AdminLayout from './AdminLayout';

export default function AdminTeam() {
  const [team, setTeam] = useState(null);
  const [form, setForm] = useState({ name: '', season: '', logo_url: '' });
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTeam().then((t) => {
      if (t) setForm({ name: t.name, season: t.season, logo_url: t.logo_url || '' });
      setTeam(t);
      setLoading(false);
    });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg(null);
    try {
      const saved = await upsertTeam(team?.id ? { id: team.id, ...form } : form);
      setTeam(saved);
      setMsg({ type: 'ok', text: 'Team saved.' });
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    }
  }

  return (
    <AdminLayout title="Team">
      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <form className="card card-pad form-grid" onSubmit={handleSubmit} style={{ maxWidth: 480 }}>
          {msg && <p className={`admin-toast ${msg.type}`}>{msg.text}</p>}
          <div className="field">
            <label htmlFor="t-name">Name</label>
            <input id="t-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="t-season">Season</label>
            <input id="t-season" required placeholder="2025-2026" value={form.season} onChange={(e) => setForm({ ...form, season: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="t-logo">Logo URL</label>
            <input id="t-logo" value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} />
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit">Save Team</button>
          </div>
        </form>
      )}
    </AdminLayout>
  );
}
