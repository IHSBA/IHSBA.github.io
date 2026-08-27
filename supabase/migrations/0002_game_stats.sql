-- IHSBA: per-game player stats + season on games
-- ------------------------------------------------------------------
-- Adds the ability to enter one box-score line per player per game.
-- player_season_stats becomes a derived/cached table from here on:
-- the app recomputes and upserts a player's season row from the sum
-- of their game_stats rows in that season every time a game_stats row
-- is saved or deleted (see src/lib/api.js recomputeSeasonStats). The
-- admin no longer hand-types season totals directly.
-- ------------------------------------------------------------------

-- ---- games.season ------------------------------------------------------
alter table games add column if not exists season text;

-- Backfill existing games from their team's current season so nothing
-- becomes orphaned by this migration.
update games
from teams t
where g.team_id = t.id and g.season is null;

alter table games alter column season set not null;
create index if not exists games_season_idx on games(season);

-- ---- game_stats ------------------------------------------------------
-- One row per player per game. Raw counting stats only, same column
-- set as player_season_stats minus G/PA/ePA/TB (derived, computed in
-- the app and folded into the recomputed season row, not stored here
-- per-game to avoid a second source of truth for the same numbers).
create table if not exists game_stats (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  "AB" int not null default 0,
  "R" int not null default 0,
  "H" int not null default 0,
  "2B" int not null default 0,
  "3B" int not null default 0,
  "HR" int not null default 0,
  "RBI" int not null default 0,
  "SB" int not null default 0,
  "CS" int not null default 0,
  "BB" int not null default 0,
  "HBP" int not null default 0,
  "IB" int not null default 0,
  "SO" int not null default 0,
  "GDP" int not null default 0,
  "SH" int not null default 0,
  "SF" int not null default 0,
  created_at timestamptz not null default now(),
  unique (game_id, player_id)
);
create index if not exists game_stats_game_id_idx on game_stats(game_id);
create index if not exists game_stats_player_id_idx on game_stats(player_id);

alter table game_stats enable row level security;
create policy "public read game_stats" on game_stats for select using (true);
create policy "admin write game_stats" on game_stats for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
