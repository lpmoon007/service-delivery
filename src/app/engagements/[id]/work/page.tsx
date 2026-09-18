import Link from "next/link";
import { notFound } from "next/navigation";

import { CostEditor } from "@/components/CostEditor";
import { ResourceEditor } from "@/components/ResourceEditor";
import { StaffEditor } from "@/components/StaffEditor";
import { TaskTable } from "@/components/TaskTable";
import { currentProfile, getEngagement } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isSupabaseConfigured) notFound();

  const [detail, profile] = await Promise.all([getEngagement(id), currentProfile()]);
  if (!detail) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const open = detail.tasks.filter((t) => t.status !== "done" && t.status !== "na");
  const overdue = open.filter((t) => t.due_date < today);
  const isOwner = profile?.role === "owner";

  // Field lists come from the template, so the forms match the program rather
  // than whatever happened to be stored.
  const fieldsByKey = new Map(detail.program.resources.map((r) => [r.key, r.fields ?? []]));

  return (
    <main>
      <nav className="crumbs">
        <Link href="/">Engagements</Link> / <Link href={`/engagements/${id}`}>Coordination doc</Link>
        {isOwner && (
          <>
            {" / "}
            <Link href={`/engagements/${id}/edit`}>Edit</Link>
          </>
        )}
      </nav>

      <h1>{detail.row.client_name}</h1>
      <p className="sub">
        {detail.program.name} &middot; {detail.row.delivery_date} &middot; {detail.row.status}
      </p>

      <p className={overdue.length > 0 ? "warn" : "band"}>
        <strong>{open.length} open</strong>
        {overdue.length > 0 && <> &middot; <strong>{overdue.length} overdue</strong></>}
        {detail.row.notes && <> &middot; {detail.row.notes}</>}
      </p>

      {(detail.program.documents ?? []).length > 0 && (
        <>
          <h2>Documents</h2>
          <ul className="cards">
            {(detail.program.documents ?? []).map((d) => (
              <li key={d.key}>
                <Link href={`/engagements/${id}/documents/${d.key}`}>{d.title.replace("{{beneficiary_org}}", detail.row.client_name)}</Link>
                <p className="det">
                  {d.audience}
                  {d.purpose && <> &middot; {d.purpose}</>}
                </p>
              </li>
            ))}
            <li>
              <Link href={`/engagements/${id}`}>Logistics and coordination doc</Link>
              <p className="det">Internal. The crew, materials, run of show, tasks and costs.</p>
            </li>
          </ul>
        </>
      )}

      <h2>Tasks</h2>
      <TaskTable engagementId={id} tasks={detail.tasks} today={today} />

      <h2>Crew</h2>
      <p className="band">
        Who is working the day. These people do not need accounts; this is the list that appears on
        the coordination doc.
      </p>
      <StaffEditor engagementId={id} staff={detail.staff} />

      <h2>Resources</h2>
      <p className="band">
        Record what you booked: vendor, confirmation number, cost. The requirement beside each
        heading is computed from the program and the counts.
      </p>
      {detail.resources.length === 0 ? (
        <p className="band">No resource slots yet. Regenerate to create them.</p>
      ) : (
        detail.resources.map((r) => (
          <ResourceEditor
            key={r.id}
            engagementId={id}
            resource={r}
            fieldNames={fieldsByKey.get(r.resource_key) ?? Object.keys(r.fields ?? {})}
          />
        ))
      )}

      <h2>Costs</h2>
      <CostEditor engagementId={id} costs={detail.costs} />
    </main>
  );
}
