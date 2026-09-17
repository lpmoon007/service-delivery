import { notFound } from "next/navigation";

import { CoordinationDoc } from "@/components/CoordinationDoc";
import { KNOWN_ENGAGEMENTS, findEngagement, generated } from "@/fixtures/registry";

export function generateStaticParams() {
  return KNOWN_ENGAGEMENTS.map((e) => ({ id: e.slug }));
}

export default async function EngagementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const engagement = findEngagement(id);
  if (!engagement) notFound();

  return (
    <CoordinationDoc
      engagement={generated(engagement)}
      resourceValues={engagement.resourceValues}
      costs={engagement.costs}
      audience="contractor"
    />
  );
}
