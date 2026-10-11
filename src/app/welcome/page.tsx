import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { StartDemoButton } from "@/components/welcome/start-demo-button";
import { startDemoAction } from "@/server/demo/actions";
import { DEMO_MODE, sessionWorkspace } from "@/server/workspaces/current-workspace";
import { GUEST_IDLE_DAYS } from "@/server/workspaces/guest-limits";

export const metadata: Metadata = {
  title: "Schedule: an auto-scheduling planner",
  description: "A planner that finds time for your tasks around your fixed events, and plans again when things change.",
};

const FEATURES = [
  ["Finds the time for you", "Give a task its length and due date; it lands in the free time around your events."],
  ["Plans again on every change", "Add something urgent and less important tasks move aside, by priority."],
  ["Splits and spreads work", "Long tasks can go in blocks, early, evenly or close to when they're due."],
  ["Respects your limits", "Downtime stays free, and a focus cap keeps each day from filling up."],
] as const;

export default async function Welcome() {
  await connection();
  if (!DEMO_MODE || (await sessionWorkspace())) redirect("/");

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 px-4 py-12">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Schedule</h1>
        <p className="text-lg text-muted-foreground">
          An auto-scheduling planner: you say what needs doing and by when, it works out when to do it.
        </p>
      </div>
      <form action={startDemoAction} className="flex flex-col gap-3 sm:items-start">
        <StartDemoButton />
        <p className="text-sm text-muted-foreground">
          You get your own copy of a sample week to change as you like. No sign-up, and nothing about you is stored. It
          is deleted after {GUEST_IDLE_DAYS} days without a visit.
        </p>
      </form>
      <ul className="grid gap-4 sm:grid-cols-2">
        {FEATURES.map(([title, text]) => (
          <li key={title} className="rounded-xl border bg-card p-4">
            <h2 className="font-medium">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
