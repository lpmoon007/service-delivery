import Link from "next/link";
import { notFound } from "next/navigation";

import { DocumentView } from "@/components/DocumentView";
import { findDocument } from "@/lib/documents";
import { getEngagement } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string; docKey: string }>;
}) {
  const { id, docKey } = await params;
  if (!isSupabaseConfigured) notFound();

  const detail = await getEngagement(id);
  if (!detail) notFound();

  const doc = findDocument(detail.generated, docKey);
  if (!doc) notFound();

  return (
    <>
      <nav className="crumbs no-print">
        <Link href="/">Engagements</Link> / <Link href={`/engagements/${id}/work`}>Tasks</Link> /{" "}
        {doc.title}
      </nav>
      <DocumentView doc={doc} />
    </>
  );
}
