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

export const metadata: Metadata = {
  title: "WhareScore — Everything the listing doesn't tell you",
  description:
    "Free NZ property intelligence. Enter any address for hazard exposure, crime data, school zones, fair rent analysis, and more — powered by 12+ government data sources.",
  robots: {
    index: false,
    follow: false,
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
