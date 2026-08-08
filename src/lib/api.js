/*
 * api.js -- the only module that talks to Supabase for reads/writes.
 * Thin wrappers around supabase-js so pages/components stay declarative.
 * Scope is currently one team, but every query is already team_id-scoped
 * so adding more schools later doesn't touch this file's shape.
 */
import { supabase } from './supabaseClient';
import { computeStoredFields } from '../stats/stats';

// ---- team -----------------------------------------------------------
// Single-team scope for now: the first team row is "the" team.
export async function getTeam() {
  const { data, error } = await supabase.from('teams').select('*').order('created_at').limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertTeam(team) {
  const { data, error } = await supabase.from('teams').upsert(team).select().single();
  if (error) throw error;
  return data;
}

// ---- players ----------------------------------------------------------
export async function getPlayers(teamId) {
  let q = supabase.from('players').select('*').order('number', { ascending: true, nullsFirst: false });
  if (teamId) q = q.eq('team_id', teamId);
  const { data, error } = await q;
  if (error) throw error;
  return data;
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

// ---- games --------------------------------------------------------
export async function getGames(teamId) {
  let q = supabase.from('games').select('*').order('date', { ascending: false });
  if (teamId) q = q.eq('team_id', teamId);
  const { data, error } = await q;
  if (error) throw error;
  return data;
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
