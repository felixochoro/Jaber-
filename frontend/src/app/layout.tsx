import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "SchoolConnect Atlas — Zambia School Connectivity",
  description:
    "Map-based platform for exploring school connectivity, telecom infrastructure, and cost data across Zambia.",
  keywords: ["Zambia", "schools", "connectivity", "GIS", "telecom", "fiber", "satellite"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="preconnect" href="https://api.mapbox.com" />
        <link rel="preconnect" href="https://events.mapbox.com" />
      </head>
      <body className="bg-[var(--color-surface-raised)] text-[var(--color-text-primary)] font-sans antialiased min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex flex-col">{children}</main>
      </body>
    </html>
  );
}
