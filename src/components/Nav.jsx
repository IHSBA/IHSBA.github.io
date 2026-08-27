import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

export default function Nav() {
  const [open, setOpen] = useState(false);
  const { session } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Nav sits outside <Routes>, so useParams() can't see :slug here --
  // read it straight off the URL instead.
  const slug = pathname.match(/^\/schools\/([^/]+)/)?.[1];

  const links = slug
    ? [
        { to: `/schools/${slug}`, label: 'Home', end: true },
        { to: `/schools/${slug}/players`, label: 'Players' },
        { to: `/schools/${slug}/games`, label: 'Games' },
        { to: `/schools/${slug}/leaderboards`, label: 'Leaderboards' },
        { to: '/', label: 'All Schools' },
      ]
    : [];

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
          {links.map((l) => (
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
