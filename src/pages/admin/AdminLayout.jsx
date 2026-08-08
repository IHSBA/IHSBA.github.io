import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/team', label: 'Team' },
  { to: '/admin/players', label: 'Players' },
  { to: '/admin/games', label: 'Games' },
  { to: '/admin/stats', label: 'Season Stats' },
];

export default function AdminLayout({ title, children }) {
  return (
    <div className="container section">
      <div className="section-head">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>{title}</h1>
        </div>
      </div>
      <div className="segmented" style={{ marginBottom: '1.4rem' }}>
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) => (isActive ? 'active' : '')}
            style={{ display: 'inline-block' }}
          >
            {t.label}
          </NavLink>
        ))}
      </div>
      {children}
    </div>
  );
}
