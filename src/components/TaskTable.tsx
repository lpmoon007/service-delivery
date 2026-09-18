"use client";

import { setTaskStatus } from "@/lib/actions";
import type { EngagementTaskRow, TaskStatus } from "@/lib/db-types";
import { Feedback, useAction } from "./ActionFeedback";

const LABELS: Record<TaskStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
  na: "N/A",
};

const SHORT_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function flag(dueDate: string, status: TaskStatus, today: string): string {
  if (status === "done" || status === "na") return "";
  if (dueDate < today) return "OVERDUE";
  const soon = new Date(`${today}T00:00:00Z`);
  soon.setUTCDate(soon.getUTCDate() + 7);
  if (dueDate <= soon.toISOString().slice(0, 10)) return "THIS WEEK";
  return "";
}

function TaskRow({
  engagementId,
  task,
  today,
}: {
  engagementId: string;
  task: EngagementTaskRow;
  today: string;
}) {
  const { pending, result, run } = useAction();
  const mark = flag(task.due_date, task.status, today);
  const done = task.status === "done" || task.status === "na";

  return (
    <tr className={mark === "OVERDUE" ? "row-overdue" : mark === "THIS WEEK" ? "row-soon" : ""}>
      <td className="t">{SHORT_DATE.format(new Date(`${task.due_date}T00:00:00Z`))}</td>
      <td>{task.phase}</td>
      <td className={done ? "struck" : ""}>{task.title}</td>
      <td>{task.role}</td>
      <td className="ctr">
        <strong>{mark}</strong>
      </td>
      <td>
        <select
          aria-label={`Status for ${task.title}`}
          value={task.status}
          disabled={pending}
          onChange={(e) => run(() => setTaskStatus(engagementId, task.id, e.target.value))}
        >
          {(Object.keys(LABELS) as TaskStatus[]).map((s) => (
            <option key={s} value={s}>
              {LABELS[s]}
            </option>
          ))}
        </select>
        <Feedback result={result?.ok ? null : result} pending={pending} />
      </td>
    </tr>
  );
}

export function TaskTable({
  engagementId,
  tasks,
  today,
}: {
  engagementId: string;
  tasks: EngagementTaskRow[];
  today: string;
}) {
  if (tasks.length === 0) {
    return (
      <p className="band">
        No tasks yet. Use <strong>Regenerate</strong> on the edit page to build them from the
        program template.
      </p>
    );
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Due</th>
          <th>Phase</th>
          <th>Task</th>
          <th>Owner</th>
          <th className="ctr">Flag</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((t) => (
          <TaskRow key={t.id} engagementId={engagementId} task={t} today={today} />
        ))}
      </tbody>
    </table>
  );
}
