"use client";

import { startTransition, useActionState } from "react";
import { toastNotSaved } from "@/components/forms/action-toasts";
import type { FormState } from "@/lib/form-state";

/** Fields show the submitted values after a failed submission, `initialValues` before. */
export function useFormAction(
  action: (previous: FormState, formData: FormData) => Promise<FormState>,
  initialValues: Record<string, string>,
  onSaved?: () => void,
) {
  const [state, formAction, pending] = useActionState(
    async (previous: FormState, formData: FormData) => {
      try {
        const result = await action(previous, formData);
        if (result.status === "saved") onSaved?.();
        return result;
      } catch {
        toastNotSaved();
        return previous;
      }
    },
    { status: "idle" } as FormState,
  );
  const invalid = state.status === "invalid" ? state : null;

  return {
    state,
    pending,
    values: invalid?.fields ?? initialValues,
    errors: invalid?.errors ?? {},
    // Not a form `action`: React resets a form after its action, and a reset select shows its first value again.
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      startTransition(() => formAction(formData));
    },
  };
}
