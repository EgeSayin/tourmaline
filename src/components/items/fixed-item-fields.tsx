import { FormInput, FormSection } from "@/components/forms/form-fields";

export function FixedItemFields() {
  return (
    <>
      <FormInput name="location" label="Location" placeholder="Optional" />
      <FormSection title="When">
        <FormInput name="start" label="Starts" type="datetime-local" />
        <FormInput name="end" label="Ends" type="datetime-local" />
        <div className="grid grid-cols-2 gap-4">
          <FormInput name="bufferBeforeMin" label="Buffer before (min)" type="number" min={0} placeholder="0" />
          <FormInput name="bufferAfterMin" label="Buffer after (min)" type="number" min={0} placeholder="0" />
        </div>
      </FormSection>
    </>
  );
}
