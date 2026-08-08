# IHSBA — International High School Baseball Analytics

KBO/Statiz-style team and player baseball stats. React + Vite front end,
Supabase (Postgres + Auth + Storage) backend. Scope today is one school
(Fayston); the data model already has a `teams` entity so more schools
can join later without a redesign.

## Stack

- **Front end**: React (JavaScript) + Vite, `react-router-dom` (`HashRouter` —
  see note below), no other framework.
- **Backend**: Supabase. Postgres for data, Supabase Auth for the single
  admin login, Supabase Storage for player photos.
- **Access model**: public read-only on all tables via RLS; only an
  authenticated user (the one admin) can write. See
  `supabase/migrations/0001_init.sql`.
- **Deploy target**: static Vite build on GitHub Pages.

## Project layout

```
src/
  lib/            Supabase client + all reads/writes (api.js)
  stats/          pure stat math: stats.js (AVG/OBP/SLG/OPS, Div. rows),
                   advancedStats.js (wOBA/wRC+/WAR, reads data/league-constants.json)
  components/     shared UI: Nav, Footer, Avatar, StatsTable, Podium, ...
  hooks/          scroll-reveal / count-up / tilt animation hooks
  context/        Supabase Auth session context
  pages/          Home, Players, PlayerDetail, Games, GameDetail, Leaderboards, Login
  pages/admin/    protected CRUD: AdminHome, AdminTeam, AdminPlayers, AdminGames, AdminStats
supabase/migrations/0001_init.sql   schema + RLS + storage bucket policies
data/league-constants.json          league/park constants for advanced stats (placeholders)
data/seed.json, data/*.csv          legacy per-game data (source for the seed script)
scripts/seed-supabase.js            one-time import of data/seed.json into Supabase
legacy-static/                      the old static HTML/CSS/JS site, kept for reference only
public/img/players/*.jpg            player photos served as static assets
```

## Local development

```bash
npm install
cp .env.example .env   # fill in your Supabase project's URL + publishable key
npm run dev
```

## Supabase setup

1. Create a Supabase project.
2. In the SQL editor, run `supabase/migrations/0001_init.sql`. It creates
   `teams`, `players`, `player_season_stats`, `games`, enables RLS with
   public-read / authenticated-write policies on each, and creates the
   `player-photos` Storage bucket (public read, authenticated write).
3. Create the one admin user manually: Authentication → Users → Add user
   (email + password). There is no public sign-up in the app.
4. Project Settings → API: copy the **Project URL** and the
   **publishable key** (`sb_publishable_...`) into `.env` as
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The
   publishable key is safe to ship to the browser — the real protection
   is the RLS policies from step 2, not this key.
5. **Never** put the **secret key** (`sb_secret_...`) in `.env` as a
   `VITE_`-prefixed variable or anywhere in front-end code — that would
   ship it to every visitor's browser.

## Importing existing data

`data/seed.json` holds the roster/schedule from the old static site.
To load it into a fresh Supabase project:

1. In `.env`, set `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API →
   **secret key**, `sb_secret_...`; called `service_role` on older
   projects). This is **local-only** — never prefix it with
   `VITE_`, never commit it. It bypasses RLS, which is what a bulk
   import needs and what the browser client must never have.
2. Run:
   ```bash
   npm run seed
   ```
   It's safe to re-run — it upserts on natural keys (team name+season,
   player name, game date+opponent) instead of duplicating rows.

## Admin usage

Sign in at `/#/login` (or click **Data Entry** in the nav) with the
admin account created in Supabase Auth. From `/#/admin` you can manage
the team's name/season/logo, players (including photo upload), games,
and per-player per-season raw stats. Enter raw counting stats only —
`TB`/`PA`/`ePA` and every AVG/OBP/SLG/OPS/wOBA/wRC+/WAR number are
computed automatically (`src/stats/stats.js`, `src/stats/advancedStats.js`)
and shown formatted (`.312`, `-` for divide-by-zero) everywhere in the UI.

Advanced stats (`wOBA`, `wRC+`, `oWAR`, `WAR`, `R/ePA`) depend on league
constants in `data/league-constants.json`, which currently holds
placeholder values (documented per-key in that file). Swap in real
league totals there when available — no code changes needed. `dWAR`
has no fielding data source yet, so it (and full `WAR`) renders `-`
until one exists.

## Build & deploy (GitHub Pages)

```bash
npm run build     # outputs to dist/
npm run deploy    # builds, then publishes dist/ to the gh-pages branch
```

`npm run deploy` uses the `gh-pages` package. After the first deploy,
make sure the repo's Settings → Pages → Source is set to the
`gh-pages` branch (root).

The app uses `HashRouter` (routes look like `/#/players/1`) instead of
`BrowserRouter`, because GitHub Pages is a static host with no
server-side rewrite rule — a hard refresh on a real path like
`/players/1` would 404 without one. Hash routes always resolve to
`index.html`.

## Known scope simplifications

- The old game-detail page showed a per-game player box score. The
  spec's `games` table only stores one row per game (final score +
  result), with no per-player per-game line table, so `GameDetail` now
  shows game metadata only. Per-season stats still live in
  `player_season_stats`.
- `dWAR` is always `null` (renders `-`) — there's no fielding data
  source (putouts/assists/errors) to compute it honestly from.
