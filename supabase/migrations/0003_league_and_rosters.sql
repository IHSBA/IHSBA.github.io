-- IHSBA: multi-school league + season-scoped rosters
-- ------------------------------------------------------------------
-- Adds a public slug per team (for /schools/:slug routes) and a
-- player_seasons roster-membership table, so a season's roster can
-- differ from another season's without losing history. Run this in
-- the Supabase SQL editor after 0001 and 0002.
-- ------------------------------------------------------------------

-- ---- teams.slug --------------------------------------------------------
alter table teams add column if not exists slug text;
update teams set slug = 'fayston' where slug is null;
alter table teams alter column slug set not null;
create unique index if not exists teams_slug_idx on teams(slug);

-- ---- player_seasons: roster membership ---------------------------------
create table if not exists player_seasons (
  player_id uuid not null references players(id) on delete cascade,
  season text not null,
  primary key (player_id, season)
);
create index if not exists player_seasons_season_idx on player_seasons(season);

-- Backfill: enroll every existing player into every season their team
-- has actually played, reproducing today's "everyone shows in every
-- season" behavior exactly so nothing regresses for existing data.
insert into player_seasons (player_id, season)
select distinct p.id, g.season
from players p
join games g on g.team_id = p.team_id
on conflict do nothing;

alter table player_seasons enable row level security;
create policy "public read player_seasons" on player_seasons for select using (true);
create policy "admin write player_seasons" on player_seasons for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
