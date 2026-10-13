"use client";

import { useState } from "react";
import { FormChoice, FormDurationInput, FormInput, FormSection, useFormValue } from "@/components/forms/form-fields";
import { CATCH_UP_OPTIONS, type CatchUp, type Repeat } from "@/lib/item-form";
import { SPREAD_STRATEGIES, type SpreadStrategy } from "@/lib/items";

const SPREAD_LABELS = {
  asap: "Early",
  even: "Evenly",
  "just-in-time": "Near due",
} satisfies Record<SpreadStrategy, string>;

const DURATION_PRESETS = [30, 60, 90, 120];

const catchUpLabels = (period: string) =>
  ({ later: "Plan it later", "in-period": `Same ${period} only` }) satisfies Record<CatchUp, string>;

/** A task's length, before its repeat rule. */
export function DurationField() {
  return <FormDurationInput name="durationMin" label="Duration" placeholder="1h 30m" presets={DURATION_PRESETS} />;
}

/**
 * When a task can start and by when, after its repeat rule. A repeating task isn't asked for a due date: in its place,
 * until when each occurrence may be planned.
 */
export function TaskWindowFields({ repeat }: { repeat: Repeat }) {
  const period = repeat === "daily" ? "day" : "week";
  return (
    <>
      <FormInput
        name="earliestStart"
        clearable
        label="Not before"
        type="datetime-local"
        placeholder={repeat === "none" ? "Now" : "Not set"}
        description={repeat === "none" ? "Leave empty to start now." : "When the first one can start."}
      />
      {repeat === "none" ? (
        <FormInput name="deadline" label="Due" type="datetime-local" placeholder="Not set" />
      ) : (
        <FormChoice
          key={period}
          name="catchUp"
          label="If it doesn't happen"
          description={`Plan it later: any time before the next one. Same ${period} only: within its own ${period}, or its ${period}s when it repeats every few.`}
          options={CATCH_UP_OPTIONS.map((value) => ({ value, label: catchUpLabels(period)[value] }))}
          defaultValue="later"
        />
      )}
    </>
  );
}

export function TaskScheduleSection() {
  const chunkSizes = [useFormValue("minChunkMin"), useFormValue("maxChunkMin")];
  const [split, setSplit] = useState(chunkSizes.some(Boolean));

  return (
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
  );
}
