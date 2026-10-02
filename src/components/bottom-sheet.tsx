"use client";

import { Dialog } from "@base-ui/react/dialog";

/** A non-modal sheet sliding up from the bottom of the screen, for phones. */
export function BottomSheet({
  open,
  onClose,
  title,
  showTitle = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  showTitle?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()} modal={false}>
      <Dialog.Portal>
        <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 flex max-h-[50dvh] flex-col gap-4 overflow-y-auto rounded-t-xl border-t bg-popover p-4 text-popover-foreground shadow-[0_-8px_24px_rgb(0_0_0/0.12)] transition duration-200 data-ending-style:translate-y-8 data-ending-style:opacity-0 data-starting-style:translate-y-8 data-starting-style:opacity-0">
          <Dialog.Title className={showTitle ? "font-semibold" : "sr-only"}>{title}</Dialog.Title>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
