import { describe, expect, it } from "vitest";

import program from "../../../programs/build-a-dream.json";
import { buildDocContext, interpolate, renderDocument } from "../documents";
import { generateEngagement } from "../generate";
import type { Program } from "../types";
import { LEDGEBROOK, LEDGEBROOK_DELIVERY } from "@/fixtures/known-events";

const BAD = program as unknown as Program;

/** Ledgebrook as the coordination letter actually described it. */
const WITH_LETTER_DATA = {
  ...LEDGEBROOK,
  beneficiary_contact_name: "Greg",
  client_descriptor: "An insurance company",
  beneficiary_transport_by: "the Boys & Girls Club",
  greeter_name: "Katie Dunlavy",
  venue_name: "Tampa Marriott Water Street",
  venue_address: "505 Water Street, Tampa, FL 33602",
  venue_phone: "(813) 221-4900",
};

const g = () => generateEngagement(BAD, WITH_LETTER_DATA, LEDGEBROOK_DELIVERY);
const letter = () => renderDocument(BAD.documents![0]!, g());

describe("interpolation", () => {
  it("fills known tokens", () => {
    expect(interpolate("Hello {{who}}, {{ n }} bikes", { who: "Greg", n: "13" })).toBe(
      "Hello Greg, 13 bikes",
    );
  });

  it("makes an unknown token visible instead of blank", () => {
    // A letter that silently drops the arrival time is worse than one showing a gap.
    expect(interpolate("arrive at {{nope}}", {})).toBe("arrive at [[missing: nope]]");
  });

  it("does not resolve inherited property names", () => {
    expect(interpolate("{{constructor}} {{__proto__}}", {})).toBe(
      "[[missing: constructor]] [[missing: __proto__]]",
    );
  });
});

describe("document context", () => {
  const ctx = buildDocContext(g());

  it("carries the engagement's own values", () => {
    expect(ctx.beneficiaries).toBe("13");
    expect(ctx.participants).toBe("75");
    expect(ctx.beneficiary_org).toBe("Garcia-Salesian Club");
  });

  it("applies declared defaults for parameters the engagement never set", () => {
    expect(ctx.age_min).toBe("8");
    expect(ctx.age_max).toBe("12");
    expect(ctx.wheel_size_in).toBe("20");
  });

  it("formats times for reading, not for storage", () => {
    expect(ctx.bike_delivery_eta).toBe("6:00 PM");
    expect(ctx.reveal).toBe("4:30 PM");
  });

  it("takes the children's times from the generated schedule", () => {
    expect(ctx.arrive_venue_time).toBe("3:45 PM");
    expect(ctx.depart_venue_time).toBe("5:00 PM");
  });

  it("quotes quantities from the same source as the materials table", () => {
    expect(ctx.qty_bicycles).toBe("15");
    expect(ctx.qty_helmets).toBe("13");
  });
});

describe("beneficiary coordination letter", () => {
  it("renders with no missing tokens once the letter fields are filled", () => {
    expect(letter().missing).toEqual([]);
  });

  it("names the recipient and the organization", () => {
    const l = letter();
    expect(l.greeting).toBe("Hello Greg,");
    expect(l.title).toBe("Garcia-Salesian Club coordination letter");
  });

  it("states the counts and the age range the bicycles depend on", () => {
    const text = letter()
      .sections.flatMap((s) => [...s.body, ...s.bullets])
      .join(" ");
    expect(text).toContain("13 bicycles for 13 children");
    expect(text).toContain("between 8 and 12 years old (20 inch bicycles)");
    expect(text).toContain("75 leaders");
  });

  it("quotes the reveal and departure from the generated run of show", () => {
    const text = letter().sections.flatMap((s) => s.body).join(" ");
    expect(text).toContain("approximately 4:30 PM");
    expect(text).toContain("on their way by approximately 5:00 PM");
  });

  it("moves with the schedule instead of going stale", () => {
    const later = renderDocument(
      BAD.documents![0]!,
      generateEngagement(
        BAD,
        { ...WITH_LETTER_DATA, beneficiary_depart_by: "18:00" },
        LEDGEBROOK_DELIVERY,
      ),
    );
    const text = later.sections.flatMap((s) => s.body).join(" ");
    expect(text).toContain("approximately 5:30 PM");
    expect(text).not.toContain("4:30 PM");
  });

  it("drops the bicycle-delivery section when the children take them home", () => {
    const sameDay = renderDocument(
      BAD.documents![0]!,
      generateEngagement(
        BAD,
        { ...WITH_LETTER_DATA, bikes_go_home_same_day: true },
        LEDGEBROOK_DELIVERY,
      ),
    );
    const headings = sameDay.sections.map((s) => s.heading);
    expect(headings).not.toContain("AFTER THE EVENT: TRANSPORTATION OF BIKES");
  });

  it("drops the custody note when the beneficiaries are not minors", () => {
    const adults = renderDocument(
      BAD.documents![0]!,
      generateEngagement(
        BAD,
        { ...WITH_LETTER_DATA, beneficiary_minors: false },
        LEDGEBROOK_DELIVERY,
      ),
    );
    expect(adults.sections.map((s) => s.heading)).not.toContain("A NOTE ON THE CHILDREN");
  });

  it("drops paragraphs and drawings when they are not wanted", () => {
    const plain = renderDocument(
      BAD.documents![0]!,
      generateEngagement(
        BAD,
        { ...WITH_LETTER_DATA, want_paragraphs: false, want_drawings: false },
        LEDGEBROOK_DELIVERY,
      ),
    );
    const headings = plain.sections.map((s) => s.heading);
    expect(headings).not.toContain("PARAGRAPHS");
    expect(headings).not.toContain("DRAWINGS");
  });

  it("shows a gap rather than a blank when the contact is unknown", () => {
    const bare = renderDocument(
      BAD.documents![0]!,
      generateEngagement(BAD, LEDGEBROOK, LEDGEBROOK_DELIVERY),
    );
    expect(bare.missing).toContain("beneficiary_contact_name");
    expect(bare.greeting).toContain("[[missing: beneficiary_contact_name]]");
  });
});

describe("tasks the letter implies", () => {
  it("schedules the letter itself and the information it asks for", () => {
    const titles = g().tasks.map((t) => t.title);
    expect(titles).toContain("Coordination letter sent to the beneficiary organization");
    expect(titles).toContain("Child first names and ages received");
    expect(titles).toContain("Accompanying staff names received");
    expect(titles).toContain("Holding room confirmed and sent to the beneficiary organization");
  });

  it("drops the paragraphs task when neither paragraphs nor drawings are wanted", () => {
    const titles = generateEngagement(
      BAD,
      { ...WITH_LETTER_DATA, want_paragraphs: false, want_drawings: false },
      LEDGEBROOK_DELIVERY,
    ).tasks.map((t) => t.title);
    expect(titles).not.toContain("Paragraphs and drawings requested");
  });
});
