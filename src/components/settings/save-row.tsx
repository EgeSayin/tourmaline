import { Button } from "@/components/ui/button";

export function SaveRow({
  label,
  pending,
  saved,
  message,
}: {
  label: string;
  pending: boolean;
  saved: boolean;
  message: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : label}
      </Button>
      {saved && !pending && (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      )}
    </div>
  );
}
