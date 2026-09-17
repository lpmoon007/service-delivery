export default async function AuthError({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const message =
    reason === "missing"
      ? "That link was incomplete."
      : "That link has expired or was already used.";
  return (
    <main>
      <h1>Sign-in link problem</h1>
      <p className="warn">{message} Sign-in links are single use and last an hour.</p>
      <p>
        <a href="/login">Request a new one</a>
      </p>
    </main>
  );
}
