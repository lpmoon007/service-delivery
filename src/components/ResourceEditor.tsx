"use client";

import { saveResource } from "@/lib/actions";
import type { EngagementResourceRow } from "@/lib/db-types";
import { Feedback, useAction } from "./ActionFeedback";

function labelize(field: string): string {
  const s = field.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function ResourceEditor({
  engagementId,
  resource,
  fieldNames,
}: {
  engagementId: string;
  resource: EngagementResourceRow;
  /** Field list from the program template, so the form matches the program. */
  fieldNames: string[];
}) {
  const { pending, result, run } = useAction();
  const values = resource.fields ?? {};

  return (
    <section>
      <h3>
        {resource.label}
        {resource.computed_note && <span className="tag">needs {resource.computed_note}</span>}
      </h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          run(() => saveResource(engagementId, resource.id, fd));
        }}
      >
        <div className="grid">
          {fieldNames.map((f) => (
            <label key={f}>
              <span>{labelize(f)}</span>
              <input name={`field.${f}`} defaultValue={values[f] ?? ""} disabled={pending} />
            </label>
          ))}
          <label>
            <span>Cost (USD)</span>
            <input
              name="__cost"
              inputMode="decimal"
              defaultValue={resource.cost === null ? "" : String(resource.cost)}
              disabled={pending}
            />
          </label>
        </div>
        <button type="submit" disabled={pending}>
          Save {resource.label.toLowerCase()}
        </button>
        <Feedback result={result} pending={pending} />
      </form>
    </section>
  );
}
