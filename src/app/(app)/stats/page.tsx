import { connection } from "next/server";
import { FormSection } from "@/components/forms/form-fields";
import { CategoryTime } from "@/components/stats/category-time";
import { FollowThrough } from "@/components/stats/follow-through";
import { Workspace } from "@/components/workspace/workspace";
import { formatDuration } from "@/lib/time/format";
import { readWorkspace } from "@/server/workspaces/current-workspace";
import { loadStats } from "@/server/stats";

export default async function Stats() {
  await connection();
  const stats = await readWorkspace((tx, now) => loadStats(tx, now));
  // Weeks before the first task block say nothing.
  const first = stats.weeks.findIndex((week) => week.doneMin + week.missedMin + week.unreviewedMin > 0);
  const weeks = first === -1 ? [] : stats.weeks.slice(first);
  const sum = (minutes: (week: (typeof weeks)[number]) => number) =>
    weeks.reduce((sum, week) => sum + minutes(week), 0);
  const [done, missed, unreviewed] = [sum((w) => w.doneMin), sum((w) => w.missedMin), sum((w) => w.unreviewedMin)];

  return (
    <Workspace
      page="stats"
      main={
        <>
          <h1 className="text-lg font-semibold tracking-tight">Stats</h1>
          {weeks.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
              Nothing yet: stats start once planned task blocks have passed.
            </p>
          ) : (
            <div className="flex max-w-3xl flex-col gap-8">
              <p className="text-sm text-muted-foreground">
                {done + missed === 0 ? (
                  "No block reviewed yet."
                ) : (
                  <>
                    {weeks.length === 1 ? "This week" : `Over the last ${weeks.length} weeks`}, you did{" "}
                    <span className="font-medium text-foreground">{Math.round((done / (done + missed)) * 100)}%</span>{" "}
                    of the task time you reviewed.
                  </>
                )}
                {unreviewed > 0 && ` ${formatDuration(unreviewed)} is still to review.`}
              </p>
              <FormSection title="Planned task time, by week">
                <FollowThrough weeks={weeks} />
              </FormSection>
              {stats.categories.length > 0 && (
                <FormSection title="Done task time, by category">
                  <CategoryTime entries={stats.categories} />
                </FormSection>
              )}
            </div>
          )}
        </>
      }
    />
  );
}
