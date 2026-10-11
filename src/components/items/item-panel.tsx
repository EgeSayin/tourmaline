"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/use-media-query";
import { BlockSection } from "./block-section";
import { ItemForm } from "./item-form";
import { type EditMode, useItemPanel } from "./item-panel-state";

// Tailwind's `md` breakpoint, where `ScheduleView` switches to columns.
const DESKTOP_QUERY = "(min-width: 768px)";

function PanelContent({ mode }: { mode: EditMode }) {
  const { timeZone, close } = useItemPanel();

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-semibold">Edit item</h2>
        <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={close}>
          <X />
        </Button>
      </div>
      {mode.block && <BlockSection block={mode.block} timeZone={timeZone} onDone={close} />}
      <ItemForm key={mode.item.id} target={mode} timeZone={timeZone} onDone={close} />
    </>
  );
}

/** The edit panel: the side section on tablets and up, or a bottom sheet on phones. */
export function ItemPanel() {
  const { mode, close } = useItemPanel();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const label = "Edit item";

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
        <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col gap-4 overflow-y-auto rounded-t-xl border-t bg-popover p-4 text-popover-foreground shadow-[0_-8px_24px_rgb(0_0_0/0.12)] transition duration-200 data-ending-style:translate-y-8 data-ending-style:opacity-0 data-starting-style:translate-y-8 data-starting-style:opacity-0">
          <Dialog.Title className="sr-only">{label}</Dialog.Title>
          {mode.kind !== "closed" && <PanelContent mode={mode} />}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
