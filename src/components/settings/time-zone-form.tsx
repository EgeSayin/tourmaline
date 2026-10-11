"use client";

import { useRef } from "react";
import { FormSection } from "@/components/forms/form-fields";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { TimeZone } from "@/lib/time/time-zone";
import { useFormAction } from "@/hooks/use-form-action";
import type { TimeZoneOption } from "@/server/settings/time-zone-options";
import { saveTimeZoneAction } from "@/server/settings/actions";
import { SaveRow } from "./save-row";

export function TimeZoneForm({ timeZone, options }: { timeZone: TimeZone; options: TimeZoneOption[] }) {
  const { state, pending, onSubmit } = useFormAction(saveTimeZoneAction, {});
  const select = useRef<HTMLSelectElement>(null);
  const useDeviceZone = () => {
    const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (options.some((option) => option.value === device)) select.current!.value = device;
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormSection title="Time zone">
        <p className="text-sm text-muted-foreground">Changing it keeps every item at the same local time.</p>
        <div className="flex flex-wrap gap-2">
          <NativeSelect
            ref={select}
            name="timeZone"
            aria-label="Time zone"
            defaultValue={timeZone}
            className="w-full sm:w-80"
          >
            {options.map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Button type="button" variant="outline" onClick={useDeviceZone}>
            Use this device&apos;s
          </Button>
        </div>
      </FormSection>
      <SaveRow
        label="Save time zone"
        pending={pending}
        saved={state.status === "saved"}
        message="Saved. Items keep their local times."
      />
    </form>
  );
}
