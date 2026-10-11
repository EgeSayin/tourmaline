"use client";

import { createContext, use, useState } from "react";
import type { BlockPlacement, EditTarget } from "@/lib/calendar-blocks";
import type { TimeZone } from "@/lib/time/time-zone";

/** A scheduled block the panel was opened from. */
export type OpenedBlock = BlockPlacement & { start: Date; end: Date };

export type PanelMode =
  { kind: "closed" } | { kind: "add" } | ({ kind: "edit"; block: OpenedBlock | null } & EditTarget);

interface PanelState {
  mode: PanelMode;
  timeZone: TimeZone;
  openAdd: () => void;
  openEdit: (target: EditTarget, block?: OpenedBlock | null) => void;
  close: () => void;
}

const PanelContext = createContext<PanelState | null>(null);

export function useItemPanel() {
  const context = use(PanelContext);
  if (!context) throw new Error("useItemPanel must be used inside ItemPanelProvider");
  return context;
}

/** Whether the add/edit panel is open, and on what; shared by the calendar, the queue and the panel. */
export function ItemPanelProvider({ timeZone, children }: { timeZone: TimeZone; children: React.ReactNode }) {
  const [mode, setMode] = useState<PanelMode>({ kind: "closed" });
  const state: PanelState = {
    mode,
    timeZone,
    openAdd: () => setMode({ kind: "add" }),
    openEdit: (target, block = null) => setMode({ kind: "edit", ...target, block }),
    close: () => setMode({ kind: "closed" }),
  };
  return <PanelContext value={state}>{children}</PanelContext>;
}
