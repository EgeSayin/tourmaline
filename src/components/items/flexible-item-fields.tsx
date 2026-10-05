import { FormInput } from "@/components/forms/form-fields";
import { SLOT_MIN } from "@/lib/placements";

/** A repeating task isn't asked for a due date: each occurrence is due when the next one starts. */
export function FlexibleItemFields({ repeating }: { repeating: boolean }) {
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
        description={repeating ? "The first one; each is due when the next one starts." : "Leave empty to start now."}
      />
      {!repeating && <FormInput name="deadline" label="Due" type="datetime-local" />}
    </>
  );
}
