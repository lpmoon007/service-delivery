/**
 * The logistics and coordination doc.
 *
 * Rendered from the generated engagement, so it cannot drift from the task
 * timeline the way a hand-authored document does. Structured after the DeVry
 * 2011 agenda, which is still the best version of this artifact: resource
 * blocks with vendor, contact and confirmation number, a materials table with
 * quantities, then both run-of-show tracks.
 */

import { formatTime } from "@/lib/generate";
import type { CostLine, GeneratedResource, Visibility } from "@/lib/types";
import type { GeneratedEngagement } from "@/lib/generate";

const LONG_DATE = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const SHORT_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function fmtDate(iso: string, f = LONG_DATE): string {
  return f.format(new Date(`${iso}T00:00:00Z`));
}

function labelize(field: string): string {
  const s = field.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function ToFill() {
  return <span className="fill">to be filled</span>;
}

function ResourceBlock({
  resource,
  values,
  beneficiaries,
}: {
  resource: GeneratedResource;
  values: Record<string, string | undefined>;
  beneficiaries: number;
}) {
  return (
    <section>
      <h2>{resource.label}</h2>
      {resource.vehicle ? (
        <p className="band">
          <strong>Computed requirement:</strong> {resource.count} &times; {resource.vehicle} for{" "}
          {beneficiaries} {beneficiaries === 1 ? "beneficiary" : "beneficiaries"}.
        </p>
      ) : resource.count !== null ? (
        <p className="band">
          <strong>Computed requirement:</strong> {resource.count}
        </p>
      ) : null}
      {resource.note && <p className="warn">{resource.note}</p>}
      <table>
        <tbody>
          {resource.fields.map((f) => (
            <tr key={f}>
              <th scope="row">{labelize(f)}</th>
              <td>{values[`${resource.key}.${f}`] || <ToFill />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export interface CoordinationDocProps {
  engagement: GeneratedEngagement;
  /** Free-text values keyed "resourceKey.fieldName". */
  resourceValues?: Record<string, string | undefined>;
  costs?: Record<string, { amount?: number; note?: string }>;
  /** 'contractor' hides owner-only cost lines. This is a presentation guard;
   *  the database enforces the same rule with row-level security. */
  audience?: Visibility;
}

export function CoordinationDoc({
  engagement,
  resourceValues = {},
  costs = {},
  audience = "contractor",
}: CoordinationDocProps) {
  const { program, params, deliveryDate, runOfShow, tasks, quantities, resources } = engagement;
  const visibleCosts: CostLine[] = program.cost_lines.filter(
    (c) => audience === "owner" || c.visibility === "contractor",
  );

  return (
    <article className="doc">
      <header>
        <h1>
          {params.client} &middot; {program.name}
        </h1>
        <p className="sub">
          Logistics and coordination &middot; {fmtDate(deliveryDate)} &middot;{" "}
          {String(params.venue_name ?? "venue to be confirmed")}
        </p>
      </header>

      <p className="band">
        <strong>Timing constraint.</strong> {runOfShow.basis}. Change the constraint and every
        time on this page moves with it.
      </p>

      <section>
        <h2>Event overview</h2>
        <table>
          <tbody>
            {(
              [
                ["Date", fmtDate(deliveryDate)],
                ["Participant arrival", formatTime(runOfShow.start)],
                ["Reveal", formatTime(runOfShow.reveal)],
                ["Close", formatTime(runOfShow.close)],
                ["Venue", params.venue_name as string | undefined],
                ["Venue address", params.venue_address as string | undefined],
                ["Client sponsor", params.sponsor as string | undefined],
                ["Facilitator", (params.facilitator as string | undefined) ?? "James Carter"],
                ["Participants", String(params.participants)],
                ["Teams", String(params.teams)],
                ["Beneficiaries", String(params.beneficiaries)],
                ["Beneficiary organization", params.beneficiary_org as string | undefined],
              ] as const
            ).map(([k, v]) => (
              <tr key={k}>
                <th scope="row">{k}</th>
                <td>{v || <span className="fill">to be confirmed</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {resources.map((r) => (
        <ResourceBlock
          key={r.key}
          resource={r}
          values={resourceValues}
          beneficiaries={params.beneficiaries}
        />
      ))}

      <section>
        <h2>Materials</h2>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th className="n">Qty</th>
              <th>Basis</th>
            </tr>
          </thead>
          <tbody>
            {quantities.map((q) => (
              <tr key={q.item}>
                <td>
                  {q.item}
                  {q.confidence !== "high" && (
                    <span className={`tag ${q.confidence}`}>confirm {q.confidence === "low" ? "ratio" : "basis"}</span>
                  )}
                </td>
                <td className="n">{q.qty}</td>
                <td>
                  {q.basis}
                  {q.note && <p className="det">{q.note}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Run of show &middot; main room</h2>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Main room</th>
            </tr>
          </thead>
          <tbody>
            {runOfShow.main.map((s) => (
              <tr key={s.id}>
                <td className="t">
                  {formatTime(s.start)} &ndash; {formatTime(s.end)}
                </td>
                <td>
                  <strong>{s.label}</strong>
                  {s.details?.map((d) => (
                    <p className="det" key={d}>
                      {d}
                    </p>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Run of show &middot; beneficiary track</h2>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Beneficiary track</th>
            </tr>
          </thead>
          <tbody>
            {runOfShow.beneficiary.map((s) => (
              <tr key={s.id}>
                <td className="t">
                  {s.start === null ? (
                    <span className="fill">day before</span>
                  ) : (
                    <>
                      {formatTime(s.start)}
                      {s.end !== null && <> &ndash; {formatTime(s.end)}</>}
                    </>
                  )}
                </td>
                <td>{s.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Task timeline</h2>
        <table>
          <thead>
            <tr>
              <th>Due</th>
              <th>Phase</th>
              <th>Task</th>
              <th>Owner</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.sourceKey}>
                <td className="t">{fmtDate(t.dueDate, SHORT_DATE)}</td>
                <td>{t.phase}</td>
                <td>
                  {t.title}
                  {t.note && <p className="det">{t.note}</p>}
                </td>
                <td>{t.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Event costs</h2>
        <p className="band">
          {audience === "contractor"
            ? "Contractor view. Vendor and contractor costs only; client fee and margin are not shown."
            : "Owner view. Includes client fee and margin."}
        </p>
        <table>
          <thead>
            <tr>
              <th>Line</th>
              <th className="n">Amount</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {visibleCosts.map((c) => {
              const row = costs[c.key];
              return (
                <tr key={c.key}>
                  <td>{c.label}</td>
                  <td className="n">
                    {typeof row?.amount === "number" ? (
                      `$${row.amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
                    ) : (
                      <ToFill />
                    )}
                  </td>
                  <td>{row?.note ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <footer className="foot">
        Be Legendary &middot; REPARIO LTD., INC dba Be Legendary &middot; 1502 S. Vona Ct,
        Superior, CO 80027 &middot; T 800-513-8759 &middot; W BuildingTeams.com
        <br />
        Generated from program template <strong>{program.code}</strong>. Times are computed, not
        hand-entered.
      </footer>
    </article>
  );
}
