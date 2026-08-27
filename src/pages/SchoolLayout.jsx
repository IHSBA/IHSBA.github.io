import { useEffect, useState } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { getTeamBySlug } from '../lib/api';
import Empty from '../components/Empty';

// Resolves :slug once for the whole /schools/:slug/* subtree and hands
// the team down via useOutletContext(), so Home/Players/Games/
// Leaderboards don't each duplicate the same fetch + loading state.
export default function SchoolLayout() {
  const { slug } = useParams();
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let cancelled = false;
    getTeamBySlug(slug)
      .then((team) => !cancelled && setState({ loading: false, team }))
      .catch((err) => !cancelled && setState({ loading: false, error: err.message }));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (state.loading) return <div className="container section">Loading…</div>;
  if (state.error || !state.team) {
    return (
      <div className="container section">
        <Empty message="School not found." cta={{ to: '/', label: 'All Schools' }} />
      </div>
    );
  }

  return <Outlet context={{ team: state.team }} />;
}
