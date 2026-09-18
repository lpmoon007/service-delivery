import { describe, expect, it } from "vitest";

import program from "../../../programs/build-a-dream.json";
import {
  computeQuantities,
  computeRunOfShow,
  formatTime,
  generateEngagement,
  generateTasks,
  parseTime,
  resolveResources,
} from "../generate";
import type { Program, RunOfShow } from "../types";
import {
  DEVRY,
  DEVRY_DELIVERY,
  DEVRY_MAIN,
  DEVRY_OVERRIDES,
  DEVRY_STATED,
  LEDGEBROOK,
  LEDGEBROOK_BENEFICIARY,
  LEDGEBROOK_DELIVERY,
  LEDGEBROOK_MAIN,
} from "@/fixtures/known-events";

const BAD = program as unknown as Program;

describe("time helpers", () => {
  it("round-trips", () => {
    expect(formatTime(parseTime("15:15"))).toBe("3:15 PM");
    expect(formatTime(parseTime("08:45"))).toBe("8:45 AM");
    expect(formatTime(parseTime("00:00"))).toBe("12:00 AM");
    expect(formatTime(parseTime("12:00"))).toBe("12:00 PM");
  });

  it("rejects malformed and out-of-range times", () => {
    expect(() => parseTime("5pm")).toThrow(/expected HH:MM/);
    expect(() => parseTime("25:00")).toThrow(/out of range/);
    expect(() => parseTime("10:61")).toThrow(/out of range/);
  });
});

describe("Ledgebrook, 2026-09-16: backward-anchored schedule", () => {
  const ros = computeRunOfShow(BAD, LEDGEBROOK);

  it("pins the reveal 30 minutes before the children must leave", () => {
    expect(ros.anchoredBackward).toBe(true);
    expect(formatTime(ros.reveal)).toBe("4:30 PM");
  });

  it("derives participant arrival by working backward from the reveal", () => {
    expect(formatTime(ros.start)).toBe("3:15 PM");
  });

  it.each(Object.entries(LEDGEBROOK_MAIN))(
    "main track %s matches the source document",
    (id, [start, end]) => {
      const step = ros.main.find((s) => s.id === id);
      expect(step, `step ${id} missing`).toBeDefined();
      expect([formatTime(step!.start), formatTime(step!.end)]).toEqual([start, end]);
    },
  );

  it.each(Object.entries(LEDGEBROOK_BENEFICIARY))(
    "children's track %s matches the source document",
    (id, at) => {
      const step = ros.beneficiary.find((s) => s.id === id);
      expect(step, `step ${id} missing`).toBeDefined();
      expect(step!.start).not.toBeNull();
      expect(formatTime(step!.start!)).toBe(at);
    },
  );

  it("closes at 5:30 PM", () => {
    expect(formatTime(ros.close)).toBe("5:30 PM");
  });

  it("moving the departure deadline moves the whole pre-reveal chain", () => {
    const later = computeRunOfShow(BAD, { ...LEDGEBROOK, beneficiary_depart_by: "18:00" });
    expect(formatTime(later.reveal)).toBe("5:30 PM");
    expect(formatTime(later.start)).toBe("4:15 PM");
    // the shape is unchanged, only the offset
    expect(later.reveal - later.start).toBe(ros.reveal - ros.start);
  });
});

describe("DeVry, 2011-12-09: forward-run schedule", () => {
  const ros = computeRunOfShow(BAD, DEVRY, DEVRY_OVERRIDES);

  it("runs forward from arrival when there is no departure deadline", () => {
    expect(ros.anchoredBackward).toBe(false);
    expect(formatTime(ros.start)).toBe("8:45 AM");
  });

  it.each(Object.entries(DEVRY_MAIN))(
    "main track %s matches the source document",
    (id, [start, end]) => {
      const step = ros.main.find((s) => s.id === id);
      expect(step, `step ${id} missing`).toBeDefined();
      expect([formatTime(step!.start), formatTime(step!.end)]).toEqual([start, end]);
    },
  );

  it("drops the steps the 2011 program did not run", () => {
    expect(ros.main.map((s) => s.id)).not.toContain("photo");
    expect(ros.main.map((s) => s.id)).not.toContain("reset");
  });
});

describe("conditional resources", () => {
  it("gives 13 children a limo and 108 children buses", () => {
    const small = resolveResources(BAD, LEDGEBROOK).find((r) => r.key === "transportation");
    const large = resolveResources(BAD, DEVRY).find((r) => r.key === "transportation");
    expect(small?.count).toBe(1);
    expect(small?.vehicle).toMatch(/Limousine/);
    expect(large?.count).toBe(DEVRY_STATED.buses);
    expect(large?.vehicle).toMatch(/bus/i);
  });

  it("matches the technician count stated on the DeVry agenda", () => {
    const res = resolveResources(BAD, DEVRY).find((r) => r.key === "technicians");
    expect(res?.count).toBe(DEVRY_STATED.mechanics);
  });

  it("needs only one technician for Ledgebrook", () => {
    const res = resolveResources(BAD, LEDGEBROOK).find((r) => r.key === "technicians");
    expect(res?.count).toBe(1);
  });

  it("adds a materials vehicle only above 20 beneficiaries", () => {
    const keys = (p: typeof LEDGEBROOK) => resolveResources(BAD, p).map((r) => r.key);
    expect(keys(DEVRY)).toContain("materials_transport");
    expect(keys(LEDGEBROOK)).not.toContain("materials_transport");
  });

  it("drops post-event delivery when the children take the bikes home", () => {
    const keys = resolveResources(BAD, { ...LEDGEBROOK, bikes_go_home_same_day: true }).map(
      (r) => r.key,
    );
    expect(keys).not.toContain("post_event_delivery");
  });

  it("drops transportation entirely when beneficiaries do not travel", () => {
    const keys = resolveResources(BAD, { ...LEDGEBROOK, beneficiary_travels: false }).map(
      (r) => r.key,
    );
    expect(keys).not.toContain("transportation");
  });
});

describe("quantities", () => {
  const q = (params: typeof LEDGEBROOK, item: string) =>
    computeQuantities(BAD, params).find((x) => x.item === item)?.qty;

  it("orders one bicycle per child plus two spares, matching DeVry's 110", () => {
    expect(q(DEVRY, "Bicycles")).toBe(DEVRY_STATED.bikes);
    expect(q(LEDGEBROOK, "Bicycles")).toBe(15);
  });

  it("scales gear with beneficiaries and tooling with teams", () => {
    expect(q(LEDGEBROOK, "Helmets")).toBe(13);
    expect(q(LEDGEBROOK, "Tool sets")).toBe(13);
    expect(q(LEDGEBROOK, "Build tables")).toBe(13);
  });

  it("matches DeVry's stated brief-sheet count", () => {
    expect(q(DEVRY, "Client brief sheets")).toBe(DEVRY_STATED.briefSheets);
  });

  it("flags the quantities that were inferred rather than documented", () => {
    const low = computeQuantities(BAD, LEDGEBROOK).filter((x) => x.confidence !== "high");
    expect(low.map((x) => x.item).sort()).toEqual([
      "Client brief sheets",
      "Floor pumps",
      "Holding-room activity kits",
      "On-site technicians",
    ]);
  });
});

describe("task generation", () => {
  it("dates every task relative to delivery and sorts ascending", () => {
    const tasks = generateTasks(BAD, LEDGEBROOK, LEDGEBROOK_DELIVERY);
    const dates = tasks.map((t) => t.dueDate);
    expect(dates).toEqual([...dates].sort());
    expect(tasks.find((t) => t.title === "Delivery day")?.dueDate).toBe("2026-09-16");
    expect(tasks.find((t) => t.title === "Signed agreement / SOW returned")?.dueDate).toBe(
      "2026-08-17",
    );
    expect(tasks.find((t) => t.title === "Final payment received")?.dueDate).toBe("2026-10-16");
  });

  it("drops the materials-vehicle task for a small event", () => {
    const small = generateTasks(BAD, LEDGEBROOK, LEDGEBROOK_DELIVERY).map((t) => t.title);
    const large = generateTasks(BAD, DEVRY, DEVRY_DELIVERY).map((t) => t.title);
    expect(large).toContain("Materials vehicle booked");
    expect(small).not.toContain("Materials vehicle booked");
    expect(large.length).toBe(small.length + 1);
  });

  it("keeps the transportation task that the Ledgebrook document omitted", () => {
    const titles = generateTasks(BAD, LEDGEBROOK, LEDGEBROOK_DELIVERY).map((t) => t.title);
    expect(titles).toContain(
      "Beneficiary transportation booked, confirmation number recorded",
    );
  });

  it("drops consent tasks when beneficiaries are not minors", () => {
    const titles = generateTasks(
      BAD,
      { ...LEDGEBROOK, beneficiary_minors: false },
      LEDGEBROOK_DELIVERY,
    ).map((t) => t.title);
    expect(titles).not.toContain("Chaperone count and parental consent confirmed");
  });

  it("produces stable unique keys so regeneration updates instead of duplicating", () => {
    const a = generateTasks(BAD, LEDGEBROOK, LEDGEBROOK_DELIVERY);
    const b = generateTasks(BAD, LEDGEBROOK, "2026-10-19");
    expect(new Set(a.map((t) => t.sourceKey)).size).toBe(a.length);
    expect(a.map((t) => t.sourceKey).sort()).toEqual(b.map((t) => t.sourceKey).sort());
  });
});

describe("generateEngagement", () => {
  it("assembles everything for Ledgebrook", () => {
    const g = generateEngagement(BAD, LEDGEBROOK, LEDGEBROOK_DELIVERY);
    expect(g.tasks.length).toBe(47);
    expect(g.resources.length).toBe(6);
    expect(g.quantities.length).toBe(11);
    expect(formatTime(g.runOfShow.reveal)).toBe("4:30 PM");
  });

  it("assembles everything for DeVry", () => {
    const g = generateEngagement(BAD, DEVRY, DEVRY_DELIVERY, DEVRY_OVERRIDES);
    expect(g.tasks.length).toBe(48);
    expect(g.resources.length).toBe(7);
  });

  it("refuses an engagement missing a required parameter", () => {
    const bad = { ...LEDGEBROOK } as Record<string, unknown>;
    delete bad.beneficiaries;
    expect(() => generateEngagement(BAD, bad as typeof LEDGEBROOK, LEDGEBROOK_DELIVERY)).toThrow(
      /missing required parameter "beneficiaries"/,
    );
  });
});

describe("session length", () => {
  const scheduled = (ros: ReturnType<typeof computeRunOfShow>) =>
    ros.main.filter((s) => !s.before_start && !s.after_close);

  it("leaves the schedule alone when no length is asked for", () => {
    // The guarantee that makes this feature safe to add: Ledgebrook's real
    // clock times cannot move because an unset length runs no arithmetic.
    const ros = computeRunOfShow(BAD, LEDGEBROOK);
    expect(ros.close - ros.start).toBe(135);
    expect(formatTime(ros.reveal)).toBe("4:30 PM");
  });

  it.each([90, 105, 120, 150, 180])("lands exactly on %i minutes", (minutes) => {
    const ros = computeRunOfShow(BAD, { ...LEDGEBROOK, session_minutes: minutes });
    expect(scheduled(ros).reduce((n, s) => n + s.duration, 0)).toBe(minutes);
    expect(ros.close - ros.start).toBe(minutes);
  });

  it("keeps fixed steps at their template length at any duration", () => {
    for (const minutes of [90, 120, 180]) {
      const ros = computeRunOfShow(BAD, { ...LEDGEBROOK, session_minutes: minutes });
      for (const s of scheduled(ros)) {
        if (!s.fixed) continue;
        const declared = BAD.run_of_show.main_track.find((t) => t.id === s.id)!.duration;
        expect(s.duration, `${s.id} at ${minutes} minutes`).toBe(declared);
      }
    }
  });

  it("spends a longer session on the content block, the build and the debrief", () => {
    const natural = computeRunOfShow(BAD, LEDGEBROOK);
    const long = computeRunOfShow(BAD, { ...LEDGEBROOK, session_minutes: 180 });
    const by = (ros: RunOfShow, id: string) => ros.main.find((s) => s.id === id)!.duration;
    for (const id of ["content", "build", "debrief"]) {
      expect(by(long, id), id).toBeGreaterThan(by(natural, id));
    }
  });

  it("still pins the reveal to the departure deadline", () => {
    // Shortening the session moves the start, never the reveal: the children
    // leaving at 5:00 is the fact everything else is computed from.
    const ros = computeRunOfShow(BAD, { ...LEDGEBROOK, session_minutes: 90 });
    expect(formatTime(ros.reveal)).toBe("4:30 PM");
    expect(formatTime(ros.start)).toBe("3:40 PM");
  });

  it("holds every elastic step at or above its declared minimum", () => {
    const ros = computeRunOfShow(BAD, { ...LEDGEBROOK, session_minutes: 90 });
    for (const s of scheduled(ros)) {
      if (s.fixed) continue;
      const declared = BAD.run_of_show.main_track.find((t) => t.id === s.id)!;
      expect(s.duration, `${s.id}`).toBeGreaterThanOrEqual(declared.min ?? 1);
    }
  });

  it("cascades the minimums rather than overshooting the target", () => {
    // The naive single pass gets this wrong. At 90 minutes the build's
    // proportional share is 15 but its minimum is 18, and pinning it there
    // spends slack the other steps were counting on. Handled in one pass the
    // total comes out at 93; the water-filling loop lands it on 90.
    const ros = computeRunOfShow(BAD, { ...LEDGEBROOK, session_minutes: 90 });
    const by = (id: string) => ros.main.find((s) => s.id === id)!.duration;
    expect(by("build")).toBe(18);
    expect(by("present")).toBe(8);
    expect(by("content")).toBe(12);
    expect(by("debrief")).toBe(7);
  });

  it("refuses a length below the floor and names it", () => {
    expect(() => computeRunOfShow(BAD, { ...LEDGEBROOK, session_minutes: 60 })).toThrow(
      /60 minutes is below this program's floor of 88/,
    );
  });

  it("refuses a program with nothing elastic to give", () => {
    const rigid: Program = {
      ...BAD,
      run_of_show: {
        ...BAD.run_of_show,
        main_track: BAD.run_of_show.main_track.map((s) =>
          s.before_start || s.after_close ? s : { ...s, fixed: true },
        ),
      },
    };
    expect(() => computeRunOfShow(rigid, { ...LEDGEBROOK, session_minutes: 120 })).toThrow(
      /no elastic steps.*fixed at 135/s,
    );
  });

  it("treats an explicit duration override as the starting point for the fit", () => {
    // Override then fit, not fit then override: a coordinator who lengthens the
    // build by hand has changed the proportions the fit works from.
    const ros = computeRunOfShow(
      BAD,
      { ...LEDGEBROOK, session_minutes: 150 },
      { durations: { build: 60 } },
    );
    const by = (id: string) => ros.main.find((s) => s.id === id)!.duration;
    expect(ros.close - ros.start).toBe(150);
    expect(by("build")).toBeGreaterThan(by("content"));
  });
});
