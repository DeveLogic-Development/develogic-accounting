import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase/client';
import { syncSupabaseSession } from '@/lib/supabase/auth-session';

interface AuthResult {
  ok: boolean;
  error?: string;
}

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  configured: boolean;
  userEmail?: string;
  isAuthenticated: boolean;
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabaseClient();
  const configured = Boolean(supabase);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setSession(null);
      syncSupabaseSession(null);
      setLoading(false);
      return;
    }

    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const nextSession = data.session ?? null;
      setSession(nextSession);
      syncSupabaseSession(nextSession);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      syncSupabaseSession(nextSession);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [supabase]);

  const value: AuthContextValue = useMemo(
    () => ({
      session,
      loading,
      configured,
      userEmail: session?.user?.email,
      isAuthenticated: Boolean(session?.user?.id),
      signInWithPassword: async (email, password) => {
        if (!supabase) {
          return { ok: false, error: 'Supabase is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.' };
        }

        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail || !password.trim()) {
          return { ok: false, error: 'Email and password are required.' };
        }

        const result = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (result.error) {
          return { ok: false, error: result.error.message };
        }

        return { ok: true };
      },
      signOut: async () => {
        if (!supabase) return;
        await supabase.auth.signOut();
      },
    }),
    [configured, loading, session, supabase],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider.');
  }
  return context;
}

