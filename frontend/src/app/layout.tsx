import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { FeedbackFAB } from "@/components/feedback/FeedbackFAB";
import { AnalyticsConsent } from "@/components/common/AnalyticsConsent";
import { AuthSync } from "@/components/common/AuthSync";
import { SessionProvider } from "next-auth/react";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

const siteUrl = "https://wharescore.co.nz";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "WhareScore — Everything the listing doesn't tell you",
    template: "%s | WhareScore",
  },
  description:
    "Free NZ property intelligence. Enter any address for hazard exposure, crime data, school zones, fair rent analysis, and more — powered by 40+ government data sources.",
  openGraph: {
    type: "website",
    locale: "en_NZ",
    siteName: "WhareScore",
    title: "WhareScore — Everything the listing doesn't tell you",
    description:
      "Free NZ property report. Flood risk, earthquake zones, school ratings, crime stats, fair rent — for any NZ address.",
    url: siteUrl,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "WhareScore — Free NZ property intelligence",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "WhareScore — NZ Property Intelligence",
    description:
      "Free property report for any NZ address. Hazards, schools, crime, rent fairness — everything the listing doesn't tell you.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <SessionProvider>
          <Providers>
            <AuthSync />
            {children}
            <FeedbackFAB />
            <AnalyticsConsent />
          </Providers>
        </SessionProvider>
      </body>
    </html>
  );
}
