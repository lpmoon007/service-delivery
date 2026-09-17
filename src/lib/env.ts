/**
 * Environment access with useful failures.
 *
 * The app is deliberately runnable with no Supabase configured: the fixture
 * pages render from the JSON template alone. `isSupabaseConfigured` is what
 * decides whether a page reads the database or the fixtures, so a missing key
 * degrades to the preview rather than crashing the build.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

/** For server-only code paths that genuinely cannot proceed without config. */
export function requireSupabaseConfig(): { url: string; key: string } {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local (see .env.example).",
    );
  }
  return { url: SUPABASE_URL, key: SUPABASE_PUBLISHABLE_KEY };
}

/**
 * The secret key bypasses row-level security. It is read lazily and only by
 * server code, and it must never be imported into a client component.
 */
export function requireSecretKey(): string {
  const k = process.env.SUPABASE_SECRET_KEY;
  if (!k) {
    throw new Error(
      "SUPABASE_SECRET_KEY is not set. It is server-only and belongs in Vercel's " +
        "environment variables or .env.local, never in a commit.",
    );
  }
  return k;
}

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
