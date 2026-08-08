/*
 * data.js  --  THE DATA LAYER
 * ------------------------------------------------------------------
 * The ONLY module allowed to touch localStorage. Every UI page goes
 * through these functions, so the storage backend can later be swapped
 * for a real API/database (multi-school expansion) without touching UI.
 *
 * Public API (all synchronous against an in-memory cache):
 *   DB.ready(cb)              run cb once seed data is loaded
 *   DB.getSchools()          -> [school]
 *   DB.getSchool(id)         -> school | undefined
 *   DB.getActiveSchoolId()   -> id (currently selected school)
 *   DB.setActiveSchoolId(id)
 *   DB.getPlayers([schoolId])-> [player]
 *   DB.getPlayer(id)         -> player | undefined
 *   DB.savePlayer(player)    -> player (insert or update; assigns id)
 *   DB.deletePlayer(id)
 *   DB.getGames([schoolId])  -> [game]   (sorted newest first)
 *   DB.getGame(id)           -> game | undefined
 *   DB.saveGame(game, lines) -> game     (game + its batting lines)
 *   DB.deleteGame(id)
 *   DB.getBattingLines({gameId, playerId, schoolId}) -> [line]
 *   DB.resetToSeed()         wipe local changes, reload from seed.json
 *   DB.exportJSON()          -> string  (backup the whole store)
 */
const DB = (function () {
  const STORAGE_KEY = 'hsbb.store.v2';
  const ACTIVE_KEY = 'hsbb.activeSchool.v1';
  const SEED_URL = 'data/seed.json';

  let store = null;            // { schools, players, games, battingLines }
  const readyCallbacks = [];
  let isReady = false;

  // ---- low level persistence (the only localStorage usage) ----------
  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  function loadFromStorage() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Corrupt store, ignoring.', e);
      return null;
    }
  }

  // ---- bootstrap ----------------------------------------------------
  function init() {
    const existing = loadFromStorage();
    if (existing && existing.players) {
      store = existing;
      finishInit();
      return;
    }
    // First visit: seed from the bundled JSON (read-only defaults).
    fetch(SEED_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((seed) => {
        store = {
          schools: seed.schools || [],
          players: seed.players || [],
          games: seed.games || [],
          battingLines: seed.battingLines || [],
        };
        persist();
        finishInit();
      })
      .catch((err) => {
        // Fallback to an empty but valid store (e.g. opened via file://
        // where fetch may be blocked). Site still works, just empty.
        console.warn('Could not load seed.json, starting empty.', err);
        store = { schools: [], players: [], games: [], battingLines: [] };
        finishInit();
      });
  }

  function finishInit() {
    isReady = true;
    readyCallbacks.splice(0).forEach((cb) => cb());
  }

  function ready(cb) {
    if (isReady) cb();
    else readyCallbacks.push(cb);
  }

  // ---- id helper ----------------------------------------------------
  function uid(prefix) {
    return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ---- schools ------------------------------------------------------
  function getSchools() {
    return store.schools.slice();
  }
  function getSchool(id) {
    return store.schools.find((s) => s.id === id);
  }
  function getActiveSchoolId() {
    const saved = localStorage.getItem(ACTIVE_KEY);
    if (saved && getSchool(saved)) return saved;
    return store.schools[0] ? store.schools[0].id : null;
  }
  function setActiveSchoolId(id) {
    localStorage.setItem(ACTIVE_KEY, id);
  }

  // ---- players ------------------------------------------------------
  function getPlayers(schoolId) {
    const sid = schoolId || getActiveSchoolId();
    return store.players.filter((p) => !sid || p.schoolId === sid);
  }
  function getPlayer(id) {
    return store.players.find((p) => p.id === id);
  }
  function savePlayer(player) {
    if (player.id && getPlayer(player.id)) {
      const idx = store.players.findIndex((p) => p.id === player.id);
      store.players[idx] = Object.assign({}, store.players[idx], player);
      persist();
      return store.players[idx];
    }
    const rec = Object.assign(
      { id: uid('p'), schoolId: getActiveSchoolId(), nameEn: '', number: null, position: '', photo: '' },
      player
    );
    store.players.push(rec);
    persist();
    return rec;
  }
  function deletePlayer(id) {
    store.players = store.players.filter((p) => p.id !== id);
    store.battingLines = store.battingLines.filter((l) => l.playerId !== id);
    persist();
  }

  // ---- games --------------------------------------------------------
  function getGames(schoolId) {
    const sid = schoolId || getActiveSchoolId();
    return store.games
      .filter((g) => !sid || g.schoolId === sid)
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }
  function getGame(id) {
    return store.games.find((g) => g.id === id);
  }
  // Save a game plus the batting lines belonging to it. `lines` replaces
  // any existing lines for this game.
  function saveGame(game, lines) {
    let rec;
    if (game.id && getGame(game.id)) {
      const idx = store.games.findIndex((g) => g.id === game.id);
      store.games[idx] = Object.assign({}, store.games[idx], game);
      rec = store.games[idx];
    } else {
      rec = Object.assign({ id: uid('g'), schoolId: getActiveSchoolId() }, game);
      store.games.push(rec);
    }
    if (Array.isArray(lines)) {
      store.battingLines = store.battingLines.filter((l) => l.gameId !== rec.id);
      lines.forEach((l) => store.battingLines.push(Object.assign({}, l, { gameId: rec.id })));
    }
    persist();
    return rec;
  }
  function deleteGame(id) {
    store.games = store.games.filter((g) => g.id !== id);
    store.battingLines = store.battingLines.filter((l) => l.gameId !== id);
    persist();
  }

  // ---- batting lines ------------------------------------------------
  function getBattingLines(filter) {
    filter = filter || {};
    let lines = store.battingLines.slice();
    if (filter.gameId) lines = lines.filter((l) => l.gameId === filter.gameId);
    if (filter.playerId) lines = lines.filter((l) => l.playerId === filter.playerId);
    if (filter.schoolId) {
      const ids = new Set(getPlayers(filter.schoolId).map((p) => p.id));
      lines = lines.filter((l) => ids.has(l.playerId));
    }
    return lines;
  }

  // ---- maintenance --------------------------------------------------
  function resetToSeed() {
    localStorage.removeItem(STORAGE_KEY);
    isReady = false;
    init();
  }
  function exportJSON() {
    return JSON.stringify(store, null, 2);
  }

  init();

  return {
    ready,
    getSchools,
    getSchool,
    getActiveSchoolId,
    setActiveSchoolId,
    getPlayers,
    getPlayer,
    savePlayer,
    deletePlayer,
    getGames,
    getGame,
    saveGame,
    deleteGame,
    getBattingLines,
    resetToSeed,
    exportJSON,
  };
})();
