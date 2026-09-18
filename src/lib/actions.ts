"use server";

/**
 * Server actions: every write the app performs.
 *
 * These run as the signed-in user, so row-level security is the real
 * authorization boundary, not these functions. A contractor calling
 * updateEngagement gets zero rows updated rather than an error, because the
 * owner-only write policy simply does not match their rows. That is deliberate:
 * the checks live in the database, where they cannot be bypassed by a bug in a
 * component.
 */

import { revalidatePath } from "next/cache";

import { getEngagement, materializeEngagement } from "./db";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { generateEngagement, parseTime } from "./generate";
import type { EngagementStatus, TaskStatus } from "./db-types";
import type { EngagementParams, Program } from "./types";

const TASK_STATUSES: TaskStatus[] = ["not_started", "in_progress", "done", "na"];
const ENGAGEMENT_STATUSES: EngagementStatus[] = [
  "planning",
  "confirmed",
  "delivered",
  "closed",
  "cancelled",
];


/**
 * Read a program's declared parameters out of a form.
 *
 * Shared by create and save so the two cannot drift: a parameter added to a
 * program template is immediately accepted by both, with no code change.
 */
function readParams(
  program: Program,
  formData: FormData,
  clientName: string,
  base: Record<string, unknown> = {},
): { value: Record<string, unknown> } | { error: string } {
  const params: Record<string, unknown> = { ...base, client: clientName, program: program.code };

  for (const p of program.parameters) {
    const raw = formData.get(`param.${p.key}`);

    if (p.type === "bool") {
      params[p.key] = raw === "on" || raw === "true";
      continue;
    }

    const value = typeof raw === "string" ? raw.trim() : "";

    if (value === "") {
      if (p.required) return { error: `${p.label} is required.` };
      params[p.key] = p.type === "time" ? null : undefined;
      continue;
    }

    if (p.type === "int" || p.type === "number") {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) return { error: `${p.label} must be a positive number.` };
      if (p.type === "int" && !Number.isInteger(n)) {
        return { error: `${p.label} must be a whole number.` };
      }
      params[p.key] = n;
      continue;
    }

    if (p.type === "time") {
      try {
        parseTime(value);
      } catch {
        return { error: `${p.label} must be a time like 15:15.` };
      }
      params[p.key] = value;
      continue;
    }

    params[p.key] = value;
  }

  return { value: params };
}

export interface ActionResult {
  ok: boolean;
  message?: string;
}

function fail(message: string): ActionResult {
  return { ok: false, message };
}

/** Mark a task's progress. Contractors may do this on their own engagements. */
export async function setTaskStatus(
  engagementId: string,
  taskId: string,
  status: string,
): Promise<ActionResult> {
  if (!TASK_STATUSES.includes(status as TaskStatus)) {
    return fail(`unknown status "${status}"`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("engagement_tasks")
    .update({ status: status as TaskStatus })
    .eq("id", taskId)
    .eq("engagement_id", engagementId)
    .select("id");

  if (error) return fail(error.message);
  // Zero rows means row-level security refused the write, not that the task is
  // missing. Say so plainly rather than reporting a silent success.
  if (!data || data.length === 0) {
    return fail("Not saved: you do not have permission to change this task.");
  }

  revalidatePath(`/engagements/${engagementId}/work`);
  revalidatePath(`/engagements/${engagementId}`);
  revalidatePath("/");
  return { ok: true };
}

/**
 * Save a resource block's detail fields and its cost. These are what a
 * contractor fills in after booking: vendor, confirmation number, what it cost.
 */
export async function saveResource(
  engagementId: string,
  resourceId: string,
  formData: FormData,
): Promise<ActionResult> {
  const fields: Record<string, string> = {};
  let cost: number | null = null;

  for (const [key, raw] of formData.entries()) {
    if (typeof raw !== "string") continue;
    const value = raw.trim();

    if (key === "__cost") {
      if (value === "") {
        cost = null;
      } else {
        const n = Number(value.replace(/[$,]/g, ""));
        if (!Number.isFinite(n) || n < 0) return fail(`"${value}" is not a valid cost`);
        cost = n;
      }
      continue;
    }
    if (key.startsWith("field.")) {
      const name = key.slice("field.".length);
      if (value) fields[name] = value;
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("engagement_resources")
    .update({ fields, cost, updated_at: new Date().toISOString() })
    .eq("id", resourceId)
    .eq("engagement_id", engagementId)
    .select("id");

  if (error) return fail(error.message);
  if (!data || data.length === 0) {
    return fail("Not saved: you do not have permission to change this resource.");
  }

  revalidatePath(`/engagements/${engagementId}/work`);
  revalidatePath(`/engagements/${engagementId}`);
  return { ok: true };
}

/**
 * Save the contractor-visible cost lines. The owner-only lines are not in this
 * form and the RLS policy would reject them anyway, in both `using` and
 * `with check`, so a crafted request cannot reach them either.
 */
export async function saveCosts(
  engagementId: string,
  formData: FormData,
): Promise<ActionResult> {
  const updates: { id: string; amount: number | null; note: string | null }[] = [];

  const ids = formData.getAll("id").filter((v): v is string => typeof v === "string");
  for (const id of ids) {
    const rawAmount = String(formData.get(`amount.${id}`) ?? "").trim();
    const rawNote = String(formData.get(`note.${id}`) ?? "").trim();

    let amount: number | null = null;
    if (rawAmount !== "") {
      const n = Number(rawAmount.replace(/[$,]/g, ""));
      if (!Number.isFinite(n) || n < 0) return fail(`"${rawAmount}" is not a valid amount`);
      amount = n;
    }
    updates.push({ id, amount, note: rawNote || null });
  }

  const supabase = await createClient();
  for (const u of updates) {
    const { error } = await supabase
      .from("engagement_costs")
      .update({ amount: u.amount, note: u.note, updated_at: new Date().toISOString() })
      .eq("id", u.id)
      .eq("engagement_id", engagementId);
    if (error) return fail(error.message);
  }

  revalidatePath(`/engagements/${engagementId}/work`);
  revalidatePath(`/engagements/${engagementId}`);
  return { ok: true };
}

/**
 * Save an engagement's parameters, then regenerate.
 *
 * Regeneration is not optional here: changing the delivery date or a count
 * changes every derived due date, quantity and resource requirement. Saving
 * without it would leave the page showing one timeline and the task table
 * another. Task status survives, because the upsert keys on the template's
 * stable source_key.
 */
export async function saveEngagement(
  engagementId: string,
  formData: FormData,
): Promise<ActionResult> {
  const detail = await getEngagement(engagementId);
  if (!detail) return fail("Engagement not found, or not yours.");

  const clientName = String(formData.get("client_name") ?? "").trim();
  if (!clientName) return fail("Client name is required.");

  const deliveryDate = String(formData.get("delivery_date") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) {
    return fail("Delivery date must be a real date.");
  }

  const status = String(formData.get("status") ?? "").trim();
  if (!ENGAGEMENT_STATUSES.includes(status as EngagementStatus)) {
    return fail(`unknown status "${status}"`);
  }

  const read = readParams(detail.program, formData, clientName, detail.row.params as Record<string, unknown>);
  if ("error" in read) return fail(read.error);
  const params = read.value;

  // Prove the new parameters actually generate before writing them, so a bad
  // combination is rejected here rather than breaking every page that reads it.
  try {
    generateEngagement(
      detail.program,
      params as EngagementParams,
      deliveryDate,
      detail.row.ros_overrides,
    );
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Those parameters do not generate a timeline.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("engagements")
    .update({
      client_name: clientName,
      delivery_date: deliveryDate,
      status: status as EngagementStatus,
      params,
      venue_name: String(formData.get("venue_name") ?? "").trim() || null,
      venue_address: String(formData.get("venue_address") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", engagementId)
    .select("id");

  if (error) return fail(error.message);
  if (!data || data.length === 0) {
    return fail("Not saved: only the owner can change an engagement.");
  }

  try {
    await materializeEngagement(engagementId);
  } catch (e) {
    return fail(
      `Saved, but regenerating the timeline failed: ${
        e instanceof Error ? e.message : "unknown error"
      }`,
    );
  }

  revalidatePath(`/engagements/${engagementId}`);
  revalidatePath(`/engagements/${engagementId}/work`);
  revalidatePath(`/engagements/${engagementId}/edit`);
  revalidatePath("/");
  return { ok: true, message: "Saved and timeline regenerated." };
}

/** Re-run generation without changing anything. Useful after a template edit. */
export async function regenerate(engagementId: string): Promise<ActionResult> {
  try {
    const counts = await materializeEngagement(engagementId);
    revalidatePath(`/engagements/${engagementId}`);
    revalidatePath(`/engagements/${engagementId}/work`);
    revalidatePath("/");
    return {
      ok: true,
      message: `Regenerated: ${counts.tasks} tasks, ${counts.resources} resource slots, ${counts.costs} cost lines.`,
    };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Regeneration failed.");
  }
}

/** Sign out and return to the login page. */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/");
}


/**
 * Create an engagement from a program and a set of parameters.
 *
 * This is the front door: pick a client, pick a service, give it a date, fill
 * in the counts the program asks for. Everything downstream, the whole task
 * timeline, the material quantities, the resource requirements, is derived from
 * what this writes.
 */
export async function createEngagement(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const clientName = String(formData.get("client_name") ?? "").trim();
  if (!clientName) return fail("Client name is required.");

  const programId = String(formData.get("program_id") ?? "").trim();
  if (!programId) return fail("Pick a service.");

  const deliveryDate = String(formData.get("delivery_date") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) {
    return fail("Delivery date must be a real date.");
  }

  const { data: programRow, error: pErr } = await supabase
    .from("programs")
    .select("*")
    .eq("id", programId)
    .maybeSingle();
  if (pErr) return fail(pErr.message);
  if (!programRow) return fail("That service no longer exists.");

  const program = programRow.definition as unknown as Program;
  const params = readParams(program, formData, clientName);
  if ("error" in params) return fail(params.error);

  // Prove it generates before writing anything, so a bad combination fails at
  // the form rather than leaving a broken engagement behind.
  try {
    generateEngagement(program, params.value as EngagementParams, deliveryDate, {});
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Those details do not generate a timeline.");
  }

  const { data, error } = await supabase
    .from("engagements")
    .insert({
      client_name: clientName,
      program_id: programId,
      delivery_date: deliveryDate,
      status: "planning",
      params: params.value,
      ros_overrides: {},
      venue_name: String(formData.get("venue_name") ?? "").trim() || null,
      venue_address: String(formData.get("venue_address") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
      hubspot_deal_id: String(formData.get("hubspot_deal_id") ?? "").trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return fail("An engagement already exists for that HubSpot deal id.");
    }
    return fail(error.message);
  }
  if (!data) return fail("Not created: only the owner can add an engagement.");

  try {
    await materializeEngagement(data.id);
  } catch (e) {
    return fail(
      `Created, but generating the timeline failed: ${
        e instanceof Error ? e.message : "unknown error"
      }`,
    );
  }

  revalidatePath("/");
  redirect(`/engagements/${data.id}/work`);
}

/** Change which service an engagement runs, then rebuild from the new template. */
export async function setProgram(
  engagementId: string,
  programId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("engagements")
    .update({ program_id: programId, updated_at: new Date().toISOString() })
    .eq("id", engagementId)
    .select("id");

  if (error) return fail(error.message);
  if (!data || data.length === 0) {
    return fail("Not changed: only the owner can change the service.");
  }

  // The old program's tasks do not belong to the new one. Their source keys are
  // prefixed with the program code, so they would otherwise linger forever.
  const { error: delErr } = await supabase
    .from("engagement_tasks")
    .delete()
    .eq("engagement_id", engagementId);
  if (delErr) return fail(`Service changed, but clearing old tasks failed: ${delErr.message}`);

  try {
    await materializeEngagement(engagementId);
  } catch (e) {
    return fail(
      `Service changed, but generating the new timeline failed: ${
        e instanceof Error ? e.message : "unknown error"
      }. The parameters the new service needs are probably missing; fill them in and save.`,
    );
  }

  revalidatePath(`/engagements/${engagementId}`);
  revalidatePath(`/engagements/${engagementId}/work`);
  revalidatePath(`/engagements/${engagementId}/edit`);
  return { ok: true, message: "Service changed and timeline rebuilt." };
}

/** Add someone to the delivery crew. */
export async function addStaff(
  engagementId: string,
  formData: FormData,
): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return fail("A name is required.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("engagement_staff")
    .insert({
      engagement_id: engagementId,
      name,
      role: String(formData.get("role") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      is_lead: formData.get("is_lead") === "on",
      notes: String(formData.get("notes") ?? "").trim() || null,
    })
    .select("id");

  if (error) return fail(error.message);
  if (!data || data.length === 0) {
    return fail("Not added: you do not have permission to staff this engagement.");
  }

  revalidatePath(`/engagements/${engagementId}/work`);
  revalidatePath(`/engagements/${engagementId}`);
  return { ok: true, message: `${name} added.` };
}

export async function removeStaff(
  engagementId: string,
  staffId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("engagement_staff")
    .delete()
    .eq("id", staffId)
    .eq("engagement_id", engagementId);

  if (error) return fail(error.message);
  revalidatePath(`/engagements/${engagementId}/work`);
  revalidatePath(`/engagements/${engagementId}`);
  return { ok: true };
}
