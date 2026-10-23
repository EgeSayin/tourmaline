import { SiteFooter } from "@/components/shell/site-footer";
import { Wordmark } from "@/components/shell/wordmark";

/** The frame of the pages outside the app: sign-in and sign-up. */
export function AccountPage({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col gap-10 px-4 py-10">
      <Wordmark className="text-xl" />
      {children}
      <SiteFooter className="mt-auto border-t pt-6" />
    </main>
  );
}
