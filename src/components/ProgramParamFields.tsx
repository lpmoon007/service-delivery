"use client";

import type { ProgramParameter } from "@/lib/types";

/**
 * Inputs for a program's declared parameters.
 *
 * Shared by the create and edit forms. A parameter added to a program's JSON
 * shows up in both immediately, which is the whole point of programs being
 * data: adding a service must never mean writing a form.
 */
export function ProgramParamFields({
  parameters,
  values = {},
  disabled = false,
}: {
  parameters: ProgramParameter[];
  values?: Record<string, unknown>;
  disabled?: boolean;
}) {
  if (parameters.length === 0) {
    return <p className="band">This service declares no parameters.</p>;
  }

  return (
    <div className="grid">
      {parameters.map((p) => {
        const v = values[p.key] ?? p.default;

        if (p.type === "bool") {
          return (
            <label key={p.key} className="check">
              <input
                type="checkbox"
                name={`param.${p.key}`}
                defaultChecked={v === true}
                disabled={disabled}
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
              type={p.type === "int" || p.type === "number" ? "number" : "text"}
              min={p.type === "int" || p.type === "number" ? 0 : undefined}
              step={p.type === "int" ? 1 : undefined}
              placeholder={p.type === "time" ? "09:00 (24-hour)" : undefined}
              defaultValue={v === null || v === undefined ? "" : String(v)}
              disabled={disabled}
            />
          </label>
        );
      })}
    </div>
  );
}
