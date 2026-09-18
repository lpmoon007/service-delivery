import Link from "next/link";
import { notFound } from "next/navigation";

import { NewEngagementForm } from "@/components/NewEngagementForm";
import { currentProfile, listPrograms } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function NewEngagementPage() {
  if (!isSupabaseConfigured) notFound();

  const [profile, programs] = await Promise.all([currentProfile(), listPrograms()]);

  if (profile?.role !== "owner") {
    return (
      <main>
        <nav className="crumbs">
          <Link href="/">Engagements</Link>
        </nav>
        <h1>Owner only</h1>
        <p className="band">New clients are added by the owner.</p>
      </main>
    );
  }

  return (
    <main>
      <nav className="crumbs">
        <Link href="/">Engagements</Link> / New
      </nav>
      <h1>Add a client</h1>
      <p className="sub">
        Pick the service and the date. Every task, quantity and resource requirement is generated
        from there.
      </p>
      <NewEngagementForm programs={programs} />
    </main>
  );
}
