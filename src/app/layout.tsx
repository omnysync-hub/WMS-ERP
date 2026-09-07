import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Workman Services — HVAC Enterprise ERP",
  description: "Enterprise HVAC Operations, Dispatch, Mobile Execution & Accounts",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased text-charcoal bg-background">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
