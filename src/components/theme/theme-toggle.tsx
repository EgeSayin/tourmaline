"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

const OPTIONS = [
  { value: "light", label: "Light theme", Icon: Sun },
  { value: "dark", label: "Dark theme", Icon: Moon },
  { value: "system", label: "System theme", Icon: Monitor },
] as const;

const subscribeNever = () => () => {};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // The chosen theme lives in the browser; showing it during server rendering would cause a hydration mismatch.
  const isClient = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );

  return (
    <div role="group" aria-label="Theme" className="inline-flex gap-0.5 rounded-lg border bg-card p-0.5">
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = isClient && theme === value;
        return (
          <Button
            key={value}
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            aria-pressed={active}
            className={active ? "bg-muted text-foreground" : "text-muted-foreground"}
            onClick={() => setTheme(value)}
          >
            <Icon />
          </Button>
        );
      })}
    </div>
  );
}
