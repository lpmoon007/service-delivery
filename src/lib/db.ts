/**
 * Database reads for the delivery app.
 *
 * Every query here runs as the signed-in user, so row-level security decides
 * what comes back. A contractor asking for an engagement they are not assigned
 * to gets no rows rather than an error, which is why "not found" and "not
 * permitted" are deliberately the same outcome: the app must not reveal that a
 * record exists.
 *
 * When Supabase is not configured these fall back to the JSON fixtures so the
 * app is runnable without a database.
 */

import {
  derivedResourceValues,
  generateEngagement,
  type GeneratedEngagement,
} from "./generate";
import { isSupabaseConfigured } from "./env";
import { createClient } from "./supabase/server";
import type {
  EngagementCostRow,
  EngagementResourceRow,
  EngagementRow,
  EngagementStaffRow,
  EngagementTaskRow,
  ProgramRow,
} from "./db-types";
import type { EngagementParams, Program } from "./types";

export interface EngagementSummary {
  id: string;
  clientName: string;
  programName: string;
  deliveryDate: string;
  status: string;
  /** Null when the caller cannot see task rows, which RLS may withhold. */
  openTasks: number | null;
  overdueTasks: number | null;
}

export interface EngagementDetail {
  row: EngagementRow;
  program: Program;
  generated: GeneratedEngagement;
  tasks: EngagementTaskRow[];
  resources: EngagementResourceRow[];
  costs: EngagementCostRow[];
  staff: EngagementStaffRow[];
  /** Values keyed "resourceKey.fieldName", flattened for the doc component. */
  resourceValues: Record<string, string>;
}

export interface ProgramChoice {
  id: string;
  code: string;
  name: string;
  summary: string | null;
  /** Declared parameters, so the new-engagement form builds itself. */
  parameters: Program["parameters"];
}

/** The program catalog, for the service picker. */
export async function listPrograms(): Promise<ProgramChoice[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("programs")
    .select("id, code, name, summary, definition")
    .eq("active", true)
    .order("name", { ascending: true });
  if (error) throw new Error(`listPrograms: ${error.message}`);

  return (data ?? []).map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    summary: r.summary,
    parameters: (r.definition as unknown as Program).parameters ?? [],
  }));
}

function asProgram(row: ProgramRow): Program {
  const d = row.definition;
  if (!d || typeof d !== "object") {
    throw new Error(`program ${row.code} has a malformed definition`);
  }
  return d as Program;
}

/**
 * Merge the stored params with the row's own columns. The columns are the
 * source of truth for client name and venue; params holds the template inputs.
 */
function toParams(row: EngagementRow, program: Program): EngagementParams {
  return {
    ...(row.params as EngagementParams),
    client: row.client_name,
    program: program.code,
    venue_name: row.venue_name ?? undefined,
    venue_address: row.venue_address ?? undefined,
  } as EngagementParams;
}

export async function listEngagements(): Promise<EngagementSummary[]> {
  if (!isSupabaseConfigured) {
    const { KNOWN_ENGAGEMENTS, BUILD_A_DREAM } = await import("@/fixtures/registry");
    return KNOWN_ENGAGEMENTS.map((e) => ({
      id: e.slug,
      clientName: e.params.client,
      programName: BUILD_A_DREAM.name,
      deliveryDate: e.deliveryDate,
      status: "fixture",
      openTasks: null,
      overdueTasks: null,
    }));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("engagements")
    .select("id, client_name, delivery_date, status, programs(name)")
    .order("delivery_date", { ascending: true });

  if (error) throw new Error(`listEngagements: ${error.message}`);

  const today = new Date().toISOString().slice(0, 10);
  const rows = data ?? [];

  return Promise.all(
    rows.map(async (r) => {
      const program = r.programs as unknown as { name: string } | null;
      const counts = await supabase
        .from("engagement_tasks")
        .select("status, due_date")
        .eq("engagement_id", r.id)
        .neq("status", "done")
        .neq("status", "na");

      const open = counts.data?.length ?? null;
      const overdue =
        counts.data?.filter((t) => t.due_date < today).length ?? null;

      return {
        id: r.id,
        clientName: r.client_name,
        programName: program?.name ?? "unknown program",
        deliveryDate: r.delivery_date,
        status: r.status,
        openTasks: open,
        overdueTasks: overdue,
      };
    }),
  );
}

/** Null when the engagement does not exist or the caller may not see it. */
export async function getEngagement(id: string): Promise<EngagementDetail | null> {
  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from("engagements")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getEngagement: ${error.message}`);
  if (!row) return null;

  const { data: programRow, error: pErr } = await supabase
    .from("programs")
    .select("*")
    .eq("id", row.program_id)
    .maybeSingle();

  if (pErr) throw new Error(`getEngagement program: ${pErr.message}`);
  if (!programRow) throw new Error(`engagement ${id} references a missing program`);

  const program = asProgram(programRow);
  const params = toParams(row, program);
  const generated = generateEngagement(program, params, row.delivery_date, row.ros_overrides);

  const [tasks, resources, costs, staff] = await Promise.all([
    supabase
      .from("engagement_tasks")
      .select("*")
      .eq("engagement_id", id)
      .order("due_date", { ascending: true }),
    supabase.from("engagement_resources").select("*").eq("engagement_id", id),
    // RLS filters owner-only lines out of a contractor's result set.
    supabase.from("engagement_costs").select("*").eq("engagement_id", id),
    supabase
      .from("engagement_staff")
      .select("*")
      .eq("engagement_id", id)
      .order("is_lead", { ascending: false })
      .order("sort_order", { ascending: true }),
  ]);

  for (const [what, res] of [
    ["tasks", tasks],
    ["resources", resources],
    ["costs", costs],
    ["staff", staff],
  ] as const) {
    if (res.error) throw new Error(`getEngagement ${what}: ${res.error.message}`);
  }

  // What the engagement already knows goes in first; what a contractor typed
  // overwrites it. Without this the venue block reads "to be filled" next to a
  // booked venue, because the venue name lives on the engagement and the block
  // reads a different store.
  const resourceValues: Record<string, string> = derivedResourceValues(generated.resources);
  for (const r of resources.data ?? []) {
    for (const [k, v] of Object.entries(r.fields ?? {})) {
      if (typeof v === "string" && v.trim()) resourceValues[`${r.resource_key}.${k}`] = v;
    }
  }

  return {
    row,
    program,
    generated,
    tasks: tasks.data ?? [],
    resources: resources.data ?? [],
    costs: costs.data ?? [],
    staff: staff.data ?? [],
    resourceValues,
  };
}

/** The signed-in user's profile, or null when not signed in. */
export async function currentProfile() {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return data ?? null;
}

/**
 * Write the generated tasks, resource slots and cost lines for an engagement.
 *
 * Upserts on the stable template keys, so re-running after a delivery-date or
 * parameter change re-dates existing rows and adds new ones without losing the
 * status a contractor already set. Owner-only: the RLS write policies enforce
 * that regardless of who calls this.
 */
export async function materializeEngagement(id: string): Promise<{
  tasks: number;
  resources: number;
  costs: number;
}> {
  const detail = await getEngagement(id);
  if (!detail) throw new Error(`engagement ${id} not found or not permitted`);

  const supabase = await createClient();
  const { generated } = detail;

  const taskRows = generated.tasks.map((t) => ({
    engagement_id: id,
    source_key: t.sourceKey,
    phase: t.phase,
    title: t.title,
    offset_days: t.offset,
    due_date: t.dueDate,
    role: t.role,
  }));

  const resourceRows = generated.resources.map((r) => ({
    engagement_id: id,
    resource_key: r.key,
    label: r.label,
    computed_note: r.vehicle
      ? `${r.count} x ${r.vehicle}`
      : r.count !== null
        ? String(r.count)
        : null,
  }));

  const costRows = detail.program.cost_lines.map((c) => ({
    engagement_id: id,
    line_key: c.key,
    label: c.label,
    visibility: c.visibility,
  }));

  // onConflict names the unique keys so an existing row is updated in place.
  // ignoreDuplicates keeps a contractor's status and filled fields intact.
  const results = await Promise.all([
    supabase
      .from("engagement_tasks")
      .upsert(taskRows, { onConflict: "engagement_id,source_key" })
      .select("id"),
    supabase
      .from("engagement_resources")
      .upsert(resourceRows, { onConflict: "engagement_id,resource_key", ignoreDuplicates: true })
      .select("id"),
    supabase
      .from("engagement_costs")
      .upsert(costRows, { onConflict: "engagement_id,line_key", ignoreDuplicates: true })
      .select("id"),
  ]);

  const [t, r, c] = results;
  for (const [what, res] of [
    ["tasks", t],
    ["resources", r],
    ["costs", c],
  ] as const) {
    if (res.error) throw new Error(`materializeEngagement ${what}: ${res.error.message}`);
  }

  return {
    tasks: t.data?.length ?? 0,
    resources: r.data?.length ?? 0,
    costs: c.data?.length ?? 0,
  };
}
