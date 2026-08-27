import { useEffect, useState } from 'react';
import {
  getTeam, getPlayers, savePlayer, deletePlayer, uploadPlayerPhoto,
  getDistinctSeasons, enrollPlayerInSeason, removePlayerFromSeason,
} from '../../lib/api';
import { useAdminSchool } from '../../context/AdminSchoolContext';
import AdminLayout from './AdminLayout';
import Avatar from '../../components/Avatar';

const BLANK = { name: '', name_en: '', number: '', position: '', profile_photo_url: '' };

export default function AdminPlayers() {
  const { teamId } = useAdminSchool();
  const [team, setTeam] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [season, setSeason] = useState('');
  const [roster, setRoster] = useState([]);
  const [allPlayers, setAllPlayers] = useState([]);
  const [enrollId, setEnrollId] = useState('');
  const [form, setForm] = useState(BLANK);
  const [editingId, setEditingId] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function refreshRoster(tid, s) {
    const [rosterList, everyone] = await Promise.all([getPlayers(tid, s), getPlayers(tid)]);
    setRoster(rosterList);
    setAllPlayers(everyone);
  }

  useEffect(() => {
    if (!teamId) {
      setTeam(null);
      return;
    }
    getTeam(teamId).then(async (t) => {
      setTeam(t);
      setSeason(t.season);
      setSeasons(await getDistinctSeasons(t.id, t.season));
      await refreshRoster(t.id, t.season);
    });
  }, [teamId]);

  async function handleSeasonChange(next) {
    setSeason(next);
    await refreshRoster(team.id, next);
  }

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
      if (!editingId) await enrollPlayerInSeason(saved.id, season);
      await refreshRoster(team.id, season);
      setMsg({ type: 'ok', text: editingId ? 'Player updated.' : 'Player added.' });
      resetForm();
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleEnroll() {
    if (!enrollId) return;
    try {
      await enrollPlayerInSeason(enrollId, season);
      setEnrollId('');
      await refreshRoster(team.id, season);
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    }
  }

  async function handleRemoveFromSeason(id) {
    if (!window.confirm(`Remove this player from the ${season} roster? Their history in other seasons is untouched.`)) return;
    try {
      await removePlayerFromSeason(id, season);
      await refreshRoster(team.id, season);
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this player and all their history, in every season?')) return;
    try {
      await deletePlayer(id);
      await refreshRoster(team.id, season);
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    }
  }

  const notOnRoster = allPlayers.filter((p) => !roster.some((r) => r.id === p.id));

  return (
    <AdminLayout title="Players">
      {!team ? (
        <p className="muted">Set up a team first.</p>
      ) : (
        <>
          <div className="field" style={{ maxWidth: 240, marginBottom: '1.2rem' }}>
            <label htmlFor="ap-season">Season</label>
            <select id="ap-season" value={season} onChange={(e) => handleSeasonChange(e.target.value)}>
              {seasons.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <form className="card card-pad form-grid" onSubmit={handleSubmit} style={{ maxWidth: 520, marginBottom: '1.6rem' }}>
            <h3 style={{ margin: 0 }}>{editingId ? 'Edit Player' : `Add Player (enrolls in ${season})`}</h3>
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

          {notOnRoster.length > 0 && (
            <div className="card card-pad" style={{ maxWidth: 520, marginBottom: '1.6rem', display: 'flex', gap: '.6rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="field" style={{ flex: 1, minWidth: 200 }}>
                <label htmlFor="ap-enroll">Add an existing player to {season}</label>
                <select id="ap-enroll" value={enrollId} onChange={(e) => setEnrollId(e.target.value)}>
                  <option value="">Select a player…</option>
                  {notOnRoster.map((p) => (
                    <option key={p.id} value={p.id}>{p.name_en || p.name}</option>
                  ))}
                </select>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleEnroll} disabled={!enrollId}>
                Add to roster
              </button>
            </div>
          )}

          <div className="table-wrap">
            <table className="stats">
              <thead>
                <tr>
                  <th>Player</th><th>#</th><th>Pos</th><th></th>
                </tr>
              </thead>
              <tbody>
                {roster.map((p) => (
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
                        <button className="btn btn-ghost btn-sm" onClick={() => handleRemoveFromSeason(p.id)}>Remove from {season}</button>
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
