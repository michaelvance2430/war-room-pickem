import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SeasonThemeApplier from "@/components/SeasonThemeApplier";
import PullToRefresh from "@/components/PullToRefresh";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "War Room Pick'Em",
  description: "College Football Pick'Em with divisions, confidence, Best Bets, props, and dual brackets. Championship + Toilet Bowl.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <SeasonThemeApplier />
        <PullToRefresh>{children}</PullToRefresh>
      </body>
    </html>
  );
}
