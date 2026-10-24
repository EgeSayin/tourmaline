"use client";

import { FormChoice, FormSection, FormStateProvider } from "@/components/forms/form-fields";
import { useClockFormat } from "@/components/time/clock-format";
import type { ClockFormat } from "@/lib/time/clock";
import { useFormAction } from "@/hooks/use-form-action";
import { saveClockFormatAction } from "@/server/settings/actions";
import { SaveRow } from "./save-row";

const OPTIONS = [
  { value: "24h", label: "24-hour" },
  { value: "12h", label: "12-hour (AM/PM)" },
] as const satisfies readonly { value: ClockFormat; label: string }[];

/** `saved` is whether the account has picked a clock; until then, the shown one follows the browser. */
export function ClockFormatForm({ saved }: { saved: boolean }) {
  const { state, values, errors, pending, onSubmit } = useFormAction(saveClockFormatAction, {});
  const shown = useClockFormat();

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormStateProvider values={values} errors={errors}>
        <FormSection title="Clock">
          <FormChoice
            name="clockFormat"
            label="Show times on"
            description={saved ? undefined : "Follows your browser's language until you save one."}
            options={OPTIONS}
            defaultValue={shown}
          />
        </FormSection>
      </FormStateProvider>
      <SaveRow label="Save clock" pending={pending} saved={state.status === "saved"} message="Saved." />
    </form>
  );
}
