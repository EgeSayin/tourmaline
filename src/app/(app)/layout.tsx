import { connection } from "next/server";
import { WorkspaceProvider } from "@/components/workspace/workspace";
import { loadClockFormat } from "@/server/db/settings-repository";
import { shownClockFormat } from "@/server/settings/clock-format";
import { loadShell } from "@/server/shell";
import { readWorkspace } from "@/server/workspaces/current-workspace";

/** The shell around every page of the app, loaded once and kept as the page changes. */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  await connection();
  const { shell, clockFormat } = await readWorkspace(async (tx, now) => ({
    shell: await loadShell(tx, now),
    clockFormat: await loadClockFormat(tx),
  }));
  return (
    <WorkspaceProvider shell={shell} clockFormat={await shownClockFormat(clockFormat)}>
      {children}
    </WorkspaceProvider>
  );
}
