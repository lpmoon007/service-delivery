import { describe, expect, it } from "vitest";

import program from "../../../programs/inspiring-minds.json";
import {
  computeQuantities,
  computeRunOfShow,
  formatTime,
  generateEngagement,
  generateTasks,
  resolveResources,
} from "../generate";
import type { EngagementParams, Program } from "../types";
import { COLOGIX, COLOGIX_DELIVERY } from "@/fixtures/known-events";

const IM = program as unknown as Program;

const pods = (params: EngagementParams) =>
  computeQuantities(IM, params).find((q) => q.item === "Pods")?.qty;

describe("the ninety minutes are fixed", () => {
  const ros = computeRunOfShow(IM, COLOGIX);

  it("runs exactly ninety minutes from the mission to the end", () => {
    const mission = ros.main.find((s) => s.id === "mission")!;
    const cont = ros.main.find((s) => s.id === "continue")!;
    expect(cont.end - mission.start).toBe(90);
  });

  it("opens the object at minute thirty, for the whole room", () => {
    const mission = ros.main.find((s) => s.id === "mission")!;
    expect(ros.reveal - mission.start).toBe(30);
  });

  it("brings the children in at minute thirty-five", () => {
    const mission = ros.main.find((s) => s.id === "mission")!;
    const enter = ros.beneficiary.find((s) => s.id === "enter")!;
    expect(enter.start! - mission.start).toBe(35);
  });

  it("keeps the children for sixty minutes after the reversal, not thirty", () => {
    const depart = ros.beneficiary.find((s) => s.id === "depart_venue")!;
    expect(depart.start! - ros.reveal).toBe(60);
  });

  it("is the same ninety minutes at two thousand participants", () => {
    const huge = computeRunOfShow(IM, { ...COLOGIX, participants: 2000, beneficiaries: 665 });
    const mission = huge.main.find((s) => s.id === "mission")!;
    const cont = huge.main.find((s) => s.id === "continue")!;
    expect(cont.end - mission.start).toBe(90);
    expect(huge.reveal - mission.start).toBe(30);
  });

  it("places the whole ninety minutes backward from a departure deadline", () => {
    const anchored = computeRunOfShow(IM, { ...COLOGIX, beneficiary_depart_by: "17:00" });
    expect(anchored.anchoredBackward).toBe(true);
    // 60 minutes back from 5:00 PM, not the 30 that Build A Dream uses.
    expect(formatTime(anchored.reveal)).toBe("4:00 PM");
    const mission = anchored.main.find((s) => s.id === "mission")!;
    expect(formatTime(mission.start)).toBe("3:30 PM");
  });
});

describe("the pod is the unit", () => {
  it("takes the pod count from whichever of adults or children needs more", () => {
    // 40 adults is 3 pods; 20 children is 4. Four wins.
    expect(pods(COLOGIX)).toBe(4);
    expect(pods({ ...COLOGIX, participants: 90, beneficiaries: 5 })).toBe(6);
  });

  it("scales stations, kits and locked objects off pods and children", () => {
    const q = (item: string) => computeQuantities(IM, COLOGIX).find((x) => x.item === item)?.qty;
    expect(q("Teams of three")).toBe(20);
    expect(q("Station tables")).toBe(20);
    expect(q("Pod locked objects")).toBe(4);
    expect(q("Child kits")).toBe(20);
    expect(q("Field books")).toBe(20);
    expect(q("Classroom collections")).toBe(1);
  });

  it("matches the published scale bands", () => {
    expect(pods({ ...COLOGIX, participants: 15, beneficiaries: 5 })).toBe(1);
    expect(pods({ ...COLOGIX, participants: 120, beneficiaries: 40 })).toBe(8);
    expect(pods({ ...COLOGIX, participants: 450, beneficiaries: 150 })).toBe(30);
    // The brochure's top band reads "500-2,000 participants, 33-133 pods". 133
    // pods of fifteen is 1,995 people, so its 133 comes from the 665-children
    // column rather than from 2,000 participants. Two thousand needs 134.
    expect(pods({ ...COLOGIX, participants: 1995, beneficiaries: 665 })).toBe(133);
    expect(pods({ ...COLOGIX, participants: 2000, beneficiaries: 665 })).toBe(134);
  });

  it("surfaces the adults-per-child ratio so a bad count is visible", () => {
    const ratio = computeQuantities(IM, COLOGIX).find((q) => q.item === "Adults per child");
    // The program is built on three to one. Cologix as stated is two to one.
    expect(ratio?.qty).toBe(2);
    const proper = computeQuantities(IM, { ...COLOGIX, participants: 60 }).find(
      (q) => q.item === "Adults per child",
    );
    expect(proper?.qty).toBe(3);
  });
});

describe("variations branch on the subject", () => {
  const titles = (params: EngagementParams) => generateTasks(IM, params, COLOGIX_DELIVERY).map((t) => t.title);

  it("The Long Current needs a dimmable room and a battery check", () => {
    const t = titles(COLOGIX);
    expect(t).toContain("Dimmable lighting confirmed for the signal station");
    expect(t).toContain("Battery check: nothing above 9V");
    expect(t).not.toContain("Water jugs confirmed, one per pod");
  });

  it("Trace Evidence needs water and not a dimmable room", () => {
    const t = titles({ ...COLOGIX, variation: "Trace Evidence" });
    expect(t).toContain("Water jugs confirmed, one per pod");
    expect(t).not.toContain("Dimmable lighting confirmed for the signal station");
    expect(t).not.toContain("Battery check: nothing above 9V");
  });

  it("Secrets Through Time needs neither", () => {
    const t = titles({ ...COLOGIX, variation: "Secrets Through Time" });
    expect(t).not.toContain("Water jugs confirmed, one per pod");
    expect(t).not.toContain("Dimmable lighting confirmed for the signal station");
  });
});

describe("scale changes what has to be arranged", () => {
  it("adds AV and pod captains above ten pods", () => {
    const small = COLOGIX;
    const big = { ...COLOGIX, participants: 450, beneficiaries: 150 };

    expect(resolveResources(IM, small).map((r) => r.key)).not.toContain("av_and_staging");
    expect(resolveResources(IM, big).map((r) => r.key)).toContain("av_and_staging");

    expect(generateTasks(IM, big, COLOGIX_DELIVERY).map((t) => t.title)).toContain(
      "Pod captains briefed in advance",
    );
  });

  it("switches the kit lead time at thirty pods", () => {
    const three = generateTasks(IM, COLOGIX, COLOGIX_DELIVERY).map((t) => t.title);
    expect(three).toContain("Kit production ordered (three-week lead)");
    expect(three).not.toContain("Kit production ordered (six to eight week lead)");

    const many = generateTasks(
      IM,
      { ...COLOGIX, participants: 2000, beneficiaries: 665 },
      COLOGIX_DELIVERY,
    ).map((t) => t.title);
    expect(many).toContain("Kit production ordered (six to eight week lead)");
    expect(many).not.toContain("Kit production ordered (three-week lead)");
  });

  it("picks child transport by headcount", () => {
    const veh = (n: number) =>
      resolveResources(IM, { ...COLOGIX, beneficiaries: n }).find(
        (r) => r.key === "child_transport",
      );
    expect(veh(5)?.vehicle).toMatch(/Van/);
    expect(veh(20)?.vehicle).toMatch(/Minibus/);
    expect(veh(150)?.count).toBe(4);
  });
});

describe("generateEngagement for Cologix", () => {
  const g = () => generateEngagement(IM, COLOGIX, COLOGIX_DELIVERY);

  it("assembles without error", () => {
    const out = g();
    expect(out.tasks.length).toBeGreaterThan(40);
    expect(out.resources.map((r) => r.key)).toEqual([
      "venue",
      "partner_org",
      "child_transport",
      "kit_production",
      "photography",
    ]);
  });

  it("refuses to generate without a variation", () => {
    const bad = { ...COLOGIX } as Record<string, unknown>;
    delete bad.variation;
    expect(() => generateEngagement(IM, bad as EngagementParams, COLOGIX_DELIVERY)).toThrow(
      /missing required parameter "variation"/,
    );
  });

  it("sorts every task by due date", () => {
    const dates = g().tasks.map((t) => t.dueDate);
    expect(dates).toEqual([...dates].sort());
  });
});
