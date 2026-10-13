import { connection } from "next/server";
import { WorkspaceProvider } from "@/components/workspace/workspace";
import { loadShell } from "@/server/shell";
import { readWorkspace } from "@/server/workspaces/current-workspace";

/** The shell around every page of the app, loaded once and kept as the page changes. */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  await connection();
  const shell = await readWorkspace(loadShell);
  return <WorkspaceProvider shell={shell}>{children}</WorkspaceProvider>;
}
