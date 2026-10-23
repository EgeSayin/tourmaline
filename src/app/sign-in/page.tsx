import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AccountForm } from "@/components/accounts/account-form";
import { AccountPage } from "@/components/accounts/account-page";
import { DemoNotice } from "@/components/accounts/demo-notice";
import { loadSignUpState } from "@/server/accounts/sign-up-state";
import { currentSession, DEMO_MODE } from "@/server/workspaces/current-workspace";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignIn() {
  await connection();
  if (!DEMO_MODE) {
    if (await currentSession()) redirect("/");
    if ((await loadSignUpState()) === "first") redirect("/sign-up");
  }

  return (
    <AccountPage>
      <AccountForm kind="sign-in" notice={DEMO_MODE ? <DemoNotice /> : undefined} />
    </AccountPage>
  );
}
