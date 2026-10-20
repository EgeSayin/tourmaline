"use client";

import { catchError, type ErrorInfo } from "next/error";
import { Button } from "@/components/ui/button";
import { useReportError } from "./error-screen";

function AreaError(_: object, { error, retry }: ErrorInfo) {
  useReportError(error);
  return (
    <div role="alert" className="flex flex-col items-start gap-2 py-2 text-sm">
      <p className="text-muted-foreground">This part couldn&apos;t be shown.</p>
      <Button size="sm" variant="outline" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}

/** Keeps an error in one area of the page, such as a list or the block panel, from taking down the rest. */
export const AreaBoundary = catchError(AreaError);
