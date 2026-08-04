/*
 * build-seed.js
 * ------------------------------------------------------------------
 * Parses every box-score CSV in /data into a single /data/seed.json
 * that the static site can load as read-only default data.
 *
 * Re-run whenever the CSVs change:
 *     node scripts/build-seed.js
 *
 * CSV layout (per file = one game):
 *   row 1: , <date> , ... [optional inning numbers 1..N]
 *   row 2: , <event/tournament name> , ... [optional: ,<ourTeam>,<inning runs...>]
 *   row 3: , <"A vs B" matchup> , ...        [optional: ,<oppTeam>,<inning runs...>]
 *   row 4: header spacer (안타 label)
 *   row 5: column headers (이름, 타수, ...)
 *   row 6+: one row per player
 *
 * Our team is always "Fayston".
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const OUR_TEAM = 'Fayston';

// --- Name corrections -------------------------------------------------
// Some CSV box scores use mistyped names. Map them to the canonical
// roster spelling. (Confirmed by the user + photo filenames.)
const NAME_FIX = {
  '조기환': '조시환',
  '정하람': '정하랑',
  '강준동': '김준동',   // same given name 준동
  '최순환': '권순환',   // same given name 순환
  '최민우': '최연우',   // same surname 최
  '황정원': '황시목',   // same surname 황
};

// --- Roster metadata (number, English name, photo) --------------------
// Keyed by canonical Korean name. Photos are the web-optimized JPGs in
// /img/players. Players without a photo fall back to an initials avatar.
const PLAYER_META = {
  '권영준': { number: 0,  nameEn: 'Youngjune Kwon', photo: 'img/players/youngjune-kwon.jpg' },
  '강태우': { number: 37, nameEn: 'Taewoo Kang',    photo: 'img/players/taewoo-kang.jpg' },
  '권순환': { number: 32, nameEn: 'Soonhwan Kwon',  photo: 'img/players/soonhwan-kwon.jpg' },
  '김준동': { number: 3,  nameEn: 'Jundong Kim',    photo: 'img/players/jundong-kim.jpg' },
  '박민서': { number: 20, nameEn: 'Minseo Park',    photo: '' },
  '박수현': { number: 17, nameEn: 'Suhyun Park',    photo: 'img/players/suhyun-park.jpg' },
  '변준서': { number: 36, nameEn: 'Junseo Byun',    photo: 'img/players/junseo-byun.jpg' },
  '신예준': { number: 47, nameEn: 'Yejun Shin',     photo: 'img/players/yejun-shin.jpg' },
  '오승원': { number: 5,  nameEn: 'Seungwon Oh',    photo: 'img/players/seungwon-oh.jpg' },
  '오준서': { number: 13, nameEn: 'Junseo Oh',      photo: 'img/players/junseo-oh.jpg' },
  '원용찬': { number: 18, nameEn: 'Yongchan Won',   photo: 'img/players/yongchan-won.jpg' },
  '정규민': { number: 7,  nameEn: 'Gyumin Jeong',   photo: 'img/players/gyumin-jeong.jpg' },
  '조시환': { number: 10, nameEn: 'Sihwan Cho',     photo: 'img/players/sihwan-cho.jpg' },
  '최연우': { number: null, nameEn: 'Yeonwoo Choi', photo: 'img/players/yeonwoo-choi.jpg' },
  '정하랑': { number: 24, nameEn: 'Harang Jeong',   photo: 'img/players/harang-jeong.jpg' },
  '황시목': { number: 1,  nameEn: 'Simok Hwang',    photo: '' },
  '이민준': { number: 2,  nameEn: 'Minjun Lee',     photo: 'img/players/minjun-lee.jpg' },
};

// --- Final scores (Fayston : opponent), provided by the user ----------
// Keyed by opponent name as parsed from the matchup row.
const GAME_SCORES = {
  'Nuol Miracle': { us: 5, them: 5 },
  'Vientiane': { us: 3, them: 10 },
  'Rock 16': { us: 3, them: 10 },
  'Osan Middle High School': { us: 12, them: 4 },
  'Kross': { us: 0, them: 7 },
  'Humphreys Blackhawks': { us: 2, them: 7 },
};

// Column index (after splitting the row on commas) -> stat key.
// Index 0 is the leading empty cell, index 1 is the player name.
const STAT_COLS = {
  2: 'AB',    // 타수  At Bats
  3: 'R',     // 득점  Runs
  4: 'H',     // 계    Hits (total)
  5: '2B',    // 2루타 Doubles
  6: '3B',    // 3루타 Triples
  7: 'HR',    // 홈런  Home Runs
  8: 'TB',    // 루타수 Total Bases (recorded; also derivable)
  9: 'RBI',   // 타점  Runs Batted In
  10: 'SB',   // 도루  Stolen Bases
  11: 'CS',   // 도루실패 Caught Stealing
  12: 'SAC',  // 희타  Sacrifice Hit (bunt)
  13: 'SF',   // 희비  Sacrifice Fly
  14: 'BB',   // 4구   Walks
  15: 'IBB',  // 고의4구 Intentional Walks
  16: 'HBP',  // 사구  Hit By Pitch
  17: 'SO',   // 삼진  Strikeouts
  18: 'GIDP', // 병살타 Grounded Into Double Play
  19: 'LOB',  // 잔루  Left On Base
};

// Simple CSV line splitter. The source files contain no quoted commas.
function splitLine(line) {
  return line.replace(/\r$/, '').split(',');
}

function toInt(v) {
  const n = parseInt((v || '').trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

// Normalise "2025/10/23" or "2026/4/18" -> "2026-04-18".
function normaliseDate(raw) {
  const m = (raw || '').trim().match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (!m) return (raw || '').trim();
  const [, y, mo, d] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

// From "Fayston vs Rock 16" or "Nuol Miracle vs Fayston" work out the
// opponent and whether Fayston batted as the listed home/away side.
function parseMatchup(raw) {
  const parts = (raw || '').split(/\s+vs\s+/i).map((s) => s.trim());
  if (parts.length !== 2) return { opponent: (raw || '').trim(), home: true };
  const [left, right] = parts;
  if (left.toLowerCase().includes('fayston')) {
    return { opponent: right, home: true };
  }
  return { opponent: left, home: false };
}

// Detect an inning-by-inning score block, if present.
// Returns { us:[...], them:[...] } or null.
function parseInnings(rows) {
  const header = rows[0]; // row with inning numbers
  // Inning numbers start at index 6 in the sample files.
  const looksLikeInnings = header.slice(6).some((c) => /^\d+$/.test((c || '').trim()));
  if (!looksLikeInnings) return null;

  const usRow = rows[1];   // event row also carries our team + runs
  const themRow = rows[2]; // matchup row also carries opp team + runs

  const usRuns = usRow.slice(6).map(toInt).filter((_, i) => (usRow.slice(6)[i] || '').trim() !== '');
  // Re-read cleanly: collect contiguous numeric inning cells.
  const collect = (row) => {
    const out = [];
    for (let i = 6; i < row.length; i++) {
      const cell = (row[i] || '').trim();
      if (cell === '') continue;
      if (/^\d+$/.test(cell)) out.push(toInt(cell));
    }
    return out;
  };

  return { us: collect(usRow), them: collect(themRow) };
}

function slugName(name) {
  // Keep it deterministic and ASCII-safe for ids.
  return 'p-' + Buffer.from(name, 'utf8').toString('hex');
}

function build() {
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.toLowerCase().endsWith('.csv'))
    .sort();

  const school = {
    id: 'fayston',
    name: 'Fayston',
    shortName: 'FAY',
    season: '2025-2026',
    logo: '', // add a path/emoji later via admin
    primaryColor: '#1f4e8c',
  };

  const playersByName = new Map();
  const games = [];
  const battingLines = [];

  files.forEach((file, idx) => {
    const text = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
    const rows = text.split('\n').filter((l) => l.trim() !== '').map(splitLine);
    if (rows.length < 6) return;

    const date = normaliseDate(rows[0][1]);
    const event = (rows[1][1] || '').trim();
    const { opponent, home } = parseMatchup(rows[2][1]);
    const innings = parseInnings(rows);

    let ourScore = null;
    let theirScore = null;
    let result = null; // 'W' | 'L' | 'T' | null(unknown)
    // Prefer an explicitly provided final score; otherwise sum innings.
    const provided = GAME_SCORES[opponent];
    if (provided) {
      ourScore = provided.us;
      theirScore = provided.them;
    } else if (innings) {
      ourScore = innings.us.reduce((a, b) => a + b, 0);
      theirScore = innings.them.reduce((a, b) => a + b, 0);
    }
    if (ourScore != null && theirScore != null) {
      result = ourScore > theirScore ? 'W' : ourScore < theirScore ? 'L' : 'T';
    }

    const gameId = `g-${date}-${idx}`;
    games.push({
      id: gameId,
      schoolId: school.id,
      date,
      event,
      opponent,
      home,
      location: '',
      ourScore,
      theirScore,
      result,
      innings: innings || null,
    });

    // Find the column-header row (starts with empty + 이름).
    const headerRowIndex = rows.findIndex((r) => (r[1] || '').trim() === '이름');
    const firstPlayerRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 5;

    for (let i = firstPlayerRow; i < rows.length; i++) {
      const row = rows[i];
      let name = (row[1] || '').trim();
      if (!name) continue;
      name = NAME_FIX[name] || name; // normalise mistyped names

      if (!playersByName.has(name)) {
        const meta = PLAYER_META[name] || {};
        playersByName.set(name, {
          id: slugName(name),
          schoolId: school.id,
          name,
          nameEn: meta.nameEn || '',
          number: meta.number != null ? meta.number : null,
          position: '',     // not present in source data; editable in admin
          photo: meta.photo || '',
        });
      }
      const player = playersByName.get(name);

      const line = { gameId, playerId: player.id };
      let hasAny = false;
      Object.entries(STAT_COLS).forEach(([col, key]) => {
        const v = toInt(row[col]);
        line[key] = v;
        if (v !== 0) hasAny = true;
      });
      // Keep zero-stat appearances too (player was on the roster that game),
      // but only if the player actually had a row.
      battingLines.push(line);
    }
  });

  // Stable ordering: players sorted by first appearance is already preserved
  // by Map insertion order.
  const players = Array.from(playersByName.values());

  const seed = {
    generatedAt: new Date().toISOString(),
    schools: [school],
    players,
    games,
    battingLines,
  };

  const outPath = path.join(DATA_DIR, 'seed.json');
  fs.writeFileSync(outPath, JSON.stringify(seed, null, 2), 'utf8');
  console.log(
    `Wrote ${outPath}\n  schools: 1\n  players: ${players.length}\n  games: ${games.length}\n  battingLines: ${battingLines.length}`
  );
}

build();
