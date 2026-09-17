import Link from "next/link";

import { KNOWN_ENGAGEMENTS } from "@/fixtures/registry";

export default function Home() {
  return (
    <main>
      <h1>Service Delivery</h1>
      <p className="sub">
        Program templates that generate tasks, reverse timelines and the coordination doc.
      </p>
      <p className="band">
        Pre-database preview. These two engagements come from{" "}
        <code>src/fixtures/known-events.ts</code> and are the regression fixtures the engine is
        tested against. Once Supabase is wired, this list comes from the database.
      </p>
      <h2>Engagements</h2>
      <ul className="cards">
        {KNOWN_ENGAGEMENTS.map((e) => (
          <li key={e.slug}>
            <Link href={`/engagements/${e.slug}`}>{e.params.client}</Link>
            <p className="det">
              {e.label} &middot; {e.params.beneficiaries} beneficiaries &middot;{" "}
              {e.params.participants} participants
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
