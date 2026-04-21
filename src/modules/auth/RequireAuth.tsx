import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Card } from '@/design-system/primitives/Card';
import { useAuth } from './hooks/useAuth';

export function RequireAuth() {
  const location = useLocation();
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <Card title="Loading account" subtitle="Checking your session..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

