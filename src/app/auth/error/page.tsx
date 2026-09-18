export default async function AuthError({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; detail?: string }>;
}) {
  const { reason, detail } = await searchParams;

  return (
    <main>
      <h1>Sign-in link problem</h1>

      {reason === "missing" ? (
        <>
          <p className="warn">
            That link did not carry a sign-in credential this app can read.
          </p>
          <p className="band">
            This usually means the Supabase magic-link email template still uses the default{" "}
            <code>{"{{ .ConfirmationURL }}"}</code>, which returns the token in the URL hash. A
            hash fragment is never sent to the server, so a server-rendered app cannot see it. The
            template needs to point at <code>/auth/confirm</code> with{" "}
            <code>{"{{ .TokenHash }}"}</code> instead.
          </p>
        </>
      ) : (
        <p className="warn">
          That link has expired or was already used. Sign-in links last one hour and work once.
          {detail && (
            <>
              <br />
              <span className="det">{detail}</span>
            </>
          )}
        </p>
      )}

      <p>
        <a href="/login">Request a new link</a>
      </p>
    </main>
  );
}
