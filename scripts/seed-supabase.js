#!/usr/bin/env node
/*
 * seed-supabase.js -- one-time import of the legacy data/seed.json
 * (schools/players/games/battingLines) into the new Supabase schema.
 *
 * Run locally only: `npm run seed`. Needs SUPABASE_SERVICE_ROLE_KEY set
 * in .env (never VITE_-prefixed -- it must never ship to the browser).
 * The service role key bypasses RLS, which is exactly what a one-time
 * bulk import needs and what the browser client must never have.
 *
 * Upserts on natural keys (team name+season, player name+team,
 * game team+date+opponent) so re-running doesn't duplicate rows.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import WebSocket from 'ws';
import { createClient } from '@supabase/supabase-js';

// Node 20 has no native WebSocket global; supabase-js's realtime client
// initializes one unconditionally even though this script never uses
// realtime subscriptions. Polyfill it so createClient() doesn't throw.
if (!globalThis.WebSocket) globalThis.WebSocket = WebSocket;

try {
  process.loadEnvFile();
} catch {
  // .env not present -- fall through, env vars may already be set.
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    'Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Set SUPABASE_SERVICE_ROLE_KEY in .env (Supabase dashboard -> Project Settings -> API -> secret key).'
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

// ---- stat math mirrored from src/stats/stats.js (kept dependency-free
// here since this is a plain Node script, not part of the Vite bundle) --
const RAW_KEYS = ['AB', 'R', 'H', '2B', '3B', 'HR', 'RBI', 'BB', 'HBP', 'IB', 'SB', 'CS', 'SO', 'GDP', 'SH', 'SF'];

function totalBases(s) {
  const singles = (s.H || 0) - (s['2B'] || 0) - (s['3B'] || 0) - (s.HR || 0);
  return Math.max(0, singles + 2 * (s['2B'] || 0) + 3 * (s['3B'] || 0) + 4 * (s.HR || 0));
}
function plateAppearances(s) {
  return (s.AB || 0) + (s.BB || 0) + (s.HBP || 0) + (s.SF || 0) + (s.SH || 0);
}
function effectivePA(pa, s) {
  return Math.max(0, pa - (s.IB || 0) - (s.SH || 0));
}

async function main() {
  const seedPath = path.join(__dirname, '..', 'data', 'seed.json');
  const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
  const school = seed.schools[0];
  if (!school) {
    console.log('No school in seed.json, nothing to do.');
    return;
  }

  // ---- team -----------------------------------------------------------
  let { data: team, error: teamErr } = await supabase
    .from('teams')
    .select('*')
    .eq('name', school.name)
    .eq('season', school.season)
    .maybeSingle();
  if (teamErr) throw teamErr;
  if (!team) {
    const { data, error } = await supabase
      .from('teams')
      .insert({ name: school.name, season: school.season, logo_url: school.logo || null })
      .select()
      .single();
    if (error) throw error;
    team = data;
  }
  console.log(`Team: ${team.name} (${team.id})`);

  // ---- players ----------------------------------------------------------
  const playerIdBySeedId = new Map();
  for (const p of seed.players) {
    const { data: existing, error: findErr } = await supabase
      .from('players')
      .select('*')
      .eq('team_id', team.id)
      .eq('name', p.name)
      .maybeSingle();
    if (findErr) throw findErr;

    const payload = {
      team_id: team.id,
      name: p.name,
      name_en: p.nameEn || null,
      number: p.number ?? null,
      position: p.position || null,
      // Legacy photos now live in public/img/players/*.jpg (moved there
      // for the Vite build) and are served at the same relative path.
      profile_photo_url: p.photo || null,
    };
    let row;
    if (existing) {
      const { data, error } = await supabase.from('players').update(payload).eq('id', existing.id).select().single();
      if (error) throw error;
      row = data;
    } else {
      const { data, error } = await supabase.from('players').insert(payload).select().single();
      if (error) throw error;
      row = data;
    }
    playerIdBySeedId.set(p.id, row.id);
  }
  console.log(`Players: ${playerIdBySeedId.size}`);

  // ---- games ------------------------------------------------------------
  const gameIdBySeedId = new Map();
  for (const g of seed.games) {
    const { data: existing, error: findErr } = await supabase
      .from('games')
      .select('id')
      .eq('team_id', team.id)
      .eq('date', g.date)
      .eq('opponent', g.opponent)
      .maybeSingle();
    if (findErr) throw findErr;
    const payload = {
      team_id: team.id,
      date: g.date,
      opponent: g.opponent,
      event_name: g.event || null,
      runs: g.ourScore ?? null,
      allowed: g.theirScore ?? null,
      result: g.result || null,
      location: g.location || null,
      season: school.season,
    };
    let row;
    if (existing) {
      const { data, error } = await supabase.from('games').update(payload).eq('id', existing.id).select().single();
      if (error) throw error;
      row = data;
    } else {
      const { data, error } = await supabase.from('games').insert(payload).select().single();
      if (error) throw error;
      row = data;
    }
    gameIdBySeedId.set(g.id, row.id);
  }
  console.log(`Games: ${gameIdBySeedId.size}`);

  // ---- game_stats: one row per player per game, straight from the
  // legacy per-game battingLines (legacy field names differ slightly:
  // IBB -> IB, SAC -> SH, GIDP -> GDP) ------------------------------
  let gameStatRows = 0;
  for (const line of seed.battingLines) {
    const playerId = playerIdBySeedId.get(line.playerId);
    const gameId = gameIdBySeedId.get(line.gameId);
    if (!playerId || !gameId) continue;
    const payload = {
      game_id: gameId,
      player_id: playerId,
      AB: line.AB || 0, R: line.R || 0, H: line.H || 0,
      '2B': line['2B'] || 0, '3B': line['3B'] || 0, HR: line.HR || 0,
      RBI: line.RBI || 0, BB: line.BB || 0, HBP: line.HBP || 0,
      IB: line.IBB || 0, SB: line.SB || 0, CS: line.CS || 0,
      SO: line.SO || 0, GDP: line.GIDP || 0, SH: line.SAC || 0, SF: line.SF || 0,
    };
    const { error } = await supabase.from('game_stats').upsert(payload, { onConflict: 'game_id,player_id' });
    if (error) throw error;
    gameStatRows++;
  }
  console.log(`Game stat rows: ${gameStatRows}`);

  // ---- player_season_stats: derived by summing each player's
  // game_stats rows for this season (mirrors src/lib/api.js
  // recomputeSeasonStats, kept dependency-free here) -------------------
  const byPlayer = new Map();
  for (const line of seed.battingLines) {
    if (!byPlayer.has(line.playerId)) byPlayer.set(line.playerId, []);
    byPlayer.get(line.playerId).push(line);
  }
  let statRows = 0;
  for (const [seedPlayerId, lines] of byPlayer.entries()) {
    const playerId = playerIdBySeedId.get(seedPlayerId);
    if (!playerId) continue;
    const totals = { G: lines.length };
    RAW_KEYS.forEach((k) => (totals[k] = 0));
    lines.forEach((l) => {
      totals.AB += l.AB || 0; totals.R += l.R || 0; totals.H += l.H || 0;
      totals['2B'] += l['2B'] || 0; totals['3B'] += l['3B'] || 0; totals.HR += l.HR || 0;
      totals.RBI += l.RBI || 0; totals.BB += l.BB || 0; totals.HBP += l.HBP || 0;
      totals.IB += l.IBB || 0; totals.SB += l.SB || 0; totals.CS += l.CS || 0;
      totals.SO += l.SO || 0; totals.GDP += l.GIDP || 0; totals.SH += l.SAC || 0; totals.SF += l.SF || 0;
    });
    const pa = plateAppearances(totals);
    const payload = {
      player_id: playerId,
      season: school.season,
      ...totals,
      TB: totalBases(totals),
      PA: pa,
      ePA: effectivePA(pa, totals),
    };
    const { error } = await supabase
      .from('player_season_stats')
      .upsert(payload, { onConflict: 'player_id,season' });
    if (error) throw error;
    statRows++;
  }
  console.log(`Season stat rows: ${statRows}`);
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
