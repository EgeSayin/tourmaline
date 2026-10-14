"use client";

import { FormSection, FormStateProvider } from "@/components/forms/form-fields";
import { WeekPainter } from "@/components/forms/week-painter";
import { downtimeField, type SchedulerSettings } from "@/lib/settings";
import { useFormAction } from "@/hooks/use-form-action";
import { saveWeekSettingsAction } from "@/server/settings/actions";
import { SaveRow } from "./save-row";

export function WeekSettingsForm({ downtime }: Pick<SchedulerSettings, "downtime">) {
  const { state, values, errors, pending, onSubmit } = useFormAction(saveWeekSettingsAction, {});

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormStateProvider values={values} errors={errors}>
        <FormSection title="Week">
          <p className="text-sm text-muted-foreground">
            Paint downtime by pressing and dragging; tasks are never planned in it. Drag from painted time to clear it.
            With the keyboard, arrows move, Space paints or clears, and Shift with arrows paints a rectangle.
          </p>
          <WeekPainter initial={downtime} fieldName={downtimeField} painted="downtime" />
        </FormSection>
      </FormStateProvider>
      <SaveRow label="Save" pending={pending} saved={state.status === "saved"} message="Saved." />
    </form>
  );
}
