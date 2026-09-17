import { notFound } from "next/navigation";

import { CoordinationDoc } from "@/components/CoordinationDoc";
import { currentProfile, getEngagement } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/env";
import { findEngagement, generated } from "@/fixtures/registry";

export const dynamic = "force-dynamic";

export default async function EngagementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isSupabaseConfigured) {
    const fixture = findEngagement(id);
    if (!fixture) notFound();
    return (
      <CoordinationDoc
        engagement={generated(fixture)}
        resourceValues={fixture.resourceValues}
        costs={fixture.costs}
        audience="contractor"
      />
    );
  }

  const [detail, profile] = await Promise.all([getEngagement(id), currentProfile()]);
  // getEngagement returns null both for "no such engagement" and "not yours".
  // Keeping them indistinguishable is deliberate.
  if (!detail) notFound();

  const costs: Record<string, { amount?: number; note?: string }> = {};
  for (const c of detail.costs) {
    costs[c.line_key] = {
      amount: c.amount ?? undefined,
      note: c.note ?? undefined,
    };
  }

  return (
    <CoordinationDoc
      engagement={detail.generated}
      resourceValues={detail.resourceValues}
      costs={costs}
      audience={profile?.role === "owner" ? "owner" : "contractor"}
    />
  );
}
