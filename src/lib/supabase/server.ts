import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { requireSupabaseConfig } from "@/lib/env";
import type { Database } from "@/lib/db-types";

/**
 * Server client for server components, route handlers and server actions.
 * Reads the caller's session from cookies, so every query runs as that user
 * and row-level security applies. This never uses the secret key.
 */
export async function createClient() {
  const { url, key } = requireSupabaseConfig();
  const store = await cookies();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(toSet) {
        try {
          for (const { name, value, options } of toSet) {
            store.set(name, value, options);
          }
        } catch {
          // Called from a server component, where cookies are read-only.
          // Middleware refreshes the session instead, so this is safe to ignore.
        }
      },
    },
  });
}
