"use client";

import { FormDurationInput, FormSection, FormStateProvider } from "@/components/forms/form-fields";
import { WeekPainter } from "@/components/forms/week-painter";
import { WEEKDAYS } from "@/lib/recurrence";
import { downtimeField, focusCapField, type SchedulerSettings } from "@/lib/settings";
import { WEEKDAY_NAMES } from "@/lib/time/format";
import { useFormAction } from "@/hooks/use-form-action";
import { saveWeekSettingsAction } from "@/server/settings/actions";
import { SaveRow } from "./save-row";

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

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormStateProvider values={values} errors={errors}>
        <FormSection title="Week">
          <p className="text-sm text-muted-foreground">
            Paint downtime by pressing and dragging; tasks are never planned in it. Drag from painted time to clear it.
            With the keyboard, arrows move, Space paints or clears, and Shift with arrows paints a rectangle. Under each
            day is its focus cap, like 6h: the most time of fixed items and task blocks to plan into it. Tasks go over
            it only to finish before their deadline. Leave it empty for no cap.
          </p>
          <WeekPainter
            initial={downtime}
            fieldName={downtimeField}
            painted="downtime"
            top={{
              label: "Focus cap",
              cell: (weekday) => (
                <FormDurationInput
                  name={focusCapField(weekday)}
                  label={WEEKDAY_NAMES[weekday - 1]}
                  placeholder="–"
                  className="px-1 text-center"
                />
              ),
            }}
          />
        </FormSection>
      </FormStateProvider>
      <SaveRow label="Save" pending={pending} saved={state.status === "saved"} message="Saved." />
    </form>
  );
}
