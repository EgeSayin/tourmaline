"use client";

import { startTransition, useActionState } from "react";
import { FormInput, FormSection, FormStateProvider } from "@/components/forms/form-fields";
import { Button } from "@/components/ui/button";
import { WEEKDAYS } from "@/lib/recurrence";
import { type FocusCaps, focusCapField } from "@/lib/settings";
import { WEEKDAY_NAMES } from "@/lib/time/format";
import { type FocusCapsFormState, saveFocusCapsAction } from "@/server/settings/actions";

/** Edits the most time to fill each weekday with, in hours. */
export function FocusCapForm({ focusCaps }: { focusCaps: FocusCaps }) {
  const [state, formAction, pending] = useActionState<FocusCapsFormState, FormData>(saveFocusCapsAction, {
    status: "idle",
  });
  const invalid = state.status === "invalid" ? state : null;
  const values =
    invalid?.fields ??
    Object.fromEntries(
      WEEKDAYS.map((weekday) => {
        const cap = focusCaps[weekday - 1];
        return [focusCapField(weekday), cap === null ? "" : String(cap / 60)];
      }),
    );

  return (
    <form
      // Not `action`: React resets a form after its action.
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="flex max-w-xl flex-col gap-4"
    >
      <FormStateProvider values={values} errors={invalid?.errors ?? {}}>
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
