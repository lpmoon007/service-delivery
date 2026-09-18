/**
 * The generation engine.
 *
 * One program template plus one set of engagement parameters produces the task
 * timeline, the material quantities, the required resource blocks and both
 * run-of-show tracks. Nothing here is program-specific: Build A Dream is data.
 *
 * Validated against two real events. See generate.test.ts.
 */

import { evalBoolean, evalNumber, evaluate, type Context } from "./expr";
import type {
  EngagementParams,
  GeneratedQuantity,
  GeneratedResource,
  GeneratedTask,
  Program,
  RunOfShow,
  RunOfShowOverrides,
  RunOfShowStep,
  ScheduledBeneficiaryStep,
  ScheduledStep,
} from "./types";

/** Minutes from midnight for an "HH:MM" string. */
export function parseTime(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) throw new Error(`bad time ${JSON.stringify(hhmm)}, expected HH:MM`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) throw new Error(`time out of range: ${hhmm}`);
  return h * 60 + min;
}

/** "4:30 PM" for 990. Wraps past midnight rather than throwing. */
export function formatTime(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const period = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${period}`;
}

/**
 * Build the evaluation context: the engagement's own numeric and boolean
 * parameters, plus derived values the template refers to.
 */
export function buildContext(params: EngagementParams, program?: Program): Context {
  // Null prototype: nothing inherited can be reachable as an identifier.
  const ctx: Context = Object.create(null) as Context;

  // Declared defaults first, so a condition referring to a parameter added
  // after an engagement was created still evaluates instead of throwing.
  for (const p of program?.parameters ?? []) {
    if (
      typeof p.default === "number" ||
      typeof p.default === "boolean" ||
      typeof p.default === "string"
    ) {
      ctx[p.key] = p.default;
    }
  }

  // Strings are included so a condition can branch on a named variation.
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "number" || typeof v === "boolean" || typeof v === "string") {
      ctx[k] = v;
    }
  }

  // Program-declared derived values, in order, so a later one can use an
  // earlier one.
  //
  // A failure here is fatal and says why. Skipping it silently was worse: the
  // derived name then looked unknown to every formula that used it, so a
  // missing parameter was reported as a missing derived value and the actual
  // cause was two steps away. A derived formula that references a parameter
  // with no value is a template bug, and the message should name both.
  for (const [key, formula] of Object.entries(program?.derived ?? {})) {
    try {
      ctx[key] = evaluate(formula, ctx);
    } catch (e) {
      throw new Error(
        `program ${program?.code ?? "?"}: derived value "${key}" could not be computed ` +
          `from "${formula}": ${e instanceof Error ? e.message : String(e)}. ` +
          `Give the parameter it needs a default, or guard the formula.`,
      );
    }
  }

  return ctx;
}

/**
 * Default minutes from the anchor until the beneficiaries leave, when a program
 * does not state its own. Build A Dream's 30 was the original value and stays
 * the fallback.
 */
const DEFAULT_REVEAL_TO_DEPARTURE = 30;


/**
 * Fit the schedule to a requested session length.
 *
 * Events run anywhere from 90 to 180 minutes and 120 is typical, so the length
 * is an engagement input rather than a property of the template. Fixed steps
 * keep their duration and the difference is distributed across the elastic ones
 * in proportion to their natural length: a longer event means a longer content
 * block, a longer build and a longer debrief, not a longer human tunnel.
 *
 * Scaling only happens when an engagement asks for a length. Left unset, the
 * program runs at its natural length and the arithmetic below never executes,
 * so an existing engagement's times cannot move underneath it.
 */
function fitToSessionLength(
  steps: RunOfShowStep[],
  target: number,
  programCode: string,
): RunOfShowStep[] {
  const scheduled = steps.filter((s) => !s.before_start && !s.after_close);
  const natural = scheduled.reduce((n, s) => n + s.duration, 0);
  if (target === natural) return steps;

  const minOf = (s: RunOfShowStep) => Math.max(1, s.min ?? 1);
  const elastic = scheduled.filter((s) => !s.fixed);
  const fixedTotal = scheduled.filter((s) => s.fixed).reduce((n, s) => n + s.duration, 0);
  const floor = fixedTotal + elastic.reduce((n, s) => n + minOf(s), 0);

  if (elastic.length === 0) {
    throw new Error(
      `program ${programCode} has no elastic steps, so it cannot be fitted to ` +
        `${target} minutes. Its length is fixed at ${natural}.`,
    );
  }
  if (target < floor) {
    throw new Error(
      `${target} minutes is below this program's floor of ${floor}: ` +
        `${fixedTotal} minutes of fixed steps plus the minimum for each elastic step.`,
    );
  }

  const out = new Map<string, number>();
  let pool = elastic;
  let slack = target - fixedTotal;

  // Water-filling. A step whose proportional share lands below its own minimum
  // is pinned at that minimum and leaves the pool, and the steps still in the
  // pool share out what is left. One pass is not enough: pinning a step spends
  // more than its proportional share, which shrinks the slack available to the
  // others and can push the next one under its minimum in turn.
  //
  // The loop always terminates. Because target >= floor, the slack remaining
  // is never less than the sum of the minimums still in the pool, so the shares
  // cannot all be below their minimums at once and at least one step survives
  // each pass.
  for (;;) {
    const poolTotal = pool.reduce((n, s) => n + s.duration, 0);
    const under = pool.filter((s) => (s.duration / poolTotal) * slack < minOf(s));
    if (under.length === 0) break;
    for (const s of under) {
      out.set(s.id, minOf(s));
      slack -= minOf(s);
    }
    pool = pool.filter((s) => !out.has(s.id));
  }

  const poolTotal = pool.reduce((n, s) => n + s.duration, 0);
  let assigned = 0;
  for (const s of pool) {
    const share = Math.floor((s.duration / poolTotal) * slack);
    out.set(s.id, share);
    assigned += share;
  }

  // Flooring loses a few minutes. Give them to the longest step still in the
  // pool so the total lands exactly on the requested length. Only ever adds, so
  // it cannot push a step back under its minimum.
  const remainder = slack - assigned;
  if (remainder > 0) {
    const biggest = [...pool].sort((a, b) => b.duration - a.duration)[0]!;
    out.set(biggest.id, (out.get(biggest.id) ?? 0) + remainder);
  }

  return steps.map((s) => (out.has(s.id) ? { ...s, duration: out.get(s.id)! } : s));
}

/**
 * Compute both tracks.
 *
 * If the engagement has a hard beneficiary departure deadline, the reveal is
 * pinned at `deadline - reveal_to_departure` and every pre-reveal step is laid
 * out backward from it. This is the rule stated in prose on the Ledgebrook run of show: the
 * children being gone by 5:00 fixes the reveal at 4:30 and sets the length of
 * everything ahead of it.
 *
 * With no deadline the schedule runs forward from participant arrival.
 */
export function computeRunOfShow(
  program: Program,
  params: EngagementParams,
  overrides: RunOfShowOverrides = {},
): RunOfShow {
  const skip = new Set(overrides.skip ?? []);
  const durations = overrides.durations ?? {};

  let steps = program.run_of_show.main_track
    .filter((s) => !skip.has(s.id))
    .map((s) => ({ ...s, duration: durations[s.id] ?? s.duration }));

  // Applied after per-step overrides, so an explicit duration is the starting
  // point for the fit rather than being overwritten by it.
  const requested = params.session_minutes;
  if (typeof requested === "number" && Number.isFinite(requested)) {
    steps = fitToSessionLength(steps, requested, program.code);
  }

  const anchorIdx = steps.findIndex((s) => s.is_anchor);
  if (anchorIdx === -1) throw new Error(`program ${program.code} has no anchor step`);

  const preAnchor = steps.slice(0, anchorIdx).filter((s) => !s.before_start);
  const preAnchorMinutes = preAnchor.reduce((n, s) => n + s.duration, 0);

  let start: number;
  let reveal: number;
  let basis: string;
  const anchoredBackward = Boolean(params.beneficiary_depart_by);

  const revealToDeparture =
    program.run_of_show.reveal_to_departure ?? DEFAULT_REVEAL_TO_DEPARTURE;

  if (params.beneficiary_depart_by) {
    reveal = parseTime(params.beneficiary_depart_by) - revealToDeparture;
    start = reveal - preAnchorMinutes;
    basis =
      `beneficiaries depart by ${formatTime(parseTime(params.beneficiary_depart_by))}, ` +
      `so the reveal is fixed at ${formatTime(reveal)} and everything before it is ` +
      `computed backward`;
  } else {
    start = parseTime(params.event_start);
    reveal = start + preAnchorMinutes;
    basis =
      `no hard departure deadline, so the schedule runs forward from arrival at ` +
      `${formatTime(start)} and the reveal falls at ${formatTime(reveal)}`;
  }

  const main: ScheduledStep[] = [];
  let cursor = start;
  for (const s of steps) {
    if (s.before_start) {
      main.push({ ...s, start: start - s.duration, end: start });
      continue;
    }
    main.push({ ...s, start: cursor, end: cursor + s.duration });
    cursor += s.duration;
  }

  const beneficiary: ScheduledBeneficiaryStep[] = program.run_of_show.beneficiary_track.map(
    (s) => {
      if (s.offset_from_reveal <= -1440) return { ...s, start: null, end: null };
      const st = reveal + s.offset_from_reveal;
      return { ...s, start: st, end: s.duration ? st + s.duration : null };
    },
  );

  const scheduled = main.filter((s) => !s.before_start && !s.after_close);
  const close = scheduled.length ? scheduled[scheduled.length - 1]!.end : start;
  basis += `. The session runs ${close - start} minutes`;

  return { start, reveal, close, basis, anchoredBackward, main, beneficiary };
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`bad date ${iso}, expected YYYY-MM-DD`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Generate the task list. Conditional tasks are dropped when their condition is
 * false, which is how "no mechanics needed, one person is coming" works.
 */
export function generateTasks(
  program: Program,
  params: EngagementParams,
  deliveryDate: string,
): GeneratedTask[] {
  const ctx = buildContext(params, program);
  const out: GeneratedTask[] = [];
  for (const rule of program.tasks) {
    if (rule.condition && !evalBoolean(rule.condition, ctx)) continue;
    out.push({
      ...rule,
      sourceKey: `${program.code}:${slug(rule.title)}`,
      dueDate: addDays(deliveryDate, rule.offset),
    });
  }
  out.sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : a.phase.localeCompare(b.phase)));

  const seen = new Set<string>();
  for (const t of out) {
    if (seen.has(t.sourceKey)) throw new Error(`duplicate task key ${t.sourceKey} in ${program.code}`);
    seen.add(t.sourceKey);
  }
  return out;
}

export function computeQuantities(program: Program, params: EngagementParams): GeneratedQuantity[] {
  const ctx = buildContext(params, program);
  return program.quantities.map((q) => ({
    item: q.item,
    qty: evalNumber(q.formula, ctx),
    basis: q.basis,
    confidence: q.confidence ?? "high",
    note: q.note,
  }));
}

/**
 * Resolve which resource blocks this engagement needs, and how much of each.
 * Vehicle rules are first-match-wins, so 13 children get a limo and 108 get
 * three buses from the same template.
 */
export function resolveResources(program: Program, params: EngagementParams): GeneratedResource[] {
  const ctx = buildContext(params, program);
  const out: GeneratedResource[] = [];
  for (const rule of program.resources) {
    if (!rule.always && rule.condition && !evalBoolean(rule.condition, ctx)) continue;
    if (!rule.always && !rule.condition) continue;

    let count: number | null = rule.count_formula ? evalNumber(rule.count_formula, ctx) : null;
    let vehicle: string | null = null;
    for (const vr of rule.vehicle_rule ?? []) {
      if (evalBoolean(vr.when, ctx)) {
        vehicle = vr.vehicle;
        count = evalNumber(vr.count_formula, ctx);
        break;
      }
    }
    out.push({
      key: rule.key,
      label: rule.label,
      count,
      vehicle,
      fields: rule.fields ?? [],
      note: rule.note,
    });
  }
  return out;
}

export interface GeneratedEngagement {
  program: Program;
  params: EngagementParams;
  deliveryDate: string;
  runOfShow: RunOfShow;
  tasks: GeneratedTask[];
  quantities: GeneratedQuantity[];
  resources: GeneratedResource[];
}

/** Everything an engagement needs, from one template and one parameter set. */
export function generateEngagement(
  program: Program,
  params: EngagementParams,
  deliveryDate: string,
  overrides: RunOfShowOverrides = {},
): GeneratedEngagement {
  for (const p of program.parameters) {
    if (p.required && params[p.key] === undefined) {
      throw new Error(`engagement is missing required parameter "${p.key}" (${p.label})`);
    }
  }
  return {
    program,
    params,
    deliveryDate,
    runOfShow: computeRunOfShow(program, params, overrides),
    tasks: generateTasks(program, params, deliveryDate),
    quantities: computeQuantities(program, params),
    resources: resolveResources(program, params),
  };
}
