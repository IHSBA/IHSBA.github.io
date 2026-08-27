import { createContext, useContext, useEffect, useState } from 'react';
import { getTeams } from '../lib/api';

const STORAGE_KEY = 'ihsba_admin_team_id';
const AdminSchoolContext = createContext({ teamId: null, teams: [], setTeamId: () => {}, refresh: () => {} });

export function AdminSchoolProvider({ children }) {
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamIdState] = useState(() => localStorage.getItem(STORAGE_KEY));
  const [loading, setLoading] = useState(true);

  async function refresh(preferId) {
    const list = await getTeams();
    setTeams(list);
    const stillValid = list.some((t) => t.id === (preferId ?? teamId));
    const nextId = stillValid ? (preferId ?? teamId) : list[0]?.id || null;
    setTeamIdState(nextId);
    if (nextId) localStorage.setItem(STORAGE_KEY, nextId);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setTeamId(id) {
    setTeamIdState(id);
    if (id) localStorage.setItem(STORAGE_KEY, id);
  }

  return (
    <AdminSchoolContext.Provider value={{ teamId, teams, loading, setTeamId, refresh }}>
      {children}
    </AdminSchoolContext.Provider>
  );
}

export function useAdminSchool() {
  return useContext(AdminSchoolContext);
}
