/**
 * Emit seed SQL for the program catalog and the live engagements.
 *
 * Generated rather than hand-written so the seeded tasks and resource slots
 * come from the same engine the app uses. Run:
 *
 *   npm run seed:sql > supabase/seed/0002_seed.sql
 *
 * Then paste the result into the Supabase SQL editor. It is idempotent: every
 * statement upserts on a natural key, so re-running after a template change
 * re-dates tasks without clobbering a status a contractor already set.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { generateEngagement } from "../src/lib/generate";
import type { EngagementParams, Program, RunOfShowOverrides } from "../src/lib/types";

const PROGRAM_DIR = join(import.meta.dirname, "..", "programs");

/** Single-quote a SQL string literal, or emit NULL. */
function lit(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  return `'${v.replace(/'/g, "''")}'`;
}

/** Embed JSON as a jsonb literal. */
function jsonb(v: unknown): string {
  return `${lit(JSON.stringify(v))}::jsonb`;
}

interface SeedEngagement {
  hubspotDealId: string;
  clientName: string;
  programCode: string;
  deliveryDate: string;
  status: "planning" | "confirmed" | "delivered" | "closed" | "cancelled";
  venueName?: string;
  venueAddress?: string;
  notes?: string;
  params: EngagementParams;
  overrides?: RunOfShowOverrides;
}

/**
 * The live engagements, from HubSpot closed-won deals as of 2026-09-17.
 * Cologix is 10/19 per JC; HubSpot still shows 10/01.
 *
 * Ledgebrook is real Build A Dream data. Cologix is real Inspiring Minds data
 * with two stated numbers that do not reconcile; see its note. The remaining
 * three carry PLACEHOLDER counts on Build A Dream purely so a timeline exists,
 * and their program and counts must be corrected before anyone relies on them.
 */
const ENGAGEMENTS: SeedEngagement[] = [
  {
    hubspotDealId: "349164670683",
    clientName: "Ledgebrook",
    programCode: "BAD",
    deliveryDate: "2026-09-16",
    status: "delivered",
    venueName: "Marriott",
    notes: "People Leadership Summit. Delivered. Close phase is live.",
    params: {
      client: "Ledgebrook",
      program: "BAD",
      participants: 75,
      teams: 13,
      beneficiaries: 13,
      beneficiary_org: "Garcia-Salesian Club",
      beneficiary_minors: true,
      beneficiary_travels: true,
      bikes_go_home_same_day: false,
      event_start: "15:15",
      beneficiary_depart_by: "17:00",
      sponsor: "Bre",
    },
  },
  {
    hubspotDealId: "349173562100",
    clientName: "Event Collective GT School",
    programCode: "BAD",
    deliveryDate: "2026-09-19",
    status: "planning",
    notes: "PLACEHOLDER counts. Confirm program and participant numbers.",
    params: {
      client: "Event Collective GT School",
      program: "BAD",
      participants: 75,
      teams: 13,
      beneficiaries: 13,
      beneficiary_org: "TBC",
      beneficiary_minors: true,
      beneficiary_travels: true,
      bikes_go_home_same_day: false,
      event_start: "09:00",
      beneficiary_depart_by: null,
    },
  },
  {
    hubspotDealId: "349235916505",
    clientName: "Microsoft",
    programCode: "BAD",
    deliveryDate: "2026-10-01",
    status: "planning",
    notes: "PLACEHOLDER counts. Highest slip risk: design phase is due now.",
    params: {
      client: "Microsoft",
      program: "BAD",
      participants: 75,
      teams: 13,
      beneficiaries: 13,
      beneficiary_org: "TBC",
      beneficiary_minors: true,
      beneficiary_travels: true,
      bikes_go_home_same_day: false,
      event_start: "09:00",
      beneficiary_depart_by: null,
    },
  },
  {
    hubspotDealId: "349148451532",
    clientName: "McKesson",
    programCode: "BAD",
    deliveryDate: "2026-10-06",
    status: "planning",
    notes: "Peak Performance session. PLACEHOLDER counts; may not be Build A Dream at all.",
    params: {
      client: "McKesson",
      program: "BAD",
      participants: 40,
      teams: 8,
      beneficiaries: 8,
      beneficiary_org: "TBC",
      beneficiary_minors: true,
      beneficiary_travels: true,
      bikes_go_home_same_day: false,
      event_start: "09:00",
      beneficiary_depart_by: null,
    },
  },
  {
    hubspotDealId: "349230649080",
    clientName: "Cologix",
    programCode: "IM",
    deliveryDate: "2026-10-19",
    status: "confirmed",
    notes:
      "Inspiring Minds, The Long Current, per JC. 40 participants, 20 children, 7-8 teachers " +
      "from other schools. TWO THINGS TO RESOLVE: the program is built on three adults per child " +
      "and this is two, and 20 children is four pods which calls for 60 participants. " +
      "\"Other schools\" plural may also mean more than one partner organization, each of which " +
      "is entitled to a classroom collection.",
    params: {
      client: "Cologix",
      program: "IM",
      variation: "The Long Current",
      format: "Department day",
      participants: 40,
      teams: 0,
      beneficiaries: 20,
      partner_orgs: 1,
      chaperones: 8,
      beneficiary_org: "TBC",
      beneficiary_minors: true,
      beneficiary_travels: true,
      stage_led_reversal: false,
      dimmable_room: false,
      event_start: "13:00",
      beneficiary_depart_by: null,
    },
  },
];

function loadPrograms(): Program[] {
  return readdirSync(PROGRAM_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(PROGRAM_DIR, f), "utf8")) as Program);
}

function main(): void {
  const programs = loadPrograms();
  const byCode = new Map(programs.map((p) => [p.code, p]));
  const out: string[] = [];

  out.push(
    "-- Seed: program catalog and live engagements.",
    "-- GENERATED by scripts/generate-seed.ts. Do not hand-edit; regenerate.",
    `-- Generated ${new Date().toISOString().slice(0, 10)}.`,
    "--",
    "-- Idempotent: every statement upserts on a natural key. Re-running after a",
    "-- template change re-dates tasks and adds new ones without resetting the",
    "-- status a contractor already set.",
    "",
    "begin;",
    "",
  );

  out.push("-- ------------------------------------------------------ programs --", "");
  for (const p of programs) {
    out.push(
      `insert into programs (code, name, family, summary, definition) values (`,
      `  ${lit(p.code)}, ${lit(p.name)}, ${lit(p.family ?? null)}, ${lit(p.summary ?? null)},`,
      `  ${jsonb(p)}`,
      `)`,
      `on conflict (code) do update set`,
      `  name = excluded.name, family = excluded.family,`,
      `  summary = excluded.summary, definition = excluded.definition,`,
      `  updated_at = now();`,
      "",
    );
  }

  out.push("-- --------------------------------------------------- engagements --", "");
  for (const e of ENGAGEMENTS) {
    const program = byCode.get(e.programCode);
    if (!program) throw new Error(`engagement ${e.clientName} references unknown program ${e.programCode}`);

    out.push(
      `insert into engagements (`,
      `  hubspot_deal_id, client_name, program_id, delivery_date, status,`,
      `  params, ros_overrides, venue_name, venue_address, notes`,
      `) select`,
      `  ${lit(e.hubspotDealId)}, ${lit(e.clientName)}, p.id, ${lit(e.deliveryDate)}, ${lit(e.status)}::engagement_status,`,
      `  ${jsonb(e.params)}, ${jsonb(e.overrides ?? {})},`,
      `  ${lit(e.venueName ?? null)}, ${lit(e.venueAddress ?? null)}, ${lit(e.notes ?? null)}`,
      `from programs p where p.code = ${lit(e.programCode)}`,
      `on conflict (hubspot_deal_id) do update set`,
      `  client_name = excluded.client_name, delivery_date = excluded.delivery_date,`,
      `  status = excluded.status, params = excluded.params,`,
      `  ros_overrides = excluded.ros_overrides, venue_name = excluded.venue_name,`,
      `  venue_address = excluded.venue_address, notes = excluded.notes,`,
      `  updated_at = now();`,
      "",
    );

    const g = generateEngagement(program, e.params, e.deliveryDate, e.overrides ?? {});

    out.push(`-- ${e.clientName}: ${g.tasks.length} tasks, ${g.resources.length} resource blocks`);
    for (const t of g.tasks) {
      out.push(
        `insert into engagement_tasks (engagement_id, source_key, phase, title, offset_days, due_date, role)`,
        `select e.id, ${lit(t.sourceKey)}, ${lit(t.phase)}, ${lit(t.title)}, ${t.offset}, ${lit(t.dueDate)}, ${lit(t.role)}`,
        `from engagements e where e.hubspot_deal_id = ${lit(e.hubspotDealId)}`,
        `on conflict (engagement_id, source_key) do update set`,
        `  phase = excluded.phase, title = excluded.title,`,
        `  offset_days = excluded.offset_days, due_date = excluded.due_date,`,
        `  role = excluded.role;`,
      );
    }
    out.push("");

    for (const r of g.resources) {
      const note = r.vehicle ? `${r.count} x ${r.vehicle}` : r.count !== null ? String(r.count) : null;
      out.push(
        `insert into engagement_resources (engagement_id, resource_key, label, computed_note)`,
        `select e.id, ${lit(r.key)}, ${lit(r.label)}, ${lit(note)}`,
        `from engagements e where e.hubspot_deal_id = ${lit(e.hubspotDealId)}`,
        // Only the computed note is refreshed: `fields` holds what a contractor
        // typed, so it is never overwritten by a regeneration.
        `on conflict (engagement_id, resource_key) do update set`,
        `  label = excluded.label, computed_note = excluded.computed_note;`,
      );
    }
    out.push("");

    for (const c of program.cost_lines) {
      out.push(
        `insert into engagement_costs (engagement_id, line_key, label, visibility)`,
        `select e.id, ${lit(c.key)}, ${lit(c.label)}, ${lit(c.visibility)}::cost_visibility`,
        `from engagements e where e.hubspot_deal_id = ${lit(e.hubspotDealId)}`,
        `on conflict (engagement_id, line_key) do update set`,
        `  label = excluded.label, visibility = excluded.visibility;`,
      );
    }
    out.push("");
  }

  out.push(
    "-- ---------------------------------------- owner bootstrap (manual) --",
    "--",
    "-- profiles.id references auth.users, so a person must exist in Auth before",
    "-- they can have a profile. Create yourself in the dashboard under",
    "-- Authentication -> Users -> Add user, then run:",
    "--",
    "--   insert into profiles (id, email, full_name, role)",
    "--   select id, email, 'James Carter', 'owner' from auth.users",
    "--   where email = 'jcarter@belegendary.org'",
    "--   on conflict (id) do update set role = 'owner';",
    "--",
    "-- Until that row exists, is_owner() is false and every policy will",
    "-- correctly refuse you access to everything. That is not a bug.",
    "--",
    "-- Contractors: add each to Auth, insert a profile with role 'contractor'",
    "-- (or coordinator/logistics/technician), then assign them:",
    "--",
    "--   insert into engagement_assignments (engagement_id, profile_id, role)",
    "--   select e.id, p.id, 'logistics' from engagements e, profiles p",
    "--   where e.hubspot_deal_id = '349230649080' and p.email = 'someone@example.com';",
    "",
    "commit;",
    "",
  );

  process.stdout.write(out.join("\n"));
}

main();
