import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Card } from '@/design-system/primitives/Card';
import { Input } from '@/design-system/primitives/Input';
import { Button } from '@/design-system/primitives/Button';
import { InlineNotice } from '@/design-system/patterns/InlineNotice';
import { useAuth } from './hooks/useAuth';

interface LocationState {
  from?: {
    pathname?: string;
  };
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, loading, configured, signInWithPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const destination = useMemo(() => {
    const state = location.state as LocationState | null;
    return state?.from?.pathname || '/dashboard';
  }, [location.state]);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate(destination, { replace: true });
    }
  }, [destination, isAuthenticated, loading, navigate]);

  if (isAuthenticated) {
    return <Navigate to={destination} replace />;
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await signInWithPassword(email, password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? 'Unable to sign in.');
    }
  };

  return (
    <div
      className="dl-login-screen"
    >
      <Card
        title="Sign In"
        subtitle="Super Accounting"
        className="dl-auth-card"
      >
        {!configured ? (
          <InlineNotice tone="error">
            Supabase is not configured. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your env, then restart.
          </InlineNotice>
        ) : null}
        {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <Button type="submit" variant="primary" disabled={!configured || submitting}>
            {submitting ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
