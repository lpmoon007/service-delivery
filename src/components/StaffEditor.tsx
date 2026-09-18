"use client";

import { useRef } from "react";

import { addStaff, removeStaff } from "@/lib/actions";
import type { EngagementStaffRow } from "@/lib/db-types";
import { Feedback, useAction } from "./ActionFeedback";

/**
 * Who is working the delivery, by name. Separate from who can sign in: most of
 * these people never get an account.
 */
export function StaffEditor({
  engagementId,
  staff,
}: {
  engagementId: string;
  staff: EngagementStaffRow[];
}) {
  const add = useAction();
  const remove = useAction();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      {staff.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Email</th>
              <th>Phone</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id}>
                <td>
                  {s.name}
                  {s.is_lead && <span className="tag">lead</span>}
                </td>
                <td>{s.role ?? ""}</td>
                <td>{s.email ?? ""}</td>
                <td>{s.phone ?? ""}</td>
                <td>
                  <button
                    type="button"
                    className="linkish"
                    disabled={remove.pending}
                    onClick={() => remove.run(() => removeStaff(engagementId, s.id))}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Feedback result={remove.result?.ok ? null : remove.result} pending={remove.pending} />

      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          add.run(async () => {
            const r = await addStaff(engagementId, fd);
            if (r.ok) formRef.current?.reset();
            return r;
          });
        }}
      >
        <div className="grid">
          <label>
            <span>
              Name<span className="req"> required</span>
            </span>
            <input name="name" required disabled={add.pending} />
          </label>
          <label>
            <span>Role</span>
            <input
              name="role"
              list="staff-roles"
              placeholder="facilitator"
              disabled={add.pending}
            />
            <datalist id="staff-roles">
              <option value="facilitator" />
              <option value="coordinator" />
              <option value="logistics" />
              <option value="technician" />
              <option value="photographer" />
              <option value="client sponsor" />
              <option value="venue contact" />
              <option value="chaperone" />
            </datalist>
          </label>
          <label>
            <span>Email</span>
            <input name="email" type="email" disabled={add.pending} />
          </label>
          <label>
            <span>Phone</span>
            <input name="phone" disabled={add.pending} />
          </label>
          <label className="check">
            <input type="checkbox" name="is_lead" disabled={add.pending} />
            <span>Lead on the day</span>
          </label>
        </div>
        <button type="submit" disabled={add.pending}>
          Add to crew
        </button>
        <Feedback result={add.result} pending={add.pending} />
      </form>
    </>
  );
}
