import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { getAppOrigin } from "@/lib/origin";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getAppOrigin()),
  title: "AgentKey — Agent Access Management",
  description:
    "Access governance for AI agents. Manage which SaaS tools your agents can access with human approval, encrypted credentials on demand, and full audit logging. Free, self-hostable, framework-agnostic.",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AgentKey — Agent Access Management",
    description:
      "Manage which SaaS tools your AI agents can access. Human approval, encrypted credentials, audit logging. Free and self-hostable.",
  },
  openGraph: {
    title: "AgentKey — Agent Access Management",
    description:
      "Manage which SaaS tools your AI agents can access. Human approval, encrypted credentials, audit logging. Free and self-hostable.",
    url: "/",
    siteName: "AgentKey",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body>
        {children}
      </body>
    </html>
  );
}
