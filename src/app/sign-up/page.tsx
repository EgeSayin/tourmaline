import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AccountForm } from "@/components/accounts/account-form";
import { AccountPage } from "@/components/accounts/account-page";
import { DemoNotice } from "@/components/accounts/demo-notice";
import { loadSignUpState } from "@/server/accounts/sign-up-state";
import { currentSession, DEMO_MODE } from "@/server/workspaces/current-workspace";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignUp() {
  await connection();
  if (DEMO_MODE) {
    return (
      <AccountPage>
        <AccountForm kind="sign-up" notice={<DemoNotice />} />
      </AccountPage>
    );
  }
  if (await currentSession()) redirect("/");

  const state = await loadSignUpState();
  return (
    <AccountPage>
      <AccountForm
        kind="sign-up"
        intro={state === "first" ? "This is the first account, so it will be the admin's." : undefined}
        notice={state === "closed" ? "Sign-up is closed. Ask the admin to open it." : undefined}
      />
    </AccountPage>
  );
}
