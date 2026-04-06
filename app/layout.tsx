import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ClerkProvider } from "@clerk/nextjs";
import Script from "next/script";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#0D1F3C",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://lanebrief.com"),
  title: "LaneBrief — Freight Intelligence & Lane Analysis for Independent Brokers",
  description:
    "Stop flying blind on lane rates. LaneBrief delivers monthly AI-powered freight intelligence briefs — lane analysis, rate forecasts, and freight market data — starting at $199/month. Built for independent brokers.",
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
      "Stop flying blind on lane rates. Monthly AI-powered freight market data, lane analysis, and rate forecasts built for independent brokers. Starting at $199/month.",
    url: "https://lanebrief.com",
    siteName: "LaneBrief",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "LaneBrief — Freight Intelligence for Independent Brokers",
    description:
      "Lane-level freight market data, rate forecasts, and capacity signals. Starting at $199/month — not $3,600/year.",
    creator: "@lanebrief",
    site: "@lanebrief",
  },
  alternates: {
    canonical: "https://lanebrief.com",
  },
  appleWebApp: {
    capable: true,
    title: "LaneBrief",
    statusBarStyle: "black-translucent",
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
        "@type": "AggregateOffer",
        lowPrice: "199",
        highPrice: "599",
        priceCurrency: "USD",
        offerCount: 3,
        offers: [
          {
            "@type": "Offer",
            name: "Scout — 3 Lanes",
            price: "199",
            priceCurrency: "USD",
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: "199",
              priceCurrency: "USD",
              unitCode: "MON",
            },
          },
          {
            "@type": "Offer",
            name: "Navigator — 5 Lanes",
            price: "349",
            priceCurrency: "USD",
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: "349",
              priceCurrency: "USD",
              unitCode: "MON",
            },
          },
          {
            "@type": "Offer",
            name: "Command — 10 Lanes",
            price: "599",
            priceCurrency: "USD",
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: "599",
              priceCurrency: "USD",
              unitCode: "MON",
            },
          },
        ],
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
  const content = (
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
      <SpeedInsights />
      {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
      )}
      <Script
        id="meta-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
            n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
            (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
            fbq('init','1516225200040551');
            fbq('track','PageView');
          `,
        }}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src="https://www.facebook.com/tr?id=1516225200040551&ev=PageView&noscript=1"
          alt=""
        />
      </noscript>
    </html>
  );

  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <ClerkProvider>{content}</ClerkProvider>;
  }

  return content;
}
