export type FormErrors = Partial<Record<string, string[]>>;

/** What a form's server action returns: the submitted fields come back with the errors, so nothing is lost. */
export type FormState =
  { status: "idle" } | { status: "saved" } | { status: "invalid"; errors: FormErrors; fields: Record<string, string> };

export function formFields(formData: FormData): Record<string, string> {
  return Object.fromEntries([...formData].map(([key, value]) => [key, String(value)]));
}
