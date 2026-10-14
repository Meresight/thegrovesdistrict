import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let pub: SupabaseClient | null | undefined;

/**
 * Anon-key client for public, RLS-protected reads (e.g. published events).
 * Fetches are cached for 5 minutes via Next's data cache.
 */
export function getPublicClient(): SupabaseClient | null {
  if (pub !== undefined) return pub;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  pub =
    url && key
      ? createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => fetch(input, { ...init, next: { revalidate: 300 } }),
          },
        })
      : null;
  return pub;
}
