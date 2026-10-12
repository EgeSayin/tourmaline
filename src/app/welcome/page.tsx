import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { SiteFooter } from "@/components/shell/site-footer";
import { APP_NAME, Wordmark } from "@/components/shell/wordmark";
import { ScreenshotCarousel } from "@/components/welcome/screenshot-carousel";
import { StartDemoButton } from "@/components/welcome/start-demo-button";
import { startDemoAction } from "@/server/demo/actions";
import { DEMO_MODE, sessionWorkspace } from "@/server/workspaces/current-workspace";
import { GUEST_IDLE_DAYS } from "@/server/workspaces/guest-limits";

export const metadata: Metadata = {
  title: `${APP_NAME}: an auto-scheduling planner`,
  description: "A planner that finds time for your tasks around your fixed events, and plans again when things change.",
};

const STEPS = [
  [
    "You add it once.",
    "Give it a name, the three hours and the Friday deadline. You don't pick a time: Tourmaline finds three free hours before Friday, around your meetings and outside the hours you keep free, and puts the report there.",
  ],
  [
    "Your week changes, and the plan follows.",
    "A meeting gets booked over that time. The report moves by itself to other free hours that still come before Friday. You don't reschedule anything.",
  ],
  [
    "You find out early when it won't fit.",
    "If the week fills up and there's no longer room for everything before its deadline, the least important task comes off the calendar and waits in a queue. You see that days ahead, not on Friday night.",
  ],
];

export default async function Welcome() {
  await connection();
  if (!DEMO_MODE || (await sessionWorkspace())) redirect("/");

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-14 px-4 py-10 sm:px-8 sm:py-14">
      <Wordmark className="text-xl" />

      <section className="flex flex-col gap-6">
        <h1 className="font-display text-4xl leading-[1.05] font-medium tracking-tight [font-variation-settings:'SOFT'_50] sm:text-6xl">
          Your life is <em>dynamic</em>, so your schedule should be too.
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          You say what needs doing, how long it takes and by when. {APP_NAME} works out when you do it, and plans again
          whenever something changes.
        </p>
        <form action={startDemoAction} className="flex flex-col gap-3 sm:items-start">
          <StartDemoButton />
          <p className="max-w-2xl text-sm text-muted-foreground">
            You get your own copy of a sample week to change as you like. No sign-up, and nothing about you is stored.
            It is deleted after {GUEST_IDLE_DAYS} days without a visit.
          </p>
        </form>
      </section>

      <ScreenshotCarousel />

      <section>
        <h2 className="font-display text-2xl font-medium tracking-tight">How it works</h2>
        <p className="mt-2 text-muted-foreground">
          Say you have a report to write. It&apos;s about three hours of work, and it&apos;s due Friday.
        </p>
        <ol className="mt-5 flex flex-col gap-5">
          {STEPS.map(([title, text], index) => (
            <li key={title} className="flex gap-4">
              <span className="w-5 shrink-0 font-display text-2xl leading-none text-gem-rim tabular-nums">
                {index + 1}
              </span>
              <p>
                <span className="font-medium">{title}</span> <span className="text-muted-foreground">{text}</span>
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="max-w-2xl">
        <h2 className="font-display text-2xl font-medium tracking-tight">Why I built it</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Growing up, &ldquo;have a planner&rdquo; was the one suggestion I always heard. However, planners never worked
          for me, as I found it hard to decide what I would do the next week. What if something comes up? What if I
          don&apos;t feel like it? It was even more painful when I couldn&apos;t follow my plan, as then I not only had
          to plan my next week, but also find slots for the things I couldn&apos;t do before. These reasons pushed me
          away from having a planner, but I also understand the value of one. Thus, I wanted to build a planner that
          works for me, and hopefully for others as well. I built it around the idea that it should be the scheduler
          that handles the thinking, not me. I should just provide my fixed schedule and the tasks I have, and it should
          build the most optimal schedule around my preferences.
        </p>
      </section>

      <SiteFooter className="border-t pt-6" />
    </main>
  );
}
