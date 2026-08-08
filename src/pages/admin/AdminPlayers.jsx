import { useEffect, useState } from 'react';
import { getTeam, getPlayers, savePlayer, deletePlayer, uploadPlayerPhoto } from '../../lib/api';
import AdminLayout from './AdminLayout';
import Avatar from '../../components/Avatar';

const BLANK = { name: '', name_en: '', number: '', position: '', profile_photo_url: '' };

export default function AdminPlayers() {
  const [team, setTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [editingId, setEditingId] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function refresh(teamId) {
    setPlayers(await getPlayers(teamId));
  }

  useEffect(() => {
    getTeam().then(async (t) => {
      setTeam(t);
      if (t) await refresh(t.id);
    });
  }, []);

  function startEdit(p) {
    setEditingId(p.id);
    setForm({
      name: p.name, name_en: p.name_en || '', number: p.number ?? '',
      position: p.position || '', profile_photo_url: p.profile_photo_url || '',
    });
    setPhotoFile(null);
    setMsg(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function resetForm() {
    setEditingId(null);
    setForm(BLANK);
    setPhotoFile(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!team) return;
    setBusy(true);
    setMsg(null);
    try {
      let photoUrl = form.profile_photo_url;
      const payload = {
        team_id: team.id,
        name: form.name,
        name_en: form.name_en || null,
        number: form.number === '' ? null : Number(form.number),
        position: form.position || null,
      };
      if (editingId) payload.id = editingId;
      // Insert/update first so we have a player id to key the photo filename on.
      const saved = await savePlayer(payload);
      if (photoFile) {
        photoUrl = await uploadPlayerPhoto(saved.id, photoFile);
        await savePlayer({ id: saved.id, profile_photo_url: photoUrl });
      }
      await refresh(team.id);
      setMsg({ type: 'ok', text: editingId ? 'Player updated.' : 'Player added.' });
      resetForm();
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this player and all their season stats?')) return;
    try {
      await deletePlayer(id);
      await refresh(team.id);
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    }
  }

  return (
    <AdminLayout title="Players">
      {!team ? (
        <p className="muted">Set up a team first.</p>
      ) : (
        <>
          <form className="card card-pad form-grid" onSubmit={handleSubmit} style={{ maxWidth: 520, marginBottom: '1.6rem' }}>
            <h3 style={{ margin: 0 }}>{editingId ? 'Edit Player' : 'Add Player'}</h3>
            {msg && <p className={`admin-toast ${msg.type}`}>{msg.text}</p>}
            <div className="field">
              <label htmlFor="p-name">Name (Korean)</label>
              <input id="p-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="p-name-en">Name (English)</label>
              <input id="p-name-en" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="p-number">Number</label>
              <input id="p-number" type="number" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="p-position">Position</label>
              <input id="p-position" placeholder="SS, C, DH..." value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="p-photo">Profile Photo</label>
              <div className="photo-upload">
                <Avatar player={{ ...form, profile_photo_url: photoFile ? URL.createObjectURL(photoFile) : form.profile_photo_url }} size="sm" />
                <input id="p-photo" type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files[0] || null)} />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Saving…' : editingId ? 'Save Changes' : 'Add Player'}
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
                  <th>Player</th><th>#</th><th>Pos</th><th></th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.id}>
                    <td className="name-cell">
                      <Avatar player={p} size="xs" />
                      <span>{p.name_en || p.name} <span className="muted">({p.name})</span></span>
                    </td>
                    <td className="num">{p.number ?? '-'}</td>
                    <td>{p.position || '-'}</td>
                    <td>
                      <div className="admin-table-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => startEdit(p)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}>Delete</button>
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
