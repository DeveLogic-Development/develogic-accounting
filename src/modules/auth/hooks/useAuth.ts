import { useAuthContext } from '../state/AuthContext';

export function useAuth() {
  return useAuthContext();
}

