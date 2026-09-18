import type { RenderedDocument } from "@/lib/documents";

/**
 * A generated letter, laid out to be printed or pasted into an email.
 *
 * Unfilled tokens are listed at the top rather than hidden, because the point
 * of generating this is that it cannot quietly carry last event's details.
 */
export function DocumentView({ doc }: { doc: RenderedDocument }) {
  return (
    <article className="doc letter">
      <header>
        <h1>{doc.title}</h1>
        <p className="sub">
          {doc.audience}
          {doc.purpose && <> &middot; {doc.purpose}</>}
        </p>
      </header>

      {doc.missing.length > 0 && (
        <p className="warn no-print">
          <strong>Not ready to send.</strong> {doc.missing.length}{" "}
          {doc.missing.length === 1 ? "field is" : "fields are"} still blank:{" "}
          {doc.missing.join(", ")}. Fill them in on the edit page.
        </p>
      )}

      {doc.greeting && <p className="greeting">{doc.greeting}</p>}

      {doc.sections.map((s, i) => (
        <section key={s.heading ?? `s${i}`}>
          {s.heading && <h2>{s.heading}</h2>}
          {s.body.map((b, j) => (
            <p key={j}>{b}</p>
          ))}
          {s.bullets.length > 0 &&
            (s.ordered ? (
              <ol>
                {s.bullets.map((b, j) => (
                  <li key={j}>{b}</li>
                ))}
              </ol>
            ) : (
              <ul>
                {s.bullets.map((b, j) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
            ))}
        </section>
      ))}

      {doc.signoff.length > 0 && (
        <p className="signoff">
          {doc.signoff.map((line, i) => (
            <span key={i}>
              {line}
              <br />
            </span>
          ))}
        </p>
      )}
    </article>
  );
}
