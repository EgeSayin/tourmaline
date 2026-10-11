import { FormInput } from "@/components/forms/form-fields";
import { SLOT_MIN } from "@/lib/placements";

/** A repeating task isn't asked for a due date: each occurrence is due when the next one starts. */
export function TaskFields({ repeating }: { repeating: boolean }) {
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
        clearable
        label="Not before"
        type="datetime-local"
        description={repeating ? "The first one; each is due when the next one starts." : "Leave empty to start now."}
      />
      {!repeating && <FormInput name="deadline" label="Due" type="datetime-local" />}
      <div className="grid grid-cols-2 gap-4">
        <FormInput
          name="minChunkMin"
          label="Chunks from (min)"
          type="number"
          min={SLOT_MIN}
          step={SLOT_MIN}
          placeholder="30"
          description="Leave both empty to keep it in one block."
        />
        <FormInput
          name="maxChunkMin"
          label="Chunks to (min)"
          type="number"
          min={SLOT_MIN}
          step={SLOT_MIN}
          placeholder="60"
        />
      </div>
    </>
  );
}
