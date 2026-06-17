import { useEffect, useState } from "react";
import { supabase, isAuthRequired } from "../lib/supabase.js";

/**
 * Reactively tracks auth state.
 *   { user, loading, isRequired }
 *
 * In local dev (no Supabase env vars), user is a stub object so the rest of
 * the app can render. In prod, user starts as null and only resolves when the
 * Supabase SDK rehydrates the session from localStorage.
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(isAuthRequired());

  useEffect(() => {
    if (!isAuthRequired()) {
      setUser({ id: "local-dev", email: "dev@local", isAnonymous: true });
      setLoading(false);
      return;
    }
    let unsub = null;
    supabase.auth.getSession().then(({ data }) => {
      setUser(data?.session?.user || null);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    unsub = data?.subscription;
    return () => { try { unsub?.unsubscribe(); } catch {} };
  }, []);

  return { user, loading, isRequired: isAuthRequired() };
}
