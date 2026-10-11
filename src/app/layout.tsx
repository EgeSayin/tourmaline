import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { CategoryFilterProvider } from "@/components/categories/category-filter";
import { RefreshWhenStale } from "@/components/shell/refresh-when-stale";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Schedule",
  description: "Auto-scheduling planner",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} antialiased`}>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <CategoryFilterProvider>{children}</CategoryFilterProvider>
          <RefreshWhenStale />
        </ThemeProvider>
      </body>
    </html>
  );
}
