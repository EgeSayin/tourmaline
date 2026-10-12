import type { Metadata } from "next";
import { Fraunces, Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { CategoryFilterProvider } from "@/components/categories/category-filter";
import { RefreshWhenStale } from "@/components/shell/refresh-when-stale";
import { APP_NAME } from "@/components/shell/wordmark";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Auto-scheduling planner",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${fraunces.variable} antialiased`}>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <CategoryFilterProvider>{children}</CategoryFilterProvider>
          <RefreshWhenStale />
        </ThemeProvider>
      </body>
    </html>
  );
}
