import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://lanebrief.com"),
  title: "LaneBrief — Freight Intelligence & Lane Analysis for Independent Brokers",
  description:
    "Stop flying blind on lane rates. LaneBrief delivers monthly AI-powered freight intelligence briefs — lane analysis, rate forecasts, and freight market data — for $199/month. Built for independent brokers.",
  keywords: [
    "freight intelligence",
    "lane analysis",
    "freight market data",
    "freight rate forecast",
    "lane rate analysis",
    "freight broker intelligence",
    "dry van rates",
    "freight analytics",
    "spot rate forecast",
    "freight market analysis",
  ],
  authors: [{ name: "LaneBrief", url: "https://lanebrief.com" }],
  creator: "LaneBrief",
  publisher: "LaneBrief",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    title: "LaneBrief — Freight Intelligence & Lane Analysis",
    description:
      "Stop flying blind on lane rates. Monthly AI-powered freight market data, lane analysis, and rate forecasts built for independent brokers. $199/month.",
    url: "https://lanebrief.com",
    siteName: "LaneBrief",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "LaneBrief — Freight Intelligence for Independent Brokers",
    description:
      "Lane-level freight market data, rate forecasts, and capacity signals. $199/month — not $3,600/year.",
    creator: "@lanebrief",
    site: "@lanebrief",
  },
  alternates: {
    canonical: "https://lanebrief.com",
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://lanebrief.com/#organization",
      name: "LaneBrief",
      url: "https://lanebrief.com",
      description:
        "AI-powered freight intelligence platform delivering lane analysis and freight market data for independent brokers.",
      contactPoint: {
        "@type": "ContactPoint",
        email: "intel@lanebrief.com",
        contactType: "customer service",
      },
    },
    {
      "@type": "Service",
      "@id": "https://lanebrief.com/#service",
      name: "LaneBrief Freight Intelligence Brief",
      provider: { "@id": "https://lanebrief.com/#organization" },
      description:
        "Monthly AI-powered freight intelligence briefs with lane analysis, rate forecasts, and freight market data for independent freight brokers.",
      offers: {
        "@type": "Offer",
        price: "199",
        priceCurrency: "USD",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "199",
          priceCurrency: "USD",
          unitCode: "MON",
        },
      },
      audience: {
        "@type": "BusinessAudience",
        audienceType: "Independent freight brokers and logistics professionals",
      },
    },
    {
      "@type": "WebSite",
      "@id": "https://lanebrief.com/#website",
      url: "https://lanebrief.com",
      name: "LaneBrief",
      publisher: { "@id": "https://lanebrief.com/#organization" },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
      <Analytics />
      {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
      )}
    </html>
  );
}
