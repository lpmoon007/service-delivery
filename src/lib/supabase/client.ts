"use client";

import { createBrowserClient } from "@supabase/ssr";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";
import type { Database } from "@/lib/db-types";

/**
 * Browser client. Carries the publishable key, which is public by design: what
 * this client may read or write is decided entirely by the row-level security
 * policies in supabase/migrations/0001_init.sql.
 */
export function createClient() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}
