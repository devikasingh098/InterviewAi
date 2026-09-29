/** Public, client-safe configuration (VITE_* vars are exposed to the browser). */

export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export function requireEnv(): { url: string; anonKey: string } {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "This app needs Supabase to be configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the project Environment settings, then reload.",
    );
  }
  return { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY };
}