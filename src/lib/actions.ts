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
import { createClient } from "./supabase/server";
import { parseTime } from "./generate";
import type { EngagementStatus, TaskStatus } from "./db-types";
import type { EngagementParams } from "./types";

const TASK_STATUSES: TaskStatus[] = ["not_started", "in_progress", "done", "na"];
const ENGAGEMENT_STATUSES: EngagementStatus[] = [
  "planning",
  "confirmed",
  "delivered",
  "closed",
  "cancelled",
];

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

  // Build params from the program's own declared parameters, so a new program
  // gets an edit form without any code change here.
  const params: Record<string, unknown> = { ...(detail.row.params as object) };
  for (const p of detail.program.parameters) {
    const raw = formData.get(`param.${p.key}`);

    if (p.type === "bool") {
      params[p.key] = raw === "on" || raw === "true";
      continue;
    }

    const value = typeof raw === "string" ? raw.trim() : "";

    if (value === "") {
      if (p.required) return fail(`${p.label} is required.`);
      params[p.key] = p.type === "time" ? null : undefined;
      continue;
    }

    if (p.type === "int" || p.type === "number") {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) return fail(`${p.label} must be a positive number.`);
      if (p.type === "int" && !Number.isInteger(n)) {
        return fail(`${p.label} must be a whole number.`);
      }
      params[p.key] = n;
      continue;
    }

    if (p.type === "time") {
      try {
        parseTime(value);
      } catch {
        return fail(`${p.label} must be a time like 15:15.`);
      }
      params[p.key] = value;
      continue;
    }

    params[p.key] = value;
  }

  // Prove the new parameters actually generate before writing them, so a bad
  // combination is rejected here rather than breaking every page that reads it.
  const { generateEngagement } = await import("./generate");
  try {
    generateEngagement(
      detail.program,
      { ...(params as EngagementParams), client: clientName },
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
