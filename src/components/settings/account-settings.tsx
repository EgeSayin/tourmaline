"use client";

import { ActionButton } from "@/components/forms/action-button";
import { FormInput, FormSection, FormStateProvider } from "@/components/forms/form-fields";
import { Button } from "@/components/ui/button";
import { type Account, PASSWORD_MAX } from "@/lib/accounts";
import { useFormAction } from "@/hooks/use-form-action";
import { changePasswordAction, setSignUpOpenAction, signOutAction } from "@/server/accounts/actions";
import { SaveRow } from "./save-row";

export function AccountSettings({ account, signUpOpen }: { account: Account; signUpOpen: boolean }) {
  const { state, values, errors, pending, onSubmit } = useFormAction(changePasswordAction, {});

  return (
    <>
      <form action={signOutAction} className="flex flex-col gap-4">
        <FormSection title="Account">
          <p className="text-sm text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{account.username}</span>
            {account.isAdmin && ", the admin"}.
          </p>
        </FormSection>
        <Button type="submit" variant="outline" className="self-start">
          Sign out
        </Button>
      </form>

      {/* Saving clears the fields, by remounting them. */}
      <form key={state.status === "saved" ? "saved" : "editing"} onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormSection title="Password">
          <FormStateProvider values={values} errors={errors}>
            <input type="hidden" name="username" autoComplete="username" value={account.username} />
            <FormInput
              name="currentPassword"
              label="Current password"
              type="password"
              autoComplete="current-password"
              maxLength={PASSWORD_MAX}
              className="sm:w-80"
            />
            <FormInput
              name="newPassword"
              label="New password"
              type="password"
              autoComplete="new-password"
              maxLength={PASSWORD_MAX}
              className="sm:w-80"
            />
          </FormStateProvider>
        </FormSection>
        <SaveRow
          label="Change password"
          pending={pending}
          saved={state.status === "saved"}
          message="Changed. Your other devices are signed out."
        />
      </form>

      {account.isAdmin && (
        <div className="flex flex-col gap-4">
          <FormSection title="Sign-up">
            <p className="text-sm text-muted-foreground">
              {signUpOpen
                ? "Open: anyone who can reach this instance can create an account."
                : "Closed: only existing accounts can sign in."}
            </p>
          </FormSection>
          <ActionButton variant="outline" className="self-start" action={() => setSignUpOpenAction(!signUpOpen)}>
            {signUpOpen ? "Close sign-up" : "Open sign-up"}
          </ActionButton>
        </div>
      )}
    </>
  );
}
