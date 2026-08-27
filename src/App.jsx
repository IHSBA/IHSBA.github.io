import { Routes, Route, Outlet } from 'react-router-dom';
import Nav from './components/Nav';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import { AdminSchoolProvider } from './context/AdminSchoolContext';
import LeagueHome from './pages/LeagueHome';
import SchoolLayout from './pages/SchoolLayout';
import Home from './pages/Home';
import Players from './pages/Players';
import PlayerDetail from './pages/PlayerDetail';
import Games from './pages/Games';
import GameDetail from './pages/GameDetail';
import Leaderboards from './pages/Leaderboards';
import Login from './pages/Login';
import AdminHome from './pages/admin/AdminHome';
import AdminSeason from './pages/admin/AdminSeason';
import AdminPlayers from './pages/admin/AdminPlayers';
import AdminGames from './pages/admin/AdminGames';
import AdminTeam from './pages/admin/AdminTeam';

export default function App() {
  return (
    <>
      <Nav />
      <main id="main">
        <Routes>
          <Route path="/" element={<LeagueHome />} />
          <Route path="/schools/:slug" element={<SchoolLayout />}>
            <Route index element={<Home />} />
            <Route path="players" element={<Players />} />
            <Route path="players/:id" element={<PlayerDetail />} />
            <Route path="games" element={<Games />} />
            <Route path="games/:id" element={<GameDetail />} />
            <Route path="leaderboards" element={<Leaderboards />} />
          </Route>
          <Route path="/login" element={<Login />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminSchoolProvider>
                  <Outlet />
                </AdminSchoolProvider>
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminHome />} />
            <Route path="season" element={<AdminSeason />} />
            <Route path="team" element={<AdminTeam />} />
            <Route path="players" element={<AdminPlayers />} />
            <Route path="games" element={<AdminGames />} />
          </Route>
        </Routes>
      </main>
      <Footer />
    </>
  );
}
