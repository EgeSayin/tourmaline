"use client";

import { useState } from "react";
import { FormDurationInput, FormSection, FormStateProvider } from "@/components/forms/form-fields";
import { DowntimeBands } from "@/components/schedule/downtime-bands";
import { HourAxis } from "@/components/schedule/hour-axis";
import { hourLines, timeScale } from "@/components/schedule/time-scale";
import { DOWNTIME_STEPS, fromSteps, toSteps } from "@/lib/downtime";
import { WEEKDAYS } from "@/lib/recurrence";
import { downtimeField, focusCapField, type SchedulerSettings } from "@/lib/settings";
import { WEEKDAY_NAMES } from "@/lib/time/format";
import { toTimeInputValue } from "@/lib/time/time-of-day";
import { useFormAction } from "@/hooks/use-form-action";
import { saveWeekSettingsAction } from "@/server/settings/actions";
import { SaveRow } from "./save-row";

/** The whole day, small enough to fit a phone screen, so painting never has to scroll. */
const SCALE = timeScale(0, 24, 24);

interface Cell {
  day: number;
  step: number;
}

/** A press and drag: every step in the rectangle from `from` to `to` becomes downtime, or stops being it. */
interface Stroke {
  from: Cell;
  to: Cell;
  paint: boolean;
}

function applyStroke(steps: boolean[][], { from, to, paint }: Stroke): boolean[][] {
  const [firstDay, lastDay] = [Math.min(from.day, to.day), Math.max(from.day, to.day)];
  const [firstStep, lastStep] = [Math.min(from.step, to.step), Math.max(from.step, to.step)];
  return steps.map((day, index) =>
    index < firstDay || index > lastDay
      ? day
      : day.map((down, step) => (step >= firstStep && step <= lastStep ? paint : down)),
  );
}

/** Found from the point rather than the event target: a touch keeps targeting the element it started on. */
function cellAt(event: React.PointerEvent): Cell | null {
  const column = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-day]");
  if (!column) return null;
  const rect = column.getBoundingClientRect();
  const step = Math.floor(((event.clientY - rect.top) / rect.height) * DOWNTIME_STEPS);
  return { day: Number(column.dataset.day), step: Math.min(Math.max(step, 0), DOWNTIME_STEPS - 1) };
}

export function WeekSettingsForm({ downtime, focusCaps }: Pick<SchedulerSettings, "downtime" | "focusCaps">) {
  const { state, values, errors, pending, onSubmit } = useFormAction(
    saveWeekSettingsAction,
    Object.fromEntries(
      WEEKDAYS.map((weekday) => {
        const cap = focusCaps[weekday - 1];
        return [focusCapField(weekday), cap === null ? "" : String(cap)];
      }),
    ),
  );
  const [steps, setSteps] = useState(() => downtime.map(toSteps));
  const [stroke, setStroke] = useState<Stroke | null>(null);
  const shown = stroke ? applyStroke(steps, stroke) : steps;

  const strokeHandlers = {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      const cell = cellAt(event);
      if (!cell) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      setStroke({ from: cell, to: cell, paint: !steps[cell.day][cell.step] });
    },
    onPointerMove: (event: React.PointerEvent) => {
      const cell = stroke && cellAt(event);
      if (cell && (cell.day !== stroke.to.day || cell.step !== stroke.to.step)) setStroke({ ...stroke, to: cell });
    },
    onPointerUp: (event: React.PointerEvent) => {
      if (stroke) setSteps(applyStroke(steps, { ...stroke, to: cellAt(event) ?? stroke.to }));
      setStroke(null);
    },
    onPointerCancel: () => setStroke(null),
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormStateProvider values={values} errors={errors}>
        <FormSection title="Week">
          <p className="text-sm text-muted-foreground">
            Paint downtime by pressing and dragging; tasks are never planned in it. Drag from painted time to clear it.
            Under each day is its focus cap, like 6h: the most time of fixed items and task blocks to plan into it.
            Tasks go over it only to finish before their deadline. Leave it empty for no cap.
          </p>
          <div
            className="grid overflow-hidden rounded-xl border bg-card [--axis:2.75rem] md:[--axis:3.5rem]"
            style={{ gridTemplateColumns: "var(--axis) repeat(7, minmax(0, 1fr))" }}
          >
            <div
              aria-hidden
              className="flex items-end justify-end border-b pr-1 pb-2 text-right text-[11px] leading-tight text-muted-foreground md:pr-2 md:pb-3"
            >
              Focus cap
            </div>
            {WEEKDAYS.map((weekday) => (
              <div key={weekday} className="border-b border-l p-1 text-center md:p-2">
                <FormDurationInput
                  name={focusCapField(weekday)}
                  label={WEEKDAY_NAMES[weekday - 1]}
                  placeholder="–"
                  className="px-1 text-center"
                />
              </div>
            ))}
            <HourAxis scale={SCALE} />
            {shown.map((day, index) => {
              const ranges = fromSteps(day);
              return (
                <div
                  key={index}
                  role="group"
                  aria-label={`${WEEKDAY_NAMES[index]} downtime`}
                  data-day={index}
                  className="relative cursor-pointer touch-none border-l select-none"
                  style={hourLines(SCALE, 2)}
                  {...strokeHandlers}
                >
                  <DowntimeBands ranges={ranges} scale={SCALE} />
                  <span className="sr-only">
                    {ranges.length > 0
                      ? ranges
                          .map((range) => `${toTimeInputValue(range.startMinute)}–${toTimeInputValue(range.endMinute)}`)
                          .join(", ")
                      : "None"}
                  </span>
                  <input type="hidden" name={downtimeField(index + 1)} value={day.map(Number).join("")} />
                </div>
              );
            })}
          </div>
        </FormSection>
      </FormStateProvider>
      <SaveRow label="Save" pending={pending} saved={state.status === "saved"} message="Saved." />
    </form>
  );
}
