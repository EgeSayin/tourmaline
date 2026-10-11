"use client";

import { FormInput, FormSection, FormStateProvider } from "@/components/forms/form-fields";
import { Button } from "@/components/ui/button";
import { WEEKDAYS } from "@/lib/recurrence";
import { type FocusCaps, focusCapField } from "@/lib/settings";
import { WEEKDAY_NAMES } from "@/lib/time/format";
import { useFormAction } from "@/hooks/use-form-action";
import { saveFocusCapsAction } from "@/server/settings/actions";

/** Edits the most time to fill each weekday with, in hours. */
export function FocusCapForm({ focusCaps }: { focusCaps: FocusCaps }) {
  const { state, values, errors, pending, onSubmit } = useFormAction(
    saveFocusCapsAction,
    Object.fromEntries(
      WEEKDAYS.map((weekday) => {
        const cap = focusCaps[weekday - 1];
        return [focusCapField(weekday), cap === null ? "" : String(cap / 60)];
      }),
    ),
  );

  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-4">
      <FormStateProvider values={values} errors={errors}>
        <FormSection title="Focus cap">
          <p className="text-sm text-muted-foreground">
            The most hours of fixed items and task blocks to plan into each day. Tasks go over it only to finish before
            their deadline. Leave a day empty for no cap.
          </p>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
            {WEEKDAYS.map((weekday) => (
              <FormInput
                key={weekday}
                name={focusCapField(weekday)}
                label={WEEKDAY_NAMES[weekday - 1]}
                type="number"
                inputMode="decimal"
                min={0}
                max={24}
                step={0.25}
                placeholder="–"
              />
            ))}
          </div>
        </FormSection>
      </FormStateProvider>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {state.status === "saved" && !pending && (
          <p role="status" className="text-sm text-muted-foreground">
            Saved. Blocks are planned again under the new caps.
          </p>
        )}
      </div>
    </form>
  );
}
