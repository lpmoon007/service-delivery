"use client";

import { saveCosts } from "@/lib/actions";
import type { EngagementCostRow } from "@/lib/db-types";
import { Feedback, useAction } from "./ActionFeedback";

export function CostEditor({
  engagementId,
  costs,
}: {
  engagementId: string;
  costs: EngagementCostRow[];
}) {
  const { pending, result, run } = useAction();

  // Only contractor-visible lines are editable here. The database enforces the
  // same rule; this just keeps the form honest about it.
  const editable = costs.filter((c) => c.visibility === "contractor");
  const total = editable.reduce((n, c) => n + (c.amount ?? 0), 0);

  if (editable.length === 0) {
    return <p className="band">No cost lines yet. Regenerate to create them.</p>;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        run(() => saveCosts(engagementId, fd));
      }}
    >
      <table>
        <thead>
          <tr>
            <th>Line</th>
            <th className="n">Amount (USD)</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {editable.map((c) => (
            <tr key={c.id}>
              <td>
                <input type="hidden" name="id" value={c.id} />
                {c.label}
              </td>
              <td className="n">
                <input
                  name={`amount.${c.id}`}
                  inputMode="decimal"
                  className="num"
                  defaultValue={c.amount === null ? "" : String(c.amount)}
                  disabled={pending}
                />
              </td>
              <td>
                <input name={`note.${c.id}`} defaultValue={c.note ?? ""} disabled={pending} />
              </td>
            </tr>
          ))}
          <tr>
            <td>
              <strong>Direct cost so far</strong>
            </td>
            <td className="n">
              <strong>${total.toLocaleString("en-US", { maximumFractionDigits: 0 })}</strong>
            </td>
            <td className="det">Saved values only; edits above are not counted until saved.</td>
          </tr>
        </tbody>
      </table>
      <button type="submit" disabled={pending}>
        Save costs
      </button>
      <Feedback result={result} pending={pending} />
    </form>
  );
}
