"use client";

import { useState, useTransition } from "react";

import type { ActionResult } from "@/lib/actions";

/**
 * Wraps a server action so a failure is visible instead of silent.
 *
 * Row-level security returns "no rows updated" rather than an error when it
 * refuses a write, so an unreported failure would look exactly like success.
 * Every write in this app reports through here.
 */
export function useAction() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  function run(fn: () => Promise<ActionResult>) {
    setResult(null);
    start(async () => setResult(await fn()));
  }

  return { pending, result, run };
}

export function Feedback({ result, pending }: { result: ActionResult | null; pending: boolean }) {
  if (pending) return <p className="det">Saving…</p>;
  if (!result) return null;
  return result.ok ? (
    <p className="ok">{result.message ?? "Saved."}</p>
  ) : (
    <p className="warn">{result.message ?? "Could not save."}</p>
  );
}
