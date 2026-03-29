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
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/ws-favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/ws-favicon-96.png", sizes: "96x96", type: "image/png" },
      { url: "/ws-favicon-192.png", sizes: "192x192", type: "image/png" },
    ],
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              {
                "@context": "https://schema.org",
                "@type": "WebSite",
                name: "WhareScore",
                url: siteUrl,
                description:
                  "Free NZ property intelligence. Hazard exposure, school zones, crime data, fair rent analysis — everything the listing doesn't tell you.",
                potentialAction: {
                  "@type": "SearchAction",
                  target: {
                    "@type": "EntryPoint",
                    urlTemplate: `${siteUrl}/?q={search_term_string}`,
                  },
                  "query-input": "required name=search_term_string",
                },
              },
              {
                "@context": "https://schema.org",
                "@type": "Organization",
                name: "WhareScore",
                url: siteUrl,
                logo: `${siteUrl}/ws-favicon-192.png`,
                sameAs: [],
              },
              {
                "@context": "https://schema.org",
                "@type": "SiteNavigationElement",
                name: ["About", "Help & FAQ", "Contact", "Sign In", "My Reports"],
                url: [
                  `${siteUrl}/about`,
                  `${siteUrl}/help`,
                  `${siteUrl}/contact`,
                  `${siteUrl}/signin`,
                  `${siteUrl}/account`,
                ],
              },
            ]),
          }}
        />
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
