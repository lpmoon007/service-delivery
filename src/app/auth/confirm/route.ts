import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

/**
 * Magic-link landing. Exchanges the one-time token for a session cookie.
 *
 * `next` is validated as a same-origin relative path: an open redirect here
 * would let a crafted sign-in link drop an authenticated user on a host of the
 * attacker's choosing.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const raw = url.searchParams.get("next") ?? "/";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";

  if (!token_hash || !type) {
    return NextResponse.redirect(new URL("/auth/error?reason=missing", url.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    return NextResponse.redirect(new URL("/auth/error?reason=invalid", url.origin));
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
