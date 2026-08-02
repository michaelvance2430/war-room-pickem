import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SeasonThemeApplier from "@/components/SeasonThemeApplier";
import SportThemeApplier from "@/components/SportThemeApplier";
import FoundrySessionChrome from "@/components/FoundrySessionChrome";
import SandboxSessionChrome from "@/components/SandboxSessionChrome";
import LeagueBuildGate from "@/components/LeagueBuildGate";
import PullToRefresh from "@/components/PullToRefresh";
import RouteHardSwitch from "@/components/RouteHardSwitch";
import BootWatchdog from "@/components/BootWatchdog";
import AppShell from "@/components/AppShell";

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
  description:
    "War Room Pick'Em — friend leagues for CFB & NFL. Confidence picks, Best Bets, props, dual brackets. Championship + Toilet Bowl. © Mike Vance.",
  applicationName: "War Room Pick'Em",
  authors: [{ name: "Mike Vance" }],
  creator: "Mike Vance",
  publisher: "Mike Vance",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "War Room",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/war-room-crest-64.png", sizes: "64x64", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/manifest.webmanifest",
  other: {
    copyright:
      "© 2026 Mike Vance. War Room Pick'Em. All rights reserved. Owned by Mike Vance.",
  },
};

/** Phone-first: full width, notch safe areas, dark status chrome */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0f0f0f" },
    { color: "#0f0f0f" },
  ],
  colorScheme: "dark",
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
      <body className="min-h-full flex flex-col bg-background text-foreground phone-shell">
        <RouteHardSwitch />
        <BootWatchdog />
        <SportThemeApplier />
        <SeasonThemeApplier />
        <FoundrySessionChrome />
        <SandboxSessionChrome />
        <LeagueBuildGate />
        <PullToRefresh>
          <AppShell>{children}</AppShell>
        </PullToRefresh>
      </body>
    </html>
  );
}
