"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Plus, X } from "lucide-react";
import { createContext, use, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { ItemForm } from "./item-form";

const DESKTOP_QUERY = "(min-width: 768px)";

const PanelContext = createContext<{ open: boolean; setOpen: (open: boolean) => void } | null>(null);

function usePanel() {
  const context = use(PanelContext);
  if (!context) throw new Error("usePanel must be used inside ItemPanelProvider");
  return context;
}

function useIsDesktop() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(DESKTOP_QUERY);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
}

export function ItemPanelProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <PanelContext value={{ open, setOpen }}>{children}</PanelContext>;
}

export function AddItemButton() {
  const { open, setOpen } = usePanel();
  return (
    <Button aria-expanded={open} onClick={() => setOpen(true)}>
      <Plus />
      Add item
    </Button>
  );
}

function PanelHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div>
        <h2 className="font-semibold">Add item</h2>
        <p className="text-sm text-muted-foreground">
          Fixed items keep their time; flexible ones are scheduled for you.
        </p>
      </div>
      <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
        <X />
      </Button>
    </div>
  );
}

/** Shows `children` with the add-item panel beside them on desktop, or as a bottom sheet on phones. */
export function ItemPanelLayout({ children }: { children: React.ReactNode }) {
  const { open, setOpen } = usePanel();
  const isDesktop = useIsDesktop();
  const close = () => setOpen(false);

  return (
    <div className="flex items-start gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-4">{children}</div>

      {isDesktop && open && (
        <aside
          aria-label="Add item"
          className="sticky top-4 flex max-h-[calc(100dvh-2rem)] w-96 shrink-0 flex-col gap-4 overflow-y-auto rounded-xl border bg-card p-4 shadow-sm"
          onKeyDown={(event) => event.key === "Escape" && close()}
        >
          <PanelHeader onClose={close} />
          <ItemForm onSaved={close} />
        </aside>
      )}

      {!isDesktop && (
        <Dialog.Root open={open} onOpenChange={setOpen} modal={false}>
          <Dialog.Portal>
            <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 flex max-h-[50dvh] flex-col gap-4 overflow-y-auto rounded-t-xl border-t bg-popover p-4 text-popover-foreground shadow-[0_-8px_24px_rgb(0_0_0/0.12)] transition duration-200 data-ending-style:translate-y-8 data-ending-style:opacity-0 data-starting-style:translate-y-8 data-starting-style:opacity-0">
              <Dialog.Title className="sr-only">Add item</Dialog.Title>
              <PanelHeader onClose={close} />
              <ItemForm onSaved={close} />
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  );
}
