import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toastChangedMeanwhile, toastNotSaved } from "./action-toasts";

export function ActionButton({
  action,
  onDone,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "onClick"> & {
  /** Resolves to `false` when what it acted on had changed meanwhile, so it changed nothing. */
  action: () => Promise<boolean | void>;
  onDone?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            if ((await action()) === false) toastChangedMeanwhile();
            else onDone?.();
          } catch {
            toastNotSaved();
          }
        })
      }
      {...props}
    />
  );
}
