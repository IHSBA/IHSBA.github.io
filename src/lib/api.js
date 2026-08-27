/*
 * api.js -- the only module that talks to Supabase for reads/writes.
 * Thin wrappers around supabase-js so pages/components stay declarative.
 * Scope is currently one team, but every query is already team_id-scoped
 * so adding more schools later doesn't touch this file's shape.
 */
import { supabase } from './supabaseClient';
import { computeStoredFields, RAW_KEYS } from '../stats/stats';

// ---- teams -----------------------------------------------------------
// Multi-school scope: every school is a row in `teams`. `getTeam(id)`
// with no id falls back to the first row, kept only for old call sites
// that just want "a" team (e.g. bootstrapping admin's school picker).
export async function getTeam(id) {
  let q = supabase.from('teams').select('*');
  q = id ? q.eq('id', id).single() : q.order('created_at').limit(1).maybeSingle();
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function getTeamBySlug(slug) {
  const { data, error } = await supabase.from('teams').select('*').eq('slug', slug).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getTeams() {
  const { data, error } = await supabase.from('teams').select('*').order('name');
  if (error) throw error;
  return data;
}

export async function upsertTeam(team) {
  const { data, error } = await supabase.from('teams').upsert(team).select().single();
  if (error) throw error;
  return data;
}

// ---- players ----------------------------------------------------------
// With `season`, only players enrolled in that season's roster
// (player_seasons) come back; without it, every player the team has
// ever had (used by admin bio-editing, which is season-agnostic).
export async function getPlayers(teamId, season) {
  let q = supabase.from('players').select(season ? '*, player_seasons!inner(season)' : '*').order('number', { ascending: true, nullsFirst: false });
  if (teamId) q = q.eq('team_id', teamId);
  if (season) q = q.eq('player_seasons.season', season);
  const { data, error } = await q;
  if (error) throw error;
  return season ? data.map(({ player_seasons, ...p }) => p) : data;
}

// ---- roster membership (player_seasons) --------------------------------
export async function enrollPlayerInSeason(playerId, season) {
  const { error } = await supabase.from('player_seasons').upsert({ player_id: playerId, season });
  if (error) throw error;
}

export async function removePlayerFromSeason(playerId, season) {
  const { error } = await supabase.from('player_seasons').delete().eq('player_id', playerId).eq('season', season);
  if (error) throw error;
}

// Enrolls every player currently on `fromSeason`'s roster into `toSeason`
// too (used when creating a new season from the admin Season tab).
export async function copyRosterToSeason(teamId, fromSeason, toSeason) {
  const roster = await getPlayers(teamId, fromSeason);
  if (!roster.length) return;
  const { error } = await supabase
    .from('player_seasons')
    .upsert(roster.map((p) => ({ player_id: p.id, season: toSeason })));
  if (error) throw error;
}

export async function getPlayer(id) {
  const { data, error } = await supabase.from('players').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function savePlayer(player) {
  const { data, error } = await supabase.from('players').upsert(player).select().single();
  if (error) throw error;
  return data;
}

export async function deletePlayer(id) {
  const { error } = await supabase.from('players').delete().eq('id', id);
  if (error) throw error;
}

export async function uploadPlayerPhoto(playerId, file) {
  const ext = file.name.split('.').pop();
  const path = `${playerId}-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from('player-photos').upload(path, file, { upsert: true });
  if (upErr) throw upErr;
  const { data } = supabase.storage.from('player-photos').getPublicUrl(path);
  return data.publicUrl;
}

// ---- player season stats ----------------------------------------------
export async function getPlayerSeasonStats(playerId) {
  const { data, error } = await supabase
    .from('player_season_stats')
    .select('*')
    .eq('player_id', playerId)
    .order('season', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getAllSeasonStats(teamId) {
  // player_season_stats has no team_id directly; join through players.
  const { data, error } = await supabase
    .from('player_season_stats')
    .select('*, players!inner(id, team_id)')
    .eq('players.team_id', teamId);
  if (error) throw error;
  return data;
}

// `raw` holds only the fields the admin types by hand; TB/PA/ePA are
// computed here and written alongside them, per stats.js.
export async function savePlayerSeasonStats(row) {
  const stored = computeStoredFields(row);
  const payload = { ...row, ...stored };
  const { data, error } = await supabase
    .from('player_season_stats')
    .upsert(payload, { onConflict: 'player_id,season' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePlayerSeasonStats(id) {
  const { error } = await supabase.from('player_season_stats').delete().eq('id', id);
  if (error) throw error;
}

// Recompute one player's season row from the sum of their game_stats
// rows in that season, and upsert it (or delete it if they have no
// games left in that season). This is the ONLY way player_season_stats
// gets written now -- the admin edits game_stats, never season totals
// directly. Called after every game_stats save/delete.
export async function recomputeSeasonStats(playerId, season) {
  const { data: rows, error } = await supabase
    .from('game_stats')
    .select('*, games!inner(season)')
    .eq('player_id', playerId)
    .eq('games.season', season);
  if (error) throw error;

  if (!rows.length) {
    const { error: delErr } = await supabase
      .from('player_season_stats')
      .delete()
      .eq('player_id', playerId)
      .eq('season', season);
    if (delErr) throw delErr;
    return null;
  }

  const totals = { G: rows.length };
  RAW_KEYS.forEach((k) => (totals[k] = 0));
  rows.forEach((r) => RAW_KEYS.forEach((k) => (totals[k] += Number(r[k]) || 0)));
  const stored = computeStoredFields(totals);
  const payload = { player_id: playerId, season, ...totals, ...stored };
  const { data, error: upErr } = await supabase
    .from('player_season_stats')
    .upsert(payload, { onConflict: 'player_id,season' })
    .select()
    .single();
  if (upErr) throw upErr;
  return data;
}

// ---- game stats (per-player box-score line for one game) --------------
export async function getGameStats(gameId) {
  const { data, error } = await supabase
    .from('game_stats')
    .select('*, players(id, name, name_en, number, position)')
    .eq('game_id', gameId);
  if (error) throw error;
  return data;
}

// `row` = { id?, game_id, player_id, ...raw fields }. Recomputes the
// player's season total afterward so it's never stale.
export async function saveGameStat(row, season) {
  const { data, error } = await supabase.from('game_stats').upsert(row, { onConflict: 'game_id,player_id' }).select().single();
  if (error) throw error;
  await recomputeSeasonStats(row.player_id, season);
  return data;
}

export async function deleteGameStat(id, playerId, season) {
  const { error } = await supabase.from('game_stats').delete().eq('id', id);
  if (error) throw error;
  await recomputeSeasonStats(playerId, season);
}

// ---- games --------------------------------------------------------
export async function getGames(teamId, season) {
  let q = supabase.from('games').select('*').order('date', { ascending: false });
  if (teamId) q = q.eq('team_id', teamId);
  if (season) q = q.eq('season', season);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

// Every distinct season seen across this team's games, newest first,
// always including the team's current `season` even if it has no games
// yet (so a freshly-added season is immediately selectable).
export async function getDistinctSeasons(teamId, currentSeason) {
  const { data, error } = await supabase.from('games').select('season').eq('team_id', teamId);
  if (error) throw error;
  const set = new Set(data.map((r) => r.season));
  if (currentSeason) set.add(currentSeason);
  return Array.from(set).sort().reverse();
}

export async function getGame(id) {
  const { data, error } = await supabase.from('games').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function saveGame(game) {
  const { data, error } = await supabase.from('games').upsert(game).select().single();
  if (error) throw error;
  return data;
}

export async function deleteGame(id) {
  const { error } = await supabase.from('games').delete().eq('id', id);
  if (error) throw error;
}
