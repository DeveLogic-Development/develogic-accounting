import { AppRouter } from '@/routes/AppRouter';
import { AuthProvider } from '@/modules/auth/state/AuthContext';

export function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
