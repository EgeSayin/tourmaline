"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormInput, FormStateProvider } from "@/components/forms/form-fields";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { PASSWORD_MAX, USERNAME_MAX } from "@/lib/accounts";
import { useFormAction } from "@/hooks/use-form-action";
import { signInAction, signUpAction } from "@/server/accounts/actions";

const KINDS = {
  "sign-in": {
    title: "Sign in",
    action: signInAction,
    submit: "Sign in",
    pending: "Signing in…",
    password: "current-password",
    other: { text: "No account yet?", link: "Create one", href: "/sign-up" },
  },
  "sign-up": {
    title: "Create an account",
    action: signUpAction,
    submit: "Create account",
    pending: "Creating…",
    password: "new-password",
    other: { text: "Have an account?", link: "Sign in", href: "/sign-in" },
  },
} as const;

/** With a `notice`, the form shows it and can't be used. */
export function AccountForm({
  kind,
  intro,
  notice,
}: {
  kind: keyof typeof KINDS;
  intro?: string;
  notice?: React.ReactNode;
}) {
  const { title, action, submit, pending: pendingLabel, password, other } = KINDS[kind];
  const router = useRouter();
  const { values, errors, pending, onSubmit } = useFormAction(action, {}, () => router.replace("/"));

  return (
    <section aria-label={title} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        {intro && <p className="text-sm text-muted-foreground">{intro}</p>}
      </div>
      {notice && (
        <div role="note" className="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
          {notice}
        </div>
      )}
      <form onSubmit={onSubmit}>
        <fieldset disabled={!!notice} className="flex flex-col gap-6 disabled:opacity-50">
          <FormStateProvider values={values} errors={errors}>
            <FieldGroup>
              <FormInput
                name="username"
                label="Username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={USERNAME_MAX}
                autoFocus={!notice}
              />
              <FormInput
                name="password"
                label="Password"
                type="password"
                autoComplete={password}
                maxLength={PASSWORD_MAX}
              />
            </FieldGroup>
          </FormStateProvider>
          <Button type="submit" disabled={pending}>
            {pending ? pendingLabel : submit}
          </Button>
        </fieldset>
      </form>
      <p className="text-sm text-muted-foreground">
        {other.text}{" "}
        <Link href={other.href} className="font-medium text-foreground underline-offset-4 hover:underline">
          {other.link}
        </Link>
      </p>
    </section>
  );
}
