"use client";

import { useState } from "react";

import { createEngagement } from "@/lib/actions";
import type { ProgramChoice } from "@/lib/db";
import { Feedback, useAction } from "./ActionFeedback";
import { ProgramParamFields } from "./ProgramParamFields";

/**
 * Add a client: name them, pick the service, set the date, answer whatever that
 * service asks for. Choosing a different service swaps the parameter fields,
 * because each program declares its own.
 */
export function NewEngagementForm({ programs }: { programs: ProgramChoice[] }) {
  const [programId, setProgramId] = useState(programs[0]?.id ?? "");
  const { pending, result, run } = useAction();
  const chosen = programs.find((p) => p.id === programId);

  if (programs.length === 0) {
    return (
      <p className="warn">
        No services in the catalog yet, so there is nothing to book a client onto. A service is a
        JSON file in <code>programs/</code>, loaded into the <code>programs</code> table.
      </p>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        run(() => createEngagement(fd));
      }}
    >
      <h2>Client and service</h2>
      <div className="grid">
        <label>
          <span>
            Client name<span className="req"> required</span>
          </span>
          <input name="client_name" required disabled={pending} />
        </label>
        <label>
          <span>
            Service<span className="req"> required</span>
          </span>
          <select
            name="program_id"
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            disabled={pending}
          >
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>
            Delivery date<span className="req"> required</span>
          </span>
          <input type="date" name="delivery_date" required disabled={pending} />
        </label>
        <label>
          <span>Venue name</span>
          <input name="venue_name" disabled={pending} />
        </label>
        <label>
          <span>Venue address</span>
          <input name="venue_address" disabled={pending} />
        </label>
        <label>
          <span>HubSpot deal id</span>
          <input name="hubspot_deal_id" disabled={pending} />
        </label>
      </div>

      {chosen?.summary && <p className="band">{chosen.summary}</p>}

      <h2>{chosen?.name ?? "Service"} details</h2>
      <ProgramParamFields parameters={chosen?.parameters ?? []} disabled={pending} />

      <label className="wide">
        <span>Notes</span>
        <textarea name="notes" rows={3} disabled={pending} />
      </label>

      <button type="submit" disabled={pending}>
        Create and build the timeline
      </button>
      <Feedback result={result} pending={pending} />
    </form>
  );
}
