/** Types for program templates and generated engagement output. */

export type Confidence = "high" | "medium" | "low";
export type Role = "JC" | "coordinator" | "logistics" | "technician" | "all";
export type Visibility = "contractor" | "owner";

export interface ProgramParameter {
  key: string;
  label: string;
  type: "int" | "number" | "text" | "bool" | "time";
  required?: boolean;
  default?: string | number | boolean;
}

export interface QuantityRule {
  item: string;
  /** Expression over engagement params plus derived values such as `bikes`. */
  formula: string;
  basis: string;
  confidence?: Confidence;
  note?: string;
}

export interface VehicleRule {
  /** Boolean expression. First matching rule wins. */
  when: string;
  vehicle: string;
  count_formula: string;
}

export interface ResourceRule {
  key: string;
  label: string;
  /** Always include this resource block. */
  always?: boolean;
  /** Boolean expression gating inclusion when `always` is not set. */
  condition?: string;
  count_formula?: string;
  vehicle_rule?: VehicleRule[];
  fields?: string[];
  note?: string;
}

export interface RunOfShowStep {
  id: string;
  label: string;
  duration: number;
  details?: string[];
  /** Runs before participant arrival, ending when the event starts. */
  before_start?: boolean;
  /** The reveal. Everything before it can be computed backward from it. */
  is_anchor?: boolean;
  /** Sits after the formal close; not part of the running schedule. */
  after_close?: boolean;
}

export interface BeneficiaryStep {
  id: string;
  label: string;
  /** Minutes relative to the anchor. <= -1440 means "the day before". */
  offset_from_reveal: number;
  duration?: number;
}

export interface TaskRule {
  phase: string;
  title: string;
  /** Days relative to the delivery date. Negative is before. */
  offset: number;
  role: Role;
  condition?: string;
  note?: string;
}

export interface CostLine {
  key: string;
  label: string;
  visibility: Visibility;
  computed?: string;
}

/**
 * A document the program generates, beyond the coordination doc.
 *
 * Bodies interpolate {{token}} against the engagement's computed context, so a
 * letter stays correct when a date or a count changes instead of being a copy
 * that quietly goes stale.
 */
export interface DocumentSection {
  heading?: string;
  /** Paragraphs. Each is interpolated. */
  body?: string[];
  /** Numbered or bulleted points, also interpolated. */
  bullets?: string[];
  ordered?: boolean;
  /** Boolean expression over engagement params; omit to always include. */
  condition?: string;
}

export interface ProgramDocument {
  key: string;
  title: string;
  /** Who it is written to. Drives the page heading, not permissions. */
  audience: string;
  /** One line describing when to send it. */
  purpose?: string;
  /** Day offset from delivery when this should go out. */
  send_offset?: number;
  greeting?: string;
  sections: DocumentSection[];
  signoff?: string[];
}

export interface Program {
  code: string;
  name: string;
  family?: string;
  summary?: string;
  source?: string;
  parameters: ProgramParameter[];
  quantities: QuantityRule[];
  resources: ResourceRule[];
  run_of_show: {
    anchor: string;
    anchor_rule: string;
    main_track: RunOfShowStep[];
    beneficiary_track: BeneficiaryStep[];
  };
  tasks: TaskRule[];
  cost_lines: CostLine[];
  documents?: ProgramDocument[];
}

/** Engagement-specific inputs. Values feed the template's expressions. */
export interface EngagementParams {
  client: string;
  program: string;
  participants: number;
  teams: number;
  beneficiaries: number;
  beneficiary_org?: string;
  beneficiary_minors?: boolean;
  beneficiary_travels?: boolean;
  bikes_go_home_same_day?: boolean;
  travel_distance_mi?: number;
  /** "HH:MM", 24-hour. Participant arrival. */
  event_start: string;
  /** "HH:MM", 24-hour. When beneficiaries must be gone. Anchors the schedule. */
  beneficiary_depart_by?: string | null;
  [key: string]: unknown;
}

/** Per-engagement duration tweaks, keyed by step id, plus steps to drop. */
export interface RunOfShowOverrides {
  durations?: Record<string, number>;
  skip?: string[];
}

export interface ScheduledStep extends RunOfShowStep {
  /** Minutes from midnight. */
  start: number;
  end: number;
}

export interface ScheduledBeneficiaryStep extends BeneficiaryStep {
  /** Minutes from midnight, or null for "the day before". */
  start: number | null;
  end: number | null;
}

export interface RunOfShow {
  start: number;
  reveal: number;
  close: number;
  /** Human-readable explanation of how the anchor was fixed. */
  basis: string;
  anchoredBackward: boolean;
  main: ScheduledStep[];
  beneficiary: ScheduledBeneficiaryStep[];
}

export interface GeneratedTask extends TaskRule {
  /** Stable identity so regeneration updates rather than duplicates. */
  sourceKey: string;
  dueDate: string;
}

export interface GeneratedQuantity {
  item: string;
  qty: number;
  basis: string;
  confidence: Confidence;
  note?: string;
}

export interface GeneratedResource {
  key: string;
  label: string;
  count: number | null;
  vehicle: string | null;
  fields: string[];
  note?: string;
}
