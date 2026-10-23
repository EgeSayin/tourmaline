import Link from "next/link";

export function DemoNotice() {
  return (
    <>
      Accounts are disabled in the public demo.{" "}
      <Link href="/welcome" className="font-medium text-foreground underline-offset-4 hover:underline">
        Try the demo instead
      </Link>
    </>
  );
}
