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
  /** A fixed set of choices. Renders as a dropdown rather than a text box. */
  options?: string[];
  /** One line of guidance shown under the field. */
  help?: string;
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
  /** Minutes at the program's natural length. */
  duration: number;
  /**
   * This step is the same length at any session length. The reveal is five
   * minutes whether the event runs 90 minutes or 180; the content block and the
   * build are where time actually goes. Only elastic steps absorb a change in
   * session length.
   */
  fixed?: boolean;
  /** Floor for an elastic step, in minutes. Defaults to 1. */
  min?: number;
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
  /**
   * Named values computed from the parameters, available to every formula and
   * condition. Evaluated in declaration order, so a later one may use an
   * earlier one.
   *
   * This exists so program-specific arithmetic stays in the program. `bikes`
   * was once hard-coded in the engine, which was fine while Build A Dream was
   * the only program and wrong the moment it was not.
   */
  derived?: Record<string, string>;
  quantities: QuantityRule[];
  resources: ResourceRule[];
  run_of_show: {
    anchor: string;
    anchor_rule: string;
    /**
     * Minutes from the anchor until the beneficiaries leave. Used to pin the
     * anchor when an engagement has a hard departure deadline. Program-specific:
     * Build A Dream's children go 30 minutes after the reveal, Inspiring Minds'
     * young scientists stay 60. Defaults to 30 when absent.
     */
    reveal_to_departure?: number;
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
  /**
   * Requested session length in minutes, excluding setup and load-out. Unset
   * means the program's natural length. Events run 90 to 180; 120 is typical.
   */
  session_minutes?: number;
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
