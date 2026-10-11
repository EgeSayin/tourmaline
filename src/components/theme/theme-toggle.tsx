"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { type Segment, SegmentedControl } from "@/components/controls/segmented-control";
import { useIsClient } from "@/hooks/use-is-client";

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
      size="icon-sm"
      className="inline-flex gap-0.5 p-0.5"
    />
  );
}
