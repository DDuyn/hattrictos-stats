/* @refresh reload */
import { render } from 'solid-js/web';
import { Route, Router } from '@solidjs/router';
import './index.css';
import { AuthProvider } from './context/auth.context';
import { ToastProvider } from './context/toast.context';
import Layout from './components/Layout';
import Home from './pages/home/Home';
import Profile from './pages/profile/Profile';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

render(
  () => (
    <ToastProvider>
      <AuthProvider>
        <Router root={Layout}>
          <Route path="/" component={Home} />
          <Route path="/profile" component={Profile} />
        </Router>
      </AuthProvider>
    </ToastProvider>
  ),
  root,
);
