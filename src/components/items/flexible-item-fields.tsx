import { FormInput, FormSelect } from "@/components/forms/form-fields";
import { SPREAD_STRATEGIES, type SpreadStrategy } from "@/lib/items";
import { SLOT_MIN } from "@/lib/placements";

const SPREAD_LABELS: Record<SpreadStrategy, string> = {
  asap: "As soon as possible",
  even: "Spread evenly",
  "just-in-time": "Close to the deadline",
};

const SPREAD_OPTIONS = SPREAD_STRATEGIES.map((value) => ({ value, label: SPREAD_LABELS[value] }));

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
      <FormSelect name="spread" label="Spread" options={SPREAD_OPTIONS} defaultValue="even" />
    </>
  );
}
