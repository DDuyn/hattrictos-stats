/* @refresh reload */
import { render } from 'solid-js/web';
import { Route, Router } from '@solidjs/router';
import './index.css';
import { AuthProvider } from './context/auth.context';
import { ToastProvider } from './context/toast.context';
import Layout from './components/Layout';
import Home from './pages/home/Home';
import Profile from './pages/profile/Profile';
import ChppExplorer from './pages/chpp-explorer/ChppExplorer';
import TournamentsList from './pages/tournaments/TournamentsList';
import TournamentDetail from './pages/tournaments/TournamentDetail';
import TournamentStats from './pages/tournaments/TournamentStats';
import MatchDetailPage from './pages/tournaments/MatchDetail';
import AdminTournaments from './pages/admin-tournaments/AdminTournaments';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

render(
  () => (
    <ToastProvider>
      <AuthProvider>
        <Router root={Layout}>
          <Route path="/" component={Home} />
          <Route path="/profile" component={Profile} />
          <Route path="/chpp-explorer" component={ChppExplorer} />
          <Route path="/torneos" component={TournamentsList} />
          <Route path="/torneos/:id" component={TournamentDetail} />
          <Route path="/torneos/:id/estadisticas" component={TournamentStats} />
          <Route path="/torneos/:id/partidos/:matchId" component={MatchDetailPage} />
          <Route path="/admin/torneos" component={AdminTournaments} />
        </Router>
      </AuthProvider>
    </ToastProvider>
  ),
  root,
);
