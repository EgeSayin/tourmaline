"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** One feature per slide; `label` names it in the step row. Each `id` has `public/welcome/<id>-{light,dark}.jpg`. */
const SLIDES = [
  {
    id: "week",
    label: "Your week",
    title: "Your week, planned",
    caption: "Events stay where you put them. Tasks fill the free time between them, each before its deadline.",
  },
  {
    id: "add",
    label: "Adding",
    title: "Add a task, not a time",
    caption: "Give it a length and a due date. Tourmaline picks the time, so you never hunt for a free slot.",
  },
  {
    id: "split",
    label: "Splitting",
    title: "Big tasks, broken up",
    caption:
      "Eight hours of project work becomes one- to two-hour blocks, spread evenly through the week instead of one long day.",
  },
  {
    id: "repeat",
    label: "Repeating",
    title: "Set it once",
    caption:
      "Lectures, workouts, lunch: make anything repeat daily or weekly, on the days you pick. Each one is planned on its own.",
  },
  {
    id: "priority",
    label: "Priority",
    title: "What matters keeps its time",
    caption:
      "Give each task a priority. When the week gets tight, lower-priority tasks make room first, and the important ones stay where they are.",
  },
  {
    id: "queue",
    label: "The queue",
    title: "Warned in time",
    caption:
      "Twenty hours of work due tomorrow won't fit. Instead of overbooking you, Tourmaline keeps it in the queue, so you know today.",
  },
  {
    id: "missed",
    label: "Missed",
    title: "Missed it? Just say so",
    caption:
      "When a block doesn't happen, one click marks it missed and its time goes back into the plan, somewhere free before the deadline. You never rebuild your week by hand.",
  },
  {
    id: "categories",
    label: "Categories",
    title: "Sort it by colour",
    caption:
      "Put items into categories, each with its own colour, and hide the ones you don't need right now to see just that part of your week.",
  },
  {
    id: "stats",
    label: "Stats",
    title: "See how your weeks went",
    caption:
      "Each week shows how much of the task time you planned got done or missed, and where the done time went, by category.",
  },
];

export function ScreenshotCarousel() {
  const track = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(0);
  // The slide a button is scrolling to; until it arrives, the scroll events on the way don't change `shown`.
  const target = useRef<number | null>(null);

  function show(index: number) {
    const element = track.current!;
    target.current = index;
    element.scrollTo({ left: index * element.clientWidth, behavior: "smooth" });
    setShown(index);
  }

  function onScroll(element: HTMLDivElement) {
    const index = Math.round(element.scrollLeft / element.clientWidth);
    if (target.current !== null && index !== target.current) return;
    target.current = null;
    setShown(index);
  }

  return (
    <section aria-roledescription="carousel" aria-label="What it does" className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <ol className="hidden flex-wrap gap-x-4 gap-y-2 md:flex">
          {SLIDES.map(({ id, label }, index) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => show(index)}
                aria-current={index === shown ? "step" : undefined}
                className="border-b-2 border-transparent pb-1 text-sm text-muted-foreground transition-colors hover:text-foreground aria-[current=step]:border-gem-rim aria-[current=step]:text-foreground"
              >
                <span className="mr-1.5 font-display tabular-nums">{index + 1}</span>
                {label}
              </button>
            </li>
          ))}
        </ol>
        <p className="text-sm text-muted-foreground tabular-nums md:hidden">
          {shown + 1} / {SLIDES.length}
        </p>
        <div className="flex shrink-0 gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous"
            disabled={shown === 0}
            onClick={() => show(shown - 1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next"
            disabled={shown === SLIDES.length - 1}
            onClick={() => show(shown + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div
        ref={track}
        onScroll={(event) => onScroll(event.currentTarget)}
        onPointerDown={() => (target.current = null)}
        onWheel={() => (target.current = null)}
        className="flex snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto"
      >
        {SLIDES.map(({ id, title, caption }, index) => (
          <figure
            key={id}
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${SLIDES.length}: ${title}`}
            className="flex w-full shrink-0 snap-start flex-col gap-3"
          >
            <figcaption>
              <span className="font-display text-xl font-medium tracking-tight">{title}.</span>{" "}
              <span className="text-muted-foreground">{caption}</span>
            </figcaption>
            <div className="overflow-hidden rounded-md border shadow-sm">
              {(["light", "dark"] as const).map((theme) => (
                <Image
                  key={theme}
                  src={`/welcome/${id}-${theme}.jpg`}
                  alt=""
                  width={2560}
                  height={1600}
                  sizes="(min-width: 56rem) 52rem, 100vw"
                  priority={index === 0}
                  className={cn(theme === "light" ? "dark:hidden" : "hidden dark:block")}
                />
              ))}
            </div>
          </figure>
        ))}
      </div>
    </section>
  );
}
