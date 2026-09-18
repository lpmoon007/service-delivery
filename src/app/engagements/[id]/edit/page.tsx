import Link from "next/link";
import { notFound } from "next/navigation";

import { EngagementForm } from "@/components/EngagementForm";
import { currentProfile, getEngagement, listPrograms } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isSupabaseConfigured) notFound();

  const [detail, profile, programs] = await Promise.all([
    getEngagement(id),
    currentProfile(),
    listPrograms(),
  ]);
  if (!detail) notFound();

  // The database refuses the write regardless, but showing a form that cannot
  // save is worse than not showing it.
  if (profile?.role !== "owner") {
    return (
      <main>
        <nav className="crumbs">
          <Link href={`/engagements/${id}/work`}>Back to the task list</Link>
        </nav>
        <h1>Owner only</h1>
        <p className="band">
          Engagement details are edited by the owner. You can still update task status and record
          vendor details and costs on the task list.
        </p>
      </main>
    );
  }

  return (
    <main>
      <nav className="crumbs">
        <Link href="/">Engagements</Link> / <Link href={`/engagements/${id}`}>Coordination doc</Link>{" "}
        / <Link href={`/engagements/${id}/work`}>Tasks</Link>
      </nav>
      <h1>Edit {detail.row.client_name}</h1>
      <p className="sub">{detail.program.name}</p>
      <EngagementForm row={detail.row} program={detail.program} programs={programs} />
    </main>
  );
}
