import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { FeedbackFAB } from "@/components/feedback/FeedbackFAB";
import { AnalyticsConsent } from "@/components/common/AnalyticsConsent";

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>
          {children}
          <FeedbackFAB />
          <AnalyticsConsent />
        </Providers>
      </body>
    </html>
  );
}
