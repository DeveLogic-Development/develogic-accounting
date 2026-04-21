import { useEffect, useRef } from 'react';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { hydrateBusinessSettingsForSession } from '../services/business-settings';

export function BusinessSettingsBootstrapper() {
  const { isAuthenticated, loading, userEmail } = useAuth();
  const lastHydratedUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      lastHydratedUserRef.current = null;
      return;
    }

    const userKey = userEmail ?? '__authenticated_user__';
    if (lastHydratedUserRef.current === userKey) return;
    lastHydratedUserRef.current = userKey;

    void hydrateBusinessSettingsForSession();
  }, [isAuthenticated, loading, userEmail]);

  return null;
}
