import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/players', label: 'Players' },
  { to: '/games', label: 'Games' },
  { to: '/leaderboards', label: 'Leaderboards' },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const { session } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate('/');
  }

  return (
    <header className={`site-header${open ? ' nav-open' : ''}`}>
      <div className="nav-inner container">
        <a href="/" className="brand">
          <span className="brand-text">
            <strong>IHSBA</strong>
            <small>International High School Baseball Analytics</small>
          </span>
        </a>
        <nav className="nav-links" id="navLinks">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} onClick={() => setOpen(false)}>
              {l.label}
            </NavLink>
          ))}
          {session ? (
            <NavLink to="/admin">Admin</NavLink>
          ) : (
            <NavLink to="/admin">Data Entry</NavLink>
          )}
        </nav>
        <div className="nav-right">
          {session && (
            <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>
              Sign Out
            </button>
          )}
          <button
            className="nav-toggle"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <span /><span /><span />
          </button>
        </div>
      </div>
    </header>
  );
}
