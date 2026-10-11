import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function ActionButton({
  action,
  onDone,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "onClick"> & { action: () => Promise<void>; onDone?: () => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await action();
          onDone?.();
        })
      }
      {...props}
    />
  );
}
