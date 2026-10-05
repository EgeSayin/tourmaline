"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ItemForm } from "./item-form";
import { type PanelMode, useItemPanel } from "./item-panel-state";

// Tailwind's `md` breakpoint, where `ScheduleView` switches to columns.
const DESKTOP_QUERY = "(min-width: 768px)";

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
  const editing = mode.kind === "edit" ? mode : undefined;

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
      <ItemForm key={editing?.item.id ?? "new"} target={editing} timeZone={timeZone} onDone={close} />
    </>
  );
}

/** The add/edit panel: the tools section on tablets and up, or a bottom sheet on phones. */
export function ItemPanel() {
  const { mode, close } = useItemPanel();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const label = mode.kind === "edit" ? "Edit item" : "Add item";

  if (isDesktop) {
    return (
      mode.kind !== "closed" && (
        <aside
          aria-label={label}
          className="flex flex-col gap-4 overflow-y-auto border-l p-4"
          onKeyDown={(event) => event.key === "Escape" && close()}
        >
          <PanelContent mode={mode} />
        </aside>
      )
    );
  }

  return (
    <Dialog.Root open={mode.kind !== "closed"} onOpenChange={(open) => !open && close()} modal={false}>
      <Dialog.Portal>
        <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 flex max-h-[50dvh] flex-col gap-4 overflow-y-auto rounded-t-xl border-t bg-popover p-4 text-popover-foreground shadow-[0_-8px_24px_rgb(0_0_0/0.12)] transition duration-200 data-ending-style:translate-y-8 data-ending-style:opacity-0 data-starting-style:translate-y-8 data-starting-style:opacity-0">
          <Dialog.Title className="sr-only">{label}</Dialog.Title>
          {mode.kind !== "closed" && <PanelContent mode={mode} />}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
