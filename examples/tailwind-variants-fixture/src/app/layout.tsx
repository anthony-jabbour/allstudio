import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Harbor Studio fixture",
  description: "Tailwind-variant Next.js fixture for allstudio source editing.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-white dark:bg-slate-950">{children}</body>
    </html>
  );
}
