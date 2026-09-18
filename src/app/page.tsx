import Link from "next/link";

import { listEngagements } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function Home() {
  const engagements = await listEngagements();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main>
      <h1>Service Delivery</h1>
      <p className="sub">
        Program templates that generate tasks, reverse timelines and the coordination doc.
      </p>

      {!isSupabaseConfigured && (
        <p className="band">
          Fixture-preview mode: no database configured, so these come from{" "}
          <code>src/fixtures/known-events.ts</code>, the regression fixtures the engine is
          tested against.
        </p>
      )}

      {isSupabaseConfigured && (
        <p>
          <Link className="cta" href="/engagements/new">
            Add a client
          </Link>
        </p>
      )}

      <h2>Engagements</h2>
      {engagements.length === 0 ? (
        <p className="band">
          Nothing here yet. Either no engagements exist, or none are assigned to you.
        </p>
      ) : (
        <ul className="cards">
          {engagements.map((e) => (
            <li key={e.id}>
              <Link href={`/engagements/${e.id}/work`}>{e.clientName}</Link>
              {isSupabaseConfigured && (
                <span className="links">
                  <Link href={`/engagements/${e.id}`}>coordination doc</Link>
                  {" · "}
                  <Link href={`/engagements/${e.id}/edit`}>edit</Link>
                </span>
              )}
              <p className="det">
                {e.programName} &middot; {e.deliveryDate}
                {e.deliveryDate < today && " (delivered)"}
                {e.overdueTasks !== null && e.overdueTasks > 0 && (
                  <> &middot; <strong>{e.overdueTasks} overdue</strong></>
                )}
                {e.openTasks !== null && <> &middot; {e.openTasks} open</>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
