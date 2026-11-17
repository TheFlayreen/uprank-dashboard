import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { InlineScript } from "@/components/ui/InlineScript";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

export const metadata: Metadata = {
  title: "Client Health Dashboard",
  description: "Who to call, why clients leave, and which trades are the best business.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the inline script may set data-theme on <html> before React hydrates.
    <html lang="en" className={`${jakarta.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <InlineScript html={THEME_INIT_SCRIPT} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
