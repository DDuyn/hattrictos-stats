import { createContext, useContext, createSignal, type ParentProps } from 'solid-js';
import { fetchMe, type UserProfile } from '../domain/auth/auth.service';
import { isAuthenticated } from '../lib/api-client';

interface AuthContextValue {
  user: () => UserProfile | null;
  loading: () => boolean;
  loadUser: () => Promise<void>;
  clearUser: () => void;
}

const AuthContext = createContext<AuthContextValue>();

export function AuthProvider(props: ParentProps) {
  const [user, setUser] = createSignal<UserProfile | null>(null);
  const [loading, setLoading] = createSignal(false);

  async function loadUser() {
    if (!isAuthenticated()) return;
    setLoading(true);
    const result = await fetchMe();
    setLoading(false);
    if (result.ok) {
      setUser(result.value);
    } else {
      setUser(null);
    }
  }

  function clearUser() {
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, loadUser, clearUser }}>
      {props.children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
