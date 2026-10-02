"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Plus, X } from "lucide-react";
import { createContext, use, useState } from "react";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { Item } from "@/lib/items";
import type { TimeZone } from "@/lib/time-zone";
import { ItemForm } from "./item-form";

const DESKTOP_QUERY = "(min-width: 768px)";

type PanelMode = { kind: "closed" } | { kind: "add" } | { kind: "edit"; item: Item };

interface PanelContextValue {
  mode: PanelMode;
  timeZone: TimeZone;
  openAdd: () => void;
  openEdit: (item: Item) => void;
  close: () => void;
}

const PanelContext = createContext<PanelContextValue | null>(null);

export function useItemPanel() {
  const context = use(PanelContext);
  if (!context) throw new Error("useItemPanel must be used inside ItemPanelProvider");
  return context;
}

export function ItemPanelProvider({ timeZone, children }: { timeZone: TimeZone; children: React.ReactNode }) {
  const [mode, setMode] = useState<PanelMode>({ kind: "closed" });
  const value: PanelContextValue = {
    mode,
    timeZone,
    openAdd: () => setMode({ kind: "add" }),
    openEdit: (item) => setMode({ kind: "edit", item }),
    close: () => setMode({ kind: "closed" }),
  };
  return <PanelContext value={value}>{children}</PanelContext>;
}

export function AddItemButton() {
  const { mode, openAdd } = useItemPanel();
  return (
    <Button aria-expanded={mode.kind === "add"} onClick={openAdd}>
      <Plus />
      Add item
    </Button>
  );
}

function PanelContent({ mode }: { mode: Exclude<PanelMode, { kind: "closed" }> }) {
  const { timeZone, close } = useItemPanel();
  const editing = mode.kind === "edit" ? mode.item : undefined;

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{editing ? "Edit item" : "Add item"}</h2>
          {!editing && (
            <p className="text-sm text-muted-foreground">
              Fixed items keep their time; flexible ones are scheduled for you.
            </p>
          )}
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={close}>
          <X />
        </Button>
      </div>
      <ItemForm key={editing?.id ?? "new"} item={editing} timeZone={timeZone} onDone={close} />
    </>
  );
}

/** Shows `children` with the item panel beside them on desktop, or as a bottom sheet on phones. */
export function ItemPanelLayout({ children }: { children: React.ReactNode }) {
  const { mode, close } = useItemPanel();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const label = mode.kind === "edit" ? "Edit item" : "Add item";

  return (
    <div className="flex items-start gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-4">{children}</div>

      {isDesktop && mode.kind !== "closed" && (
        <aside
          aria-label={label}
          className="sticky top-4 flex max-h-[calc(100dvh-2rem)] w-96 shrink-0 flex-col gap-4 overflow-y-auto rounded-xl border bg-card p-4 shadow-sm"
          onKeyDown={(event) => event.key === "Escape" && close()}
        >
          <PanelContent mode={mode} />
        </aside>
      )}

      {!isDesktop && (
        <Dialog.Root open={mode.kind !== "closed"} onOpenChange={(open) => !open && close()} modal={false}>
          <Dialog.Portal>
            <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 flex max-h-[50dvh] flex-col gap-4 overflow-y-auto rounded-t-xl border-t bg-popover p-4 text-popover-foreground shadow-[0_-8px_24px_rgb(0_0_0/0.12)] transition duration-200 data-ending-style:translate-y-8 data-ending-style:opacity-0 data-starting-style:translate-y-8 data-starting-style:opacity-0">
              <Dialog.Title className="sr-only">{label}</Dialog.Title>
              {mode.kind !== "closed" && <PanelContent mode={mode} />}
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  );
}
