/* @refresh reload */
import { render } from 'solid-js/web';
import { Route, Router } from '@solidjs/router';
import './index.css';
import { AuthProvider } from './context/auth.context';
import { ToastProvider } from './context/toast.context';
import Layout from './components/Layout';
import Home from './pages/home/Home';
import Login from './pages/login/Login';
import Profile from './pages/profile/Profile';
import Items from './pages/items/Items';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

render(
  () => (
    <ToastProvider>
      <AuthProvider>
        <Router root={Layout}>
          <Route path="/" component={Home} />
          <Route path="/login" component={Login} />
          <Route path="/profile" component={Profile} />
          <Route path="/items" component={Items} />
        </Router>
      </AuthProvider>
    </ToastProvider>
  ),
  root,
);
