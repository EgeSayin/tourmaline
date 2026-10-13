"use client";

import { createContext, use, useEffect, useState } from "react";
import type { CalendarBlock } from "@/lib/calendar-blocks";
import type { TimeZone } from "@/lib/time/time-zone";
import type { ReviewEntry } from "@/server/calendar";

export type OpenedBlock = Pick<CalendarBlock, "key" | "title" | "start" | "end" | "target" | "placement"> &
  Partial<Pick<CalendarBlock, "style">>;

interface PanelState {
  block: OpenedBlock | null;
  timeZone: TimeZone;
  open: (block: Pick<OpenedBlock, "key">) => void;
  close: () => void;
  show: (blocks: OpenedBlock[]) => void;
}

const PanelContext = createContext<PanelState | null>(null);

export function useBlockPanel() {
  const context = use(PanelContext);
  if (!context) throw new Error("useBlockPanel must be used inside BlockPanelProvider");
  return context;
}

/** Makes `blocks`, the ones on screen, openable in the panel while the calling component is shown. */
export function useShownBlocks(blocks: OpenedBlock[]) {
  const { show } = useBlockPanel();
  useEffect(() => {
    show(blocks);
    return () => show([]);
  }, [show, blocks]);
}

/**
 * Keeps which block the panel shows by its key, and finds it each render among the blocks on screen and the blocks
 * to review, so the panel always shows the current block, and closes once it's gone (moved, deleted, or off screen).
 */
export function BlockPanelProvider({
  timeZone,
  review,
  children,
}: {
  timeZone: TimeZone;
  review: ReviewEntry[];
  children: React.ReactNode;
}) {
  const [key, setKey] = useState<string | null>(null);
  const [shown, setShown] = useState<OpenedBlock[]>([]);
  const toReview = review.map(({ key, title, start, end, ref, target }) => ({
    key,
    title,
    start,
    end,
    target,
    placement: { ref, state: "to-review" as const, pinned: false },
  }));
  const block = key === null ? null : ([...shown, ...toReview].find((candidate) => candidate.key === key) ?? null);

  // Forgotten once gone, so the panel doesn't reopen by itself if the block shows up again.
  if (key !== null && block === null) setKey(null);

  const state: PanelState = {
    block,
    timeZone,
    open: ({ key }) => setKey(key),
    close: () => setKey(null),
    show: setShown,
  };
  return <PanelContext value={state}>{children}</PanelContext>;
}
