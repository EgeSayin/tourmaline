"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function StartDemoButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto sm:px-6">
      {pending ? "Setting up your week…" : "Try the demo"}
    </Button>
  );
}
