import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ClerkProvider } from "@clerk/nextjs";
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
        <ClerkProvider
          appearance={{
            variables: {
              colorPrimary: "#3B82F6",
              colorBackground: "#19191d",
              colorText: "#e6e4ec",
              colorTextSecondary: "#abaab1",
              colorTextOnPrimaryBackground: "#ffffff",
              colorInputBackground: "#0e0e10",
              colorInputText: "#e6e4ec",
              colorNeutral: "#abaab1",
              colorDanger: "#ee7d77",
              borderRadius: "0.125rem",
              fontFamily: "var(--font-geist-sans)",
              fontFamilyButtons: "var(--font-geist-sans)",
            },
            elements: {
              rootBox: "w-full",
              card: "bg-surface-container border border-white/10 shadow-2xl shadow-black/40",
              headerTitle: "text-on-surface tracking-tight",
              headerSubtitle: "text-on-surface-variant",
              socialButtonsBlockButton:
                "border border-white/10 bg-surface-container-low text-on-surface hover:bg-surface-container-high",
              socialButtonsBlockButtonText: "text-on-surface font-medium",
              dividerLine: "bg-white/10",
              dividerText: "text-on-surface-variant",
              formFieldLabel: "text-on-surface-variant font-normal",
              formFieldInput:
                "bg-surface-container-lowest border border-white/10 text-on-surface focus:border-primary",
              formButtonPrimary:
                "bg-primary text-on-primary font-semibold hover:opacity-90 normal-case shadow-none",
              footerAction: "text-on-surface-variant",
              footerActionText: "text-on-surface-variant",
              footerActionLink: "text-primary hover:opacity-80",
              identityPreviewText: "text-on-surface",
              identityPreviewEditButton: "text-primary",
              organizationSwitcherTrigger:
                "border border-white/10 bg-surface-container hover:bg-surface-container-high",
              userButtonBox: "text-on-surface",
              userButtonOuterIdentifier: "text-on-surface",
            },
          }}
        >
          {children}
          <Analytics />
          <SpeedInsights />
        </ClerkProvider>
      </body>
    </html>
  );
}
