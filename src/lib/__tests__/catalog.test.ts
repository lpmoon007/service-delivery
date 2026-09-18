import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { generateEngagement } from "../generate";
import type { EngagementParams, Program } from "../types";

const DIR = join(import.meta.dirname, "..", "..", "..", "programs");

const PROGRAMS: Program[] = readdirSync(DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(DIR, f), "utf8")) as Program);

/** A minimal viable engagement per program, so every template is exercised. */
const SAMPLES: Record<string, EngagementParams> = {
  BAD: {
    client: "Sample", program: "BAD", participants: 75, teams: 13, beneficiaries: 13,
    beneficiary_org: "Club", beneficiary_minors: true, beneficiary_travels: true,
    bikes_go_home_same_day: false, event_start: "15:15", beneficiary_depart_by: "17:00",
  },
  IM: {
    client: "Sample", program: "IM", variation: "Trace Evidence", format: "Department day",
    participants: 60, teams: 0, beneficiaries: 20, partner_orgs: 1, beneficiary_org: "School",
    beneficiary_minors: true, beneficiary_travels: true, event_start: "13:00",
    beneficiary_depart_by: null,
  } as unknown as EngagementParams,
  HW: {
    client: "Sample", program: "HW", participants: 60, teams: 10, beneficiaries: 8,
    beneficiary_org: "Rescue", beneficiary_travels: true, event_start: "14:00",
    beneficiary_depart_by: "16:00",
  } as unknown as EngagementParams,
  GOB: {
    client: "Sample", program: "GOB", participants: 60, teams: 12, beneficiaries: 12,
    beneficiary_org: "Youth Club", beneficiary_minors: true, beneficiary_travels: true,
    event_start: "09:00",
  } as unknown as EngagementParams,
  "60S": {
    client: "Sample", program: "60S", participants: 200, teams: 20, beneficiaries: 0,
    causes: 3, rounds: 8, donation_per_win: 250, beneficiary_org: "Food Bank",
    event_start: "10:00",
  } as unknown as EngagementParams,
};

describe("the program catalog", () => {
  it("has the five experiences", () => {
    expect(PROGRAMS.map((p) => p.code).sort()).toEqual(["60S", "BAD", "GOB", "HW", "IM"]);
  });

  it("uses unique codes and names", () => {
    expect(new Set(PROGRAMS.map((p) => p.code)).size).toBe(PROGRAMS.length);
    expect(new Set(PROGRAMS.map((p) => p.name)).size).toBe(PROGRAMS.length);
  });

  it("has a sample engagement for every program", () => {
    // Without this, a new program could be added and never exercised.
    for (const p of PROGRAMS) expect(SAMPLES[p.code], `no sample for ${p.code}`).toBeDefined();
  });
});

describe.each(PROGRAMS.map((p) => [p.code, p] as const))("%s", (code, program) => {
  const params = SAMPLES[code]!;
  const g = () => generateEngagement(program, params, "2026-11-10");

  it("declares exactly one anchor step", () => {
    const anchors = program.run_of_show.main_track.filter((s) => s.is_anchor);
    expect(anchors).toHaveLength(1);
  });

  it("names its anchor in anchor_rule and explains the timing", () => {
    expect(program.run_of_show.anchor_rule.length).toBeGreaterThan(40);
  });

  it("generates without throwing", () => {
    expect(() => g()).not.toThrow();
  });

  it("produces tasks in every phase from Lock to Close", () => {
    const phases = new Set(g().tasks.map((t) => t.phase));
    for (const p of ["1. Lock", "2. Design", "3. Produce", "4. Deliver", "5. Close"]) {
      expect(phases, `${code} has no ${p} task`).toContain(p);
    }
  });

  it("sorts tasks by due date and keys them uniquely", () => {
    const tasks = g().tasks;
    expect(tasks.map((t) => t.dueDate)).toEqual([...tasks.map((t) => t.dueDate)].sort());
    expect(new Set(tasks.map((t) => t.sourceKey)).size).toBe(tasks.length);
  });

  it("computes every quantity to a finite number", () => {
    for (const q of g().quantities) {
      expect(Number.isFinite(q.qty), `${code}: ${q.item} is ${q.qty}`).toBe(true);
    }
  });

  it("flags every quantity it inferred rather than read from a source", () => {
    // The catalogue-derived programs guess more than the documented ones. What
    // matters is that a guess is never presented as fact.
    for (const q of g().quantities) {
      if (q.confidence !== "high") {
        expect(q.note ?? q.basis, `${code}: ${q.item} is ${q.confidence} with no note`).toBeTruthy();
      }
    }
  });

  it("resolves at least a venue and gives every resource a label", () => {
    const res = g().resources;
    expect(res.map((r) => r.key)).toContain("venue");
    for (const r of res) expect(r.label.length).toBeGreaterThan(0);
  });

  it("has one owner-only client fee and margin line", () => {
    const owner = program.cost_lines.filter((c) => c.visibility === "owner").map((c) => c.key);
    expect(owner).toEqual(["client_fee", "margin"]);
  });

  it("closes the loop: a final payment task exists", () => {
    expect(g().tasks.map((t) => t.title)).toContain("Final payment received");
  });

  it("offers a session length and says what the natural one is", () => {
    const p = program.parameters.find((q) => q.key === "session_minutes");
    expect(p, `${code} has no session_minutes parameter`).toBeDefined();
    expect(p!.required, "a blank length must mean the natural length").toBeFalsy();
    const scheduled = program.run_of_show.main_track.filter(
      (s) => !s.before_start && !s.after_close,
    );
    const natural = scheduled.reduce((n, s) => n + s.duration, 0);
    expect(p!.help, `${code} help must state its natural length`).toContain(`${natural} minutes`);
  });

  it("classifies every scheduled step as fixed or gives it a minimum", () => {
    // An unclassified step is silently elastic with a one-minute floor, which
    // is how a five-minute reveal ends up scaled to fourteen.
    for (const s of program.run_of_show.main_track) {
      if (s.before_start || s.after_close) continue;
      const classified = s.fixed === true || typeof s.min === "number";
      expect(classified, `${code}: step "${s.id}" is neither fixed nor has a min`).toBe(true);
      if (typeof s.min === "number") {
        expect(s.min, `${code}: ${s.id} min exceeds its natural length`).toBeLessThanOrEqual(
          s.duration,
        );
      }
    }
  });

  it.each([90, 120, 180])("fits a %i-minute session exactly", (minutes) => {
    const ros = generateEngagement(program, { ...params, session_minutes: minutes }, "2026-11-10")
      .runOfShow;
    const scheduled = ros.main.filter((s) => !s.before_start && !s.after_close);
    expect(scheduled.reduce((n, s) => n + s.duration, 0)).toBe(minutes);
    for (const s of scheduled) {
      expect(s.duration, `${code}: ${s.id} at ${minutes} minutes`).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("derived values fail loudly", () => {
  it("names the derived key, its formula and the missing parameter", () => {
    const broken: Program = {
      ...PROGRAMS.find((p) => p.code === "BAD")!,
      derived: { nonsense: "beneficiaries + missing_thing" },
    };
    expect(() => generateEngagement(broken, SAMPLES.BAD!, "2026-11-10")).toThrow(
      /derived value "nonsense".*missing_thing/s,
    );
  });
});
