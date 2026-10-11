"use client";

import { ActionButton } from "@/components/forms/action-button";
import { FormSection } from "@/components/forms/form-fields";
import { resetDemoAction } from "@/server/demo/actions";

export function DemoReset({ idleDays }: { idleDays: number }) {
  return (
    <div className="flex flex-col gap-4">
      <FormSection title="Demo">
        <p className="text-sm text-muted-foreground">
          This is your own copy of a sample week; nobody else sees it. It is deleted after {idleDays} days without a
          visit.
        </p>
      </FormSection>
      <ActionButton variant="outline" className="self-start" action={resetDemoAction}>
        Reset to the sample week
      </ActionButton>
    </div>
  );
}
