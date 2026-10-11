"use client";

import { useState } from "react";
import { FormChoice, FormDurationInput, FormInput, FormSection, useFormValue } from "@/components/forms/form-fields";
import { SPREAD_STRATEGIES, type SpreadStrategy } from "@/lib/items";

const SPREAD_LABELS = {
  asap: "Early",
  even: "Evenly",
  "just-in-time": "Near due",
} satisfies Record<SpreadStrategy, string>;

const DURATION_PRESETS = [30, 60, 90, 120];

/** A repeating task isn't asked for a due date: each occurrence is due when the next one starts. */
export function TaskFields({ repeating }: { repeating: boolean }) {
  const chunkSizes = [useFormValue("minChunkMin"), useFormValue("maxChunkMin")];
  const [split, setSplit] = useState(chunkSizes.some(Boolean));

  return (
    <>
      <FormSection title="When">
        <FormDurationInput name="durationMin" label="Duration" placeholder="1h 30m" presets={DURATION_PRESETS} />
        <FormInput
          name="earliestStart"
          clearable
          label="Not before"
          type="datetime-local"
          placeholder={repeating ? "Not set" : "Now"}
          description={repeating ? "The first one; each is due when the next one starts." : "Leave empty to start now."}
        />
        {!repeating && <FormInput name="deadline" label="Due" type="datetime-local" placeholder="Not set" />}
      </FormSection>
      <FormSection title="How to schedule">
        <FormChoice
          label="Blocks"
          options={[
            { value: "one", label: "One block" },
            { value: "split", label: "Split it up" },
          ]}
          defaultValue={split ? "split" : "one"}
          onValueChange={(value) => setSplit(value === "split")}
        />
        {split && (
          <div className="grid grid-cols-2 gap-4">
            <FormDurationInput name="minChunkMin" label="Shortest block" placeholder="30m" />
            <FormDurationInput name="maxChunkMin" label="Longest block" placeholder="1h" />
          </div>
        )}
        <FormChoice
          name="spread"
          label="Work on it"
          description="Where its blocks go between its start and when it's due."
          options={SPREAD_STRATEGIES.map((value) => ({ value, label: SPREAD_LABELS[value] }))}
          defaultValue="asap"
        />
      </FormSection>
    </>
  );
}
