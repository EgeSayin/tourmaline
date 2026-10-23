"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ArrowRight, X } from "lucide-react";
import Link from "next/link";
import { BlockSummary } from "@/components/items/block-summary";
import { PlacementActions } from "@/components/items/placement-actions";
import { SkipOccurrenceButton } from "@/components/items/skip-occurrence-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/use-media-query";
import { editHref } from "@/lib/calendar-blocks";
import { cn } from "@/lib/utils";
import { type OpenedBlock, useBlockPanel } from "./block-panel-state";

// Tailwind's `md` breakpoint, where `AppShell` switches to columns.
const DESKTOP_QUERY = "(min-width: 768px)";

const LABEL = "Block";

function PanelContent({ block }: { block: OpenedBlock }) {
  const { timeZone, close } = useBlockPanel();
  const { title, placement, target } = block;
  const { item, occurrenceDate } = target;

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={close}>
          <X />
        </Button>
      </div>
      <BlockSummary block={block} timeZone={timeZone} />
      {block.style === "displaced" && (
        <p className="text-sm text-muted-foreground">A higher-priority task needs this time.</p>
      )}
      {placement && <PlacementActions placement={placement} onDone={close} />}
      {occurrenceDate && (
        <div className="flex flex-wrap gap-2">
          <SkipOccurrenceButton itemId={item.id} date={occurrenceDate} onSkipped={close} />
        </div>
      )}
      <Link href={editHref(target)} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "self-start")}>
        Open task
        <ArrowRight />
      </Link>
    </>
  );
}

export function BlockPanel() {
  const { block, close } = useBlockPanel();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  if (isDesktop) {
    return (
      block && (
        <aside
          aria-label={LABEL}
          className="flex flex-col gap-4 overflow-y-auto border-l p-4"
          onKeyDown={(event) => event.key === "Escape" && close()}
        >
          <PanelContent block={block} />
        </aside>
      )
    );
  }

  return (
    <Dialog.Root open={block !== null} onOpenChange={(open) => !open && close()} modal={false}>
      <Dialog.Portal>
        <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col gap-4 overflow-y-auto rounded-t-xl border-t bg-popover p-4 text-popover-foreground shadow-[0_-8px_24px_rgb(0_0_0/0.12)] transition duration-200 data-ending-style:translate-y-8 data-ending-style:opacity-0 data-starting-style:translate-y-8 data-starting-style:opacity-0">
          <Dialog.Title className="sr-only">{LABEL}</Dialog.Title>
          {block && <PanelContent block={block} />}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
