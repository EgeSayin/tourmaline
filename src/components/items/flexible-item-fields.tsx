import { FormInput } from "@/components/forms/form-fields";
import { SLOT_MIN } from "@/lib/placements";

export function FlexibleItemFields() {
  return (
    <>
      <FormInput
        name="durationMin"
        label="Duration (min)"
        type="number"
        min={SLOT_MIN}
        step={SLOT_MIN}
        placeholder="90"
      />
      <FormInput
        name="earliestStart"
        label="Not before"
        type="datetime-local"
        description="Leave empty to start now."
      />
      <FormInput name="deadline" label="Due" type="datetime-local" />
    </>
  );
}
