-- IHSBA initial schema + RLS
-- ------------------------------------------------------------------
-- Access model: everyone can read; only an authenticated user (the
-- single admin) can write. There is no per-row ownership -- one team
-- for now, more schools join later without changing this model.
-- Run this in the Supabase SQL editor, or via `supabase db push`.
-- ------------------------------------------------------------------

-- ---- teams ----------------------------------------------------------
create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  season text not null,
  created_at timestamptz not null default now()
);

-- ---- players ----------------------------------------------------------
-- name_en is an extra bilingual field beyond the base spec (Korean +
-- English display names are both used throughout the UI); everything
-- else matches the spec's players table 1:1.
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  name text not null,
  name_en text,
  number int,
  position text,
  profile_photo_url text,
  created_at timestamptz not null default now()
);
create index if not exists players_team_id_idx on players(team_id);

-- ---- player_season_stats --------------------------------------------
-- Raw counting stats only. AVG/OBP/SLG/OPS etc. are always derived in
-- the app (src/stats/stats.js), never stored.
create table if not exists player_season_stats (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  season text not null,
  "G" int not null default 0,
  "PA" int not null default 0,
  "ePA" int not null default 0,
  "AB" int not null default 0,
  "R" int not null default 0,
  "H" int not null default 0,
  "2B" int not null default 0,
  "3B" int not null default 0,
  "HR" int not null default 0,
  "TB" int not null default 0,
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
  unique (player_id, season)
);
create index if not exists player_season_stats_player_id_idx on player_season_stats(player_id);

-- ---- games ------------------------------------------------------------
create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  date date not null,
  opponent text not null,
  event_name text,
  runs int,
  allowed int,
  result text check (result in ('W', 'L', 'T')),
  location text,
  created_at timestamptz not null default now()
);
create index if not exists games_team_id_idx on games(team_id);

-- ---- row level security ------------------------------------------------
alter table teams enable row level security;
alter table players enable row level security;
alter table player_season_stats enable row level security;
alter table games enable row level security;

-- Public read access on every table.
create policy "public read teams" on teams for select using (true);
create policy "public read players" on players for select using (true);
create policy "public read player_season_stats" on player_season_stats for select using (true);
create policy "public read games" on games for select using (true);

-- Only the authenticated admin can write. No per-user ownership check --
-- there is exactly one admin account (created manually in Supabase Auth).
create policy "admin write teams" on teams for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin write players" on players for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin write player_season_stats" on player_season_stats for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin write games" on games for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ---- storage: player profile photos ------------------------------------
-- Create the bucket once (id must be unique). Public read, admin write.
insert into storage.buckets (id, name, public)
values ('player-photos', 'player-photos', true)
on conflict (id) do nothing;

create policy "public read player photos" on storage.objects for select
  using (bucket_id = 'player-photos');
create policy "admin write player photos" on storage.objects for insert
  with check (bucket_id = 'player-photos' and auth.role() = 'authenticated');
create policy "admin update player photos" on storage.objects for update
  using (bucket_id = 'player-photos' and auth.role() = 'authenticated');
create policy "admin delete player photos" on storage.objects for delete
  using (bucket_id = 'player-photos' and auth.role() = 'authenticated');
