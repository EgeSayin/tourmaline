"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { type Segment, SegmentedControl } from "@/components/controls/segmented-control";
import { buttonVariants } from "@/components/ui/button";
import { useIsClient } from "@/hooks/use-is-client";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light theme", content: <Sun /> },
  { value: "dark", label: "Dark theme", content: <Moon /> },
  { value: "system", label: "System theme", content: <Monitor /> },
] as const satisfies Segment<string>[];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // The chosen theme lives in the browser; showing it during server rendering would cause a hydration mismatch.
  const isClient = useIsClient();

  return (
    <SegmentedControl
      label="Theme"
      options={OPTIONS}
      value={isClient ? OPTIONS.find((option) => option.value === theme)?.value : undefined}
      onChange={setTheme}
      className="inline-flex gap-0.5 rounded-lg border bg-card p-0.5"
      optionClassName={cn(
        buttonVariants({ variant: "ghost", size: "icon-sm" }),
        "text-muted-foreground aria-checked:bg-muted aria-checked:text-foreground",
      )}
    />
  );
}
