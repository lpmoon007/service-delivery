import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

/**
 * Magic-link landing. Exchanges a one-time credential for a session cookie.
 *
 * Supabase can arrive here three different ways depending on how the email
 * template is written and which auth flow the client used, so all three are
 * handled rather than assuming one:
 *
 *   1. ?token_hash=...&type=...  The template uses {{ .TokenHash }}. This is
 *      the shape Supabase documents for server-side rendering and the one to
 *      prefer, because the credential is a query parameter the server can read.
 *   2. ?code=...                 PKCE. Exchanged for a session.
 *   3. #access_token=...         The implicit flow, from the default
 *      {{ .ConfirmationURL }} template. A hash fragment is never sent to the
 *      server, so this cannot be handled here at all; the error page explains
 *      what to change instead of showing a blank failure.
 *
 * `next` is validated as a same-origin relative path. An open redirect here
 * would let a crafted sign-in link land an authenticated user on any host.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const raw = url.searchParams.get("next") ?? "/";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";

  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) {
      return NextResponse.redirect(
        new URL(`/auth/error?reason=invalid&detail=${encodeURIComponent(error.message)}`, url.origin),
      );
    }
    return NextResponse.redirect(new URL(next, url.origin));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`/auth/error?reason=invalid&detail=${encodeURIComponent(error.message)}`, url.origin),
      );
    }
    return NextResponse.redirect(new URL(next, url.origin));
  }

  return NextResponse.redirect(new URL("/auth/error?reason=missing", url.origin));
}
