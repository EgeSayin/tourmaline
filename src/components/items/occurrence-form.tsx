"use client";

import { ActionButton } from "@/components/forms/action-button";
import { FormInput, FormStateProvider } from "@/components/forms/form-fields";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { occurrenceToFormValues } from "@/lib/item-form";
import { isFixed } from "@/lib/items";
import type { TimeZone } from "@/lib/time/time-zone";
import { useFormAction } from "@/hooks/use-form-action";
import { changeOccurrenceAction, resetOccurrenceAction } from "@/server/items/actions";
import type { OccurrenceEdit } from "@/server/tasks";
import { FixedTimeFields } from "./fixed-item-fields";
import { DurationField } from "./task-fields";

/** One occurrence's own timing; the rest of it stays its series'. */
export function OccurrenceForm({
  occurrence: { series, own, date, changed },
  timeZone,
  onDone,
}: {
  occurrence: OccurrenceEdit;
  timeZone: TimeZone;
  onDone: () => void;
}) {
  const { values, errors, pending, onSubmit } = useFormAction(
    changeOccurrenceAction.bind(null, series.id, date),
    occurrenceToFormValues(own, timeZone),
    onDone,
  );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      {changed && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-2">
          <p className="text-sm text-muted-foreground">Changed from the series.</p>
          <ActionButton
            variant="outline"
            size="sm"
            action={() => resetOccurrenceAction(series.id, date)}
            onDone={onDone}
          >
            Reset to the series
          </ActionButton>
        </div>
      )}
      <FormStateProvider values={values} errors={errors}>
        <FieldGroup>
          {isFixed(own) ? (
            <FixedTimeFields />
          ) : (
            <>
              <DurationField />
              <FormInput name="earliestStart" label="Not before" type="datetime-local" />
              <FormInput name="deadline" label="Due" type="datetime-local" />
            </>
          )}
        </FieldGroup>
      </FormStateProvider>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save this occurrence"}
      </Button>
    </form>
  );
}
