"use client";

import { usePathname } from "next/navigation";
import { pageAt } from "@/components/shell/app-shell";
import { ErrorScreen } from "@/components/shell/error-screen";
import { Workspace } from "@/components/workspace/workspace";

/** A page of the app that failed, inside the shell, which keeps working. */
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <Workspace page={pageAt(usePathname())} main={<ErrorScreen error={error} retry={retry} />} />;
}
