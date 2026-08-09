import { useEffect, useState } from 'react';
import {
  getTeam, getGames, saveGame, deleteGame, getPlayers, getGameStats, saveGameStat, deleteGameStat,
  getDistinctSeasons,
} from '../../lib/api';
import { RAW_KEYS } from '../../stats/stats';
import AdminLayout from './AdminLayout';
import Badge from '../../components/Badge';

const BLANK = { date: '', opponent: '', event_name: '', runs: '', allowed: '', result: '', location: '', season: '' };

function blankStatRow(player, existing) {
  const row = { played: !!existing, existingId: existing?.id || null };
  RAW_KEYS.forEach((k) => (row[k] = existing ? existing[k] || 0 : 0));
  return { player, ...row };
}

export default function AdminGames() {
  const [team, setTeam] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [players, setPlayers] = useState([]);
  const [games, setGames] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [editingId, setEditingId] = useState(null);
  const [statRows, setStatRows] = useState([]);
  const [msg, setMsg] = useState(null);
  const [statMsg, setStatMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [statsBusy, setStatsBusy] = useState(false);

  async function refresh(teamId, season) {
    setGames(await getGames(teamId));
    setSeasons(await getDistinctSeasons(teamId, season));
  }

  useEffect(() => {
    getTeam().then(async (t) => {
      setTeam(t);
      if (t) {
        setForm((f) => ({ ...f, season: t.season }));
        setPlayers(await getPlayers(t.id));
        await refresh(t.id, t.season);
      }
    });
  }, []);

  async function loadStatsFor(gameId) {
    const existingRows = await getGameStats(gameId);
    const byPlayer = new Map(existingRows.map((r) => [r.player_id, r]));
    setStatRows(players.map((p) => blankStatRow(p, byPlayer.get(p.id))));
  }

  function startEdit(g) {
    setEditingId(g.id);
    setForm({
      date: g.date, opponent: g.opponent, event_name: g.event_name || '',
      runs: g.runs ?? '', allowed: g.allowed ?? '', result: g.result || '',
      location: g.location || '', season: g.season,
    });
    setMsg(null);
    setStatMsg(null);
    loadStatsFor(g.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function resetForm() {
    setEditingId(null);
    setForm((f) => ({ ...BLANK, season: team?.season || '' }));
    setStatRows([]);
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
        season: form.season,
      };
      if (editingId) payload.id = editingId;
      const saved = await saveGame(payload);
      await refresh(team.id, team.season);
      setMsg({ type: 'ok', text: editingId ? 'Game updated.' : 'Game added. Now enter player stats below.' });
      // Stay in edit mode on the saved game so the stats panel below
      // has a game_id to attach to right away.
      setEditingId(saved.id);
      setForm((f) => ({ ...f, season: saved.season }));
      await loadStatsFor(saved.id);
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this game and all its player stats?')) return;
    try {
      await deleteGame(id);
      await refresh(team.id, team.season);
      if (editingId === id) resetForm();
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    }
  }

  function updateStatField(playerId, key, value) {
    setStatRows((rows) => rows.map((r) => (r.player.id === playerId ? { ...r, [key]: value } : r)));
  }
  function togglePlayed(playerId) {
    setStatRows((rows) => rows.map((r) => (r.player.id === playerId ? { ...r, played: !r.played } : r)));
  }

  async function handleSaveStats() {
    if (!editingId) return;
    setStatsBusy(true);
    setStatMsg(null);
    try {
      for (const row of statRows) {
        if (row.played) {
          const payload = { game_id: editingId, player_id: row.player.id };
          if (row.existingId) payload.id = row.existingId;
          RAW_KEYS.forEach((k) => (payload[k] = Number(row[k]) || 0));
          await saveGameStat(payload, form.season);
        } else if (row.existingId) {
          await deleteGameStat(row.existingId, row.player.id, form.season);
        }
      }
      await loadStatsFor(editingId);
      setStatMsg({ type: 'ok', text: 'Player stats saved. Season totals recomputed automatically.' });
    } catch (err) {
      setStatMsg({ type: 'err', text: err.message });
    } finally {
      setStatsBusy(false);
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
            <div className="grid cols-2">
              <div className="field">
                <label htmlFor="g-event">Event</label>
                <input id="g-event" value={form.event_name} onChange={(e) => setForm({ ...form, event_name: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="g-season">Season</label>
                <input id="g-season" list="season-options" required value={form.season} onChange={(e) => setForm({ ...form, season: e.target.value })} />
                <datalist id="season-options">
                  {seasons.map((s) => <option key={s} value={s} />)}
                </datalist>
              </div>
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
                <button type="button" className="btn btn-ghost" onClick={resetForm}>Done / New Game</button>
              )}
            </div>
          </form>

          {editingId && (
            <div className="card card-pad" style={{ marginBottom: '1.6rem' }}>
              <h3 style={{ marginTop: 0 }}>Player Stats — {form.date} vs {form.opponent}</h3>
              <p className="muted" style={{ fontSize: '.82rem' }}>
                Check "Played" for anyone who appeared in this game and enter their line. Season
                totals recompute automatically from every game a player has stats in.
              </p>
              {statMsg && <p className={`admin-toast ${statMsg.type}`}>{statMsg.text}</p>}
              <div className="table-wrap">
                <table className="stats">
                  <thead>
                    <tr>
                      <th className="left">Player</th>
                      <th className="center">Played</th>
                      {RAW_KEYS.map((k) => <th key={k} className="num">{k}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {statRows.map((row) => (
                      <tr key={row.player.id}>
                        <td className="left">{row.player.name_en || row.player.name}</td>
                        <td className="center">
                          <input type="checkbox" checked={row.played} onChange={() => togglePlayed(row.player.id)} />
                        </td>
                        {RAW_KEYS.map((k) => (
                          <td key={k} className="num">
                            <input
                              type="number"
                              min="0"
                              value={row[k]}
                              disabled={!row.played}
                              onChange={(e) => updateStatField(row.player.id, k, e.target.value)}
                              style={{ width: 52, padding: '.25rem .35rem', border: '1px solid var(--line-2)', borderRadius: 6, background: 'var(--ink-2)', color: 'var(--text)' }}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="form-actions">
                <button className="btn btn-primary btn-sm" onClick={handleSaveStats} disabled={statsBusy}>
                  {statsBusy ? 'Saving…' : 'Save Player Stats'}
                </button>
              </div>
            </div>
          )}

          <div className="table-wrap">
            <table className="stats">
              <thead>
                <tr>
                  <th className="left">Date</th><th className="left">Opponent</th><th className="left">Season</th>
                  <th className="right">Runs</th><th className="right">Allowed</th>
                  <th className="center">Result</th><th></th>
                </tr>
              </thead>
              <tbody>
                {games.map((g) => (
                  <tr key={g.id}>
                    <td className="left num">{g.date}</td>
                    <td className="left">vs {g.opponent}</td>
                    <td className="left muted">{g.season}</td>
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
