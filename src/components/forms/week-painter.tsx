"use client";

import { useRef, useState } from "react";
import { DowntimeBands } from "@/components/schedule/downtime-bands";
import { HourAxis } from "@/components/schedule/hour-axis";
import { hourLines, timeScale } from "@/components/schedule/time-scale";
import { WEEKDAYS, type Weekday } from "@/lib/recurrence";
import { DAY_STEP_MIN, DAY_STEPS, fromSteps, toSteps } from "@/lib/time/day-steps";
import { WEEKDAY_NAMES } from "@/lib/time/format";
import { toTimeInputValue, type WeeklyRanges } from "@/lib/time/time-of-day";

/** The whole day, small enough to fit a phone screen, so painting never has to scroll. */
const SCALE = timeScale(0, 24, 24);

interface Cell {
  day: number;
  step: number;
}

/** A press and drag: every step in the rectangle from `from` to `to` becomes painted, or stops being it. */
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
      : day.map((painted, step) => (step >= firstStep && step <= lastStep ? paint : painted)),
  );
}

/** Found from the point rather than the event target: a touch keeps targeting the element it started on. */
function cellAt(event: React.PointerEvent): Cell | null {
  const column = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-day]");
  if (!column) return null;
  const rect = column.getBoundingClientRect();
  const step = Math.floor(((event.clientY - rect.top) / rect.height) * DAY_STEPS);
  return { day: Number(column.dataset.day), step: Math.min(Math.max(step, 0), DAY_STEPS - 1) };
}

const MOVES: Record<string, Cell> = {
  ArrowUp: { day: 0, step: -1 },
  ArrowDown: { day: 0, step: 1 },
  ArrowLeft: { day: -1, step: 0 },
  ArrowRight: { day: 1, step: 0 },
};

const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);

/**
 * A week of days to paint ranges on with the pointer (press and drag) or the keyboard (arrows, Space, Shift+arrows),
 * submitted per weekday as `fieldName(weekday)` (see `fromSteps`). `painted` names what painted time is, e.g.
 * "downtime".
 */
export function WeekPainter({
  initial,
  fieldName,
  painted,
}: {
  initial: WeeklyRanges;
  fieldName: (weekday: Weekday) => string;
  painted: string;
}) {
  const [steps, setSteps] = useState(() => initial.map(toSteps));
  const [stroke, setStroke] = useState<Stroke | null>(null);
  const shown = stroke ? applyStroke(steps, stroke) : steps;
  // The keyboard's cell, starting on Monday at 09:00; the columns take turns holding the tab stop.
  const [cursor, setCursor] = useState<Cell>({ day: 0, step: (9 * 60) / DAY_STEP_MIN });
  const columns = useRef<(HTMLDivElement | null)[]>([]);
  const toggled = (cell: Cell): Stroke => ({ from: cell, to: cell, paint: !steps[cell.day][cell.step] });

  const keyHandlers = {
    onKeyDown: (event: React.KeyboardEvent) => {
      const move = MOVES[event.key];
      if (move) {
        event.preventDefault();
        const next = { day: clamp(cursor.day + move.day, 6), step: clamp(cursor.step + move.step, DAY_STEPS - 1) };
        if (event.shiftKey) setStroke({ ...(stroke ?? toggled(cursor)), to: next });
        setCursor(next);
        columns.current[next.day]?.focus();
      } else if (event.key === " ") {
        event.preventDefault();
        setSteps(applyStroke(steps, toggled(cursor)));
      } else if (event.key === "Escape") {
        setStroke(null);
      }
    },
    // A Shift+arrow stroke is painted once Shift is let go.
    onKeyUp: (event: React.KeyboardEvent) => {
      if (event.key !== "Shift" || !stroke) return;
      setSteps(applyStroke(steps, stroke));
      setStroke(null);
    },
  };
  const cursorPainted = shown[cursor.day][cursor.step];

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
    <>
      <div
        className="grid overflow-hidden rounded-xl border bg-card [--axis:2.75rem] md:[--axis:3.5rem]"
        style={{ gridTemplateColumns: "var(--axis) repeat(7, minmax(0, 1fr))" }}
      >
        <HourAxis scale={SCALE} />
        {shown.map((day, index) => {
          const ranges = fromSteps(day);
          return (
            <div
              key={index}
              ref={(column) => {
                columns.current[index] = column;
              }}
              role="group"
              aria-label={`${WEEKDAY_NAMES[index]} ${painted}`}
              data-day={index}
              tabIndex={index === cursor.day ? 0 : -1}
              className="group relative cursor-pointer touch-none border-l outline-none select-none"
              style={hourLines(SCALE, 2)}
              {...strokeHandlers}
              {...keyHandlers}
            >
              <DowntimeBands ranges={ranges} scale={SCALE} />
              {index === cursor.day && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 hidden ring-2 ring-ring group-focus-visible:block"
                  style={{
                    top: SCALE.top(cursor.step * DAY_STEP_MIN),
                    height: SCALE.hourHeight / (60 / DAY_STEP_MIN),
                  }}
                />
              )}
              <span className="sr-only">
                {ranges.length > 0
                  ? ranges
                      .map((range) => `${toTimeInputValue(range.startMinute)}–${toTimeInputValue(range.endMinute)}`)
                      .join(", ")
                  : "None"}
              </span>
              <input type="hidden" name={fieldName(WEEKDAYS[index])} value={day.map(Number).join("")} />
            </div>
          );
        })}
      </div>
      <p aria-live="polite" className="sr-only">
        {`${WEEKDAY_NAMES[cursor.day]} ${toTimeInputValue(cursor.step * DAY_STEP_MIN)}–${toTimeInputValue((cursor.step + 1) * DAY_STEP_MIN)}, ${cursorPainted ? painted : "free"}`}
      </p>
    </>
  );
}
