"use client";

import { createContext, use, useState } from "react";
import type { CalendarBlock } from "@/lib/calendar-blocks";
import type { TimeZone } from "@/lib/time/time-zone";

export type OpenedBlock = Pick<CalendarBlock, "title" | "start" | "end" | "target" | "placement">;

interface PanelState {
  block: OpenedBlock | null;
  timeZone: TimeZone;
  open: (block: OpenedBlock) => void;
  close: () => void;
}

const PanelContext = createContext<PanelState | null>(null);

export function useBlockPanel() {
  const context = use(PanelContext);
  if (!context) throw new Error("useBlockPanel must be used inside BlockPanelProvider");
  return context;
}

export function BlockPanelProvider({ timeZone, children }: { timeZone: TimeZone; children: React.ReactNode }) {
  const [block, setBlock] = useState<OpenedBlock | null>(null);
  const state: PanelState = { block, timeZone, open: setBlock, close: () => setBlock(null) };
  return <PanelContext value={state}>{children}</PanelContext>;
}
