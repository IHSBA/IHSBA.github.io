import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Guards /admin routes. Redirects unauthenticated visitors to /login.
// This is UX only -- Supabase RLS is what actually enforces write access.
export default function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="container section">Loading…</div>;
  if (!session) return <Navigate to="/login" replace />;
  return children;
}
