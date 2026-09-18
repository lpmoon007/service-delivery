/**
 * Row types for the schema in supabase/migrations/0001_init.sql.
 *
 * Hand-written rather than generated, because `supabase gen types` needs a
 * connection to the project and this environment's egress policy blocks
 * supabase.co. Regenerate with
 *   npx supabase gen types typescript --project-id <ref> > src/lib/db-types.ts
 * from a machine that can reach it, and delete this note.
 */

import type { EngagementParams, RunOfShowOverrides } from "./types";

// Row shapes are type aliases, not interfaces, on purpose: postgrest-js
// constrains Row/Insert/Update to Record<string, unknown>, and TypeScript
// only gives implicit index signatures to type aliases. Declared as
// interfaces, the whole schema fails GenericSchema and every query in the
// app silently resolves to `never`.
export type AppRole = "owner" | "coordinator" | "logistics" | "technician" | "contractor";
export type EngagementStatus = "planning" | "confirmed" | "delivered" | "closed" | "cancelled";
export type TaskStatus = "not_started" | "in_progress" | "done" | "na";
export type CostVisibility = "contractor" | "owner";
/** Who performs a task, in the program template's vocabulary. */
export type TaskRole = "JC" | "coordinator" | "logistics" | "technician" | "all";

export type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  phone: string | null;
  active: boolean;
  created_at: string;
}

export type ProgramRow = {
  id: string;
  code: string;
  name: string;
  family: string | null;
  summary: string | null;
  /** The program template. Shape is `Program` from ./types. */
  definition: unknown;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type EngagementRow = {
  id: string;
  hubspot_deal_id: string | null;
  client_name: string;
  program_id: string;
  delivery_date: string;
  status: EngagementStatus;
  params: Partial<EngagementParams>;
  ros_overrides: RunOfShowOverrides;
  venue_name: string | null;
  venue_address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type EngagementTaskRow = {
  id: string;
  engagement_id: string;
  source_key: string;
  phase: string;
  title: string;
  offset_days: number;
  due_date: string;
  /** Template vocabulary, not an app_role. See migration 0001. */
  role: TaskRole;
  assignee: string | null;
  status: TaskStatus;
  note: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
}

export type EngagementResourceRow = {
  id: string;
  engagement_id: string;
  resource_key: string;
  label: string;
  computed_note: string | null;
  fields: Record<string, string>;
  cost: number | null;
  updated_at: string;
}

export type EngagementCostRow = {
  id: string;
  engagement_id: string;
  line_key: string;
  label: string;
  amount: number | null;
  visibility: CostVisibility;
  note: string | null;
  updated_at: string;
}

export type EngagementStaffRow = {
  id: string;
  engagement_id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  is_lead: boolean;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type EngagementAssignmentRow = {
  engagement_id: string;
  profile_id: string;
  role: AppRole;
  created_at: string;
}

/** Owner-only view. Contractor sessions get zero rows, not an error. */
export type EngagementPnlRow = {
  engagement_id: string;
  client_name: string;
  delivery_date: string;
  client_fee: number | null;
  direct_cost: number;
  gross_margin: number | null;
  margin_pct: number | null;
}

/**
 * postgrest-js requires `Relationships` on every table and view; without it the
 * whole schema fails its GenericSchema constraint and every query resolves to
 * `never`. Relationships must also declare the foreign keys that embedded
 * selects traverse, e.g. `.select("..., programs(name)")`.
 */
type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
}

type Table<Row, Rels extends Relationship[] = []> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: Rels;
};

/** Declares `engagement_id` -> engagements.id, which every child table has. */
type EngagementChild = [
  {
    foreignKeyName: "engagement_id_fkey";
    columns: ["engagement_id"];
    isOneToOne: false;
    referencedRelation: "engagements";
    referencedColumns: ["id"];
  },
];

export interface Database {
  public: {
    Tables: {
      profiles: Table<ProfileRow>;
      programs: Table<ProgramRow>;
      engagements: Table<
        EngagementRow,
        [
          {
            foreignKeyName: "engagements_program_id_fkey";
            columns: ["program_id"];
            isOneToOne: false;
            referencedRelation: "programs";
            referencedColumns: ["id"];
          },
        ]
      >;
      engagement_financials: Table<
        {
          engagement_id: string;
          client_fee: number | null;
          notes: string | null;
        },
        EngagementChild
      >;
      engagement_assignments: Table<EngagementAssignmentRow, EngagementChild>;
      engagement_tasks: Table<EngagementTaskRow, EngagementChild>;
      engagement_resources: Table<EngagementResourceRow, EngagementChild>;
      engagement_costs: Table<EngagementCostRow, EngagementChild>;
      engagement_staff: Table<EngagementStaffRow, EngagementChild>;
    };
    Views: {
      engagement_pnl: { Row: EngagementPnlRow; Relationships: [] };
    };
    Functions: Record<string, never>;
    Enums: {
      app_role: AppRole;
      engagement_status: EngagementStatus;
      task_status: TaskStatus;
      cost_visibility: CostVisibility;
    };
  };
}
