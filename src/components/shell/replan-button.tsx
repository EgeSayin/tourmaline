"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { ActionButton } from "@/components/forms/action-button";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { replanFreshAction } from "@/server/planning/actions";

export function ReplanButton() {
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant="outline" />}>
        <RefreshCw />
        Replan
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Plan everything again?</AlertDialogTitle>
          <AlertDialogDescription>
            Every block that hasn&apos;t started is placed again from scratch, so your schedule may change a lot. Blocks
            you have done, started or pinned stay where they are.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <ActionButton variant="destructive" action={replanFreshAction} onDone={() => setOpen(false)}>
            Plan again
          </ActionButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
