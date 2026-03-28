import { useAuth } from '../../context/auth.context';

export function createProfileCtrl() {
  const auth = useAuth();
  return { user: auth.user, loading: auth.loading };
}
