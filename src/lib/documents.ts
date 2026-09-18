/**
 * Generated documents beyond the coordination doc.
 *
 * The beneficiary coordination letter is the first of these: the note that goes
 * to the club or school telling them when to arrive, how many children to
 * pick, what to bring and who keeps custody. It was previously written by hand
 * for every event, which is how a letter ends up saying 6:00 PM while the run
 * of show says 7:00.
 *
 * Bodies are plain text with {{token}} placeholders, interpolated against a
 * context computed from the engagement. Unknown tokens are left visible as
 * [[missing: token]] rather than rendered as an empty string, because a letter
 * that silently drops the arrival time is worse than one that shows a gap.
 */

import { evalBoolean } from "./expr";
import { buildContext, formatTime, parseTime, type GeneratedEngagement } from "./generate";
import type { DocumentSection, ProgramDocument } from "./types";

const LONG_DATE = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export type DocContext = Record<string, string>;

function stepTime(g: GeneratedEngagement, id: string, which: "start" | "end"): string | null {
  const s = g.runOfShow.main.find((x) => x.id === id);
  if (s) return formatTime(which === "start" ? s.start : s.end);
  const b = g.runOfShow.beneficiary.find((x) => x.id === id);
  if (b && b.start !== null) return formatTime(which === "end" && b.end !== null ? b.end : b.start);
  return null;
}

/** Everything a document body may refer to. */
export function buildDocContext(g: GeneratedEngagement): DocContext {
  const ctx: DocContext = {};

  // Declared defaults first, so a letter still reads correctly for an
  // engagement created before a parameter existed.
  for (const p of g.program.parameters) {
    if (p.default !== undefined && p.default !== null) ctx[p.key] = String(p.default);
  }

  for (const [k, v] of Object.entries(g.params)) {
    if (v === null || v === undefined) continue;
    ctx[k] = String(v);
  }

  ctx.name = g.program.name;
  ctx.program_code = g.program.code;

  for (const p of g.program.parameters) {
    if (p.type !== "time") continue;
    const raw = ctx[p.key];
    if (!raw) continue;
    try {
      ctx[p.key] = formatTime(parseTime(raw));
    } catch {
      // Leave an unparseable value visible rather than hiding it.
    }
  }

  ctx.delivery_date = LONG_DATE.format(new Date(`${g.deliveryDate}T00:00:00Z`));
  ctx.reveal = formatTime(g.runOfShow.reveal);
  ctx.event_start_time = formatTime(g.runOfShow.start);
  ctx.close_time = formatTime(g.runOfShow.close);

  for (const id of ["arrive_venue", "depart_venue", "enter", "gear", "return", "sizing"]) {
    const t = stepTime(g, id, "start");
    if (t) ctx[`${id}_time`] = t;
  }

  // Quantities the letter quotes, so it cannot contradict the materials table.
  for (const q of g.quantities) {
    ctx[`qty_${q.item.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`] = String(q.qty);
  }

  const derived = buildContext(g.params, g.program);
  for (const [k, v] of Object.entries(derived)) {
    if (!(k in ctx)) ctx[k] = String(v);
  }

  return ctx;
}

const TOKEN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function interpolate(text: string, ctx: DocContext): string {
  return text.replace(TOKEN, (_, key: string) =>
    Object.prototype.hasOwnProperty.call(ctx, key) ? ctx[key]! : `[[missing: ${key}]]`,
  );
}

/** Which tokens a document still cannot fill. Surfaced so gaps are visible. */
export function missingTokens(doc: ProgramDocument, ctx: DocContext): string[] {
  const missing = new Set<string>();
  const scan = (t: string) => {
    for (const m of t.matchAll(TOKEN)) {
      const key = m[1]!;
      if (!Object.prototype.hasOwnProperty.call(ctx, key)) missing.add(key);
    }
  };
  if (doc.greeting) scan(doc.greeting);
  for (const s of doc.sections) {
    if (s.heading) scan(s.heading);
    s.body?.forEach(scan);
    s.bullets?.forEach(scan);
  }
  doc.signoff?.forEach(scan);
  return [...missing].sort();
}

export interface RenderedSection {
  heading?: string;
  body: string[];
  bullets: string[];
  ordered: boolean;
}

export interface RenderedDocument {
  key: string;
  title: string;
  audience: string;
  purpose?: string;
  greeting?: string;
  sections: RenderedSection[];
  signoff: string[];
  missing: string[];
}

function include(section: DocumentSection, g: GeneratedEngagement): boolean {
  if (!section.condition) return true;
  try {
    return evalBoolean(section.condition, buildContext(g.params, g.program));
  } catch {
    // A condition referring to a parameter this engagement does not have means
    // the section does not apply. Dropping it is right; crashing is not.
    return false;
  }
}

export function renderDocument(
  doc: ProgramDocument,
  g: GeneratedEngagement,
): RenderedDocument {
  const ctx = buildDocContext(g);
  const fill = (t: string) => interpolate(t, ctx);

  return {
    key: doc.key,
    title: fill(doc.title),
    audience: doc.audience,
    purpose: doc.purpose,
    greeting: doc.greeting ? fill(doc.greeting) : undefined,
    sections: doc.sections.filter((s) => include(s, g)).map((s) => ({
      heading: s.heading ? fill(s.heading) : undefined,
      body: (s.body ?? []).map(fill),
      bullets: (s.bullets ?? []).map(fill),
      ordered: s.ordered ?? false,
    })),
    signoff: (doc.signoff ?? []).map(fill),
    missing: missingTokens(doc, ctx),
  };
}

export function findDocument(
  g: GeneratedEngagement,
  key: string,
): RenderedDocument | null {
  const doc = g.program.documents?.find((d) => d.key === key);
  return doc ? renderDocument(doc, g) : null;
}
