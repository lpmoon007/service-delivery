"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { SITE_URL } from "@/lib/env";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string };

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ kind: "sending" });
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${SITE_URL}/auth/confirm`,
        // Contractors are created by the owner first. Self-signup would let
        // anyone with the publishable key mint an account.
        shouldCreateUser: false,
      },
    });
    // Deliberately generic: a distinct "no such user" message would turn this
    // form into a way to test whether an address is a Be Legendary contractor.
    setState(error ? { kind: "error", message: "Could not send the link. Check the address and try again." } : { kind: "sent" });
  }

  if (state.kind === "sent") {
    return (
      <p className="band">
        Check <strong>{email}</strong> for a sign-in link. It expires in an hour. If nothing
        arrives, your address may not be set up yet: ask James to add you.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="stack">
      <label htmlFor="email">Email address</label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
      />
      <button type="submit" disabled={state.kind === "sending"}>
        {state.kind === "sending" ? "Sending..." : "Email me a sign-in link"}
      </button>
      {state.kind === "error" && <p className="warn">{state.message}</p>}
    </form>
  );
}
