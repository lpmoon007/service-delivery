"use client";

import { saveEngagement, regenerate } from "@/lib/actions";
import type { EngagementRow, EngagementStatus } from "@/lib/db-types";
import type { Program } from "@/lib/types";
import { Feedback, useAction } from "./ActionFeedback";

const STATUSES: EngagementStatus[] = [
  "planning",
  "confirmed",
  "delivered",
  "closed",
  "cancelled",
];

/**
 * The inputs are generated from the program's declared parameters, so adding a
 * program is still a JSON file and never a form to write.
 */
export function EngagementForm({
  row,
  program,
}: {
  row: EngagementRow;
  program: Program;
}) {
  const save = useAction();
  const regen = useAction();
  const params = (row.params ?? {}) as Record<string, unknown>;

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          save.run(() => saveEngagement(row.id, fd));
        }}
      >
        <h2>Engagement</h2>
        <div className="grid">
          <label>
            <span>Client name</span>
            <input name="client_name" defaultValue={row.client_name} required />
          </label>
          <label>
            <span>Delivery date</span>
            <input type="date" name="delivery_date" defaultValue={row.delivery_date} required />
          </label>
          <label>
            <span>Status</span>
            <select name="status" defaultValue={row.status}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Venue name</span>
            <input name="venue_name" defaultValue={row.venue_name ?? ""} />
          </label>
          <label>
            <span>Venue address</span>
            <input name="venue_address" defaultValue={row.venue_address ?? ""} />
          </label>
        </div>

        <h2>{program.name} parameters</h2>
        <p className="band">
          Changing a count or a date re-dates every task and recomputes every quantity. Saving
          regenerates the timeline automatically; task status is preserved.
        </p>
        <div className="grid">
          {program.parameters.map((p) => {
            const v = params[p.key];
            if (p.type === "bool") {
              return (
                <label key={p.key} className="check">
                  <input
                    type="checkbox"
                    name={`param.${p.key}`}
                    defaultChecked={v === true}
                  />
                  <span>{p.label}</span>
                </label>
              );
            }
            return (
              <label key={p.key}>
                <span>
                  {p.label}
                  {p.required && <span className="req"> required</span>}
                </span>
                <input
                  name={`param.${p.key}`}
                  inputMode={p.type === "int" || p.type === "number" ? "numeric" : undefined}
                  placeholder={p.type === "time" ? "15:15" : undefined}
                  defaultValue={v === null || v === undefined ? "" : String(v)}
                />
              </label>
            );
          })}
        </div>

        <label className="wide">
          <span>Notes</span>
          <textarea name="notes" rows={3} defaultValue={row.notes ?? ""} />
        </label>

        <button type="submit" disabled={save.pending}>
          Save and regenerate
        </button>
        <Feedback result={save.result} pending={save.pending} />
      </form>

      <h2>Regenerate only</h2>
      <p className="band">
        Rebuilds tasks, resource slots and cost lines from the current template without changing
        anything above. Use this after the program JSON itself changes.
      </p>
      <button
        type="button"
        className="secondary"
        disabled={regen.pending}
        onClick={() => regen.run(() => regenerate(row.id))}
      >
        Regenerate from template
      </button>
      <Feedback result={regen.result} pending={regen.pending} />
    </>
  );
}
