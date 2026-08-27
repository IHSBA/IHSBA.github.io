import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getDistinctSeasons } from '../lib/api';

// Selected season lives in the `?season=` URL param (shareable,
// back-button friendly) and defaults to the team's current season.
// Each page that calls this manages its own season independently --
// switching season on Players doesn't affect Games or Leaderboards.
export function useSeason(team) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [seasons, setSeasons] = useState([]);
  const urlSeason = searchParams.get('season');
  const season = urlSeason || team?.season || null;

  useEffect(() => {
    if (!team) return;
    let cancelled = false;
    getDistinctSeasons(team.id, team.season).then((list) => {
      if (!cancelled) setSeasons(list);
    });
    return () => {
      cancelled = true;
    };
  }, [team]);

  function setSeason(next) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (next && next !== team?.season) params.set('season', next);
      else params.delete('season');
      return params;
    });
  }

  return { season, seasons, setSeason };
}
