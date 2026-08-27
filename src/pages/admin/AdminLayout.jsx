import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAdminSchool } from '../../context/AdminSchoolContext';
import { upsertTeam } from '../../lib/api';

const TABS = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/season', label: 'Season' },
  { to: '/admin/team', label: 'Team' },
  { to: '/admin/players', label: 'Players' },
  { to: '/admin/games', label: 'Games' },
];

function slugify(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function AdminLayout({ title, children }) {
  const { teamId, teams, setTeamId, refresh } = useAdminSchool();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', season: '', slug: '' });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleAddSchool(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const slug = form.slug.trim() || slugify(form.name);
      const created = await upsertTeam({ name: form.name.trim(), season: form.season.trim(), slug });
      await refresh(created.id);
      setAdding(false);
      setForm({ name: '', season: '', slug: '' });
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container section">
      <div className="section-head">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>{title}</h1>
        </div>
        <div style={{ display: 'flex', gap: '.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {teams.length > 0 && (
            <select className="control" aria-label="School" value={teamId || ''} onChange={(e) => setTeamId(e.target.value)}>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding((a) => !a)}>
            {adding ? 'Cancel' : '+ New School'}
          </button>
        </div>
      </div>

      {adding && (
        <form className="card card-pad form-grid" onSubmit={handleAddSchool} style={{ maxWidth: 480, marginBottom: '1.4rem' }}>
          <h3 style={{ margin: 0 }}>New School</h3>
          {msg && <p className={`admin-toast ${msg.type}`}>{msg.text}</p>}
          <div className="field">
            <label htmlFor="ns-name">Name</label>
            <input id="ns-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="ns-season">Season</label>
            <input id="ns-season" required placeholder="2025-2026" value={form.season} onChange={(e) => setForm({ ...form, season: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="ns-slug">URL slug</label>
            <input id="ns-slug" placeholder={slugify(form.name) || 'auto from name'} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={busy || !form.name.trim() || !form.season.trim()}>
              {busy ? 'Creating…' : 'Create & Switch'}
            </button>
          </div>
        </form>
      )}

      <div className="segmented" style={{ marginBottom: '1.4rem' }}>
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) => (isActive ? 'active' : '')}
            style={{ display: 'inline-block' }}
          >
            {t.label}
          </NavLink>
        ))}
      </div>
      {children}
    </div>
  );
}
