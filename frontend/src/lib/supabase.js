/**
 * Supabase client + auth helpers.
 *
 * When VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are NOT set (local dev),
 * `supabase` is null and `isAuthRequired()` returns false — the rest of the
 * app falls through to anonymous mode without complaining.
 *
 * In production (Vercel env vars set), `supabase` is a real client and the
 * app gates everything behind a login screen.
 */
import { createClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase =
  URL && KEY
    ? createClient(URL, KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

export function isAuthRequired() {
  return !!supabase;
}

/** Authed fetch — wraps fetch() and adds Authorization: Bearer <jwt> when available. */
export async function authedFetch(input, init = {}) {
  const headers = new Headers(init.headers || {});
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}

export async function signInWithGoogle() {
  if (!supabase) return;
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
}

export async function signInWithEmail(email) {
  if (!supabase) return { error: "Supabase not configured" };
  return supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}
