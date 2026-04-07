import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "API Documentation — LaneBrief",
  description: "Integrate LaneBrief freight intelligence into your TMS, spreadsheets, or internal tools via the REST API.",
};

const ENDPOINTS = [
  {
    method: "GET",
    path: "/api/v1/lanes",
    description: "List all lanes in your portfolio with latest rate snapshots.",
    params: [],
    response: `{
  "lanes": [
    {
      "id": "string",
      "origin": "chicago-il",
      "destination": "dallas-tx",
      "equipment": "dry_van",
      "rate_per_mile": 2.45,
      "market_avg_usd_per_mile": 2.31,
      "rate_updated_at": "2026-04-06T12:00:00Z"
    }
  ]
}`,
  },
  {
    method: "GET",
    path: "/api/v1/rates",
    description: "Get the latest rate snapshot for a specific lane.",
    params: [
      { name: "origin", required: true, description: "Origin city-state (e.g. chicago-il)" },
      { name: "destination", required: true, description: "Destination city-state (e.g. dallas-tx)" },
      { name: "equipment", required: false, description: "Equipment type: dry_van (default), reefer, flatbed" },
    ],
    response: `{
  "rate_per_mile": 2.45,
  "market_avg_usd_per_mile": 2.31,
  "total_miles": null,
  "confidence": "ai_estimated",
  "updated_at": "2026-04-06T12:00:00Z"
}`,
  },
  {
    method: "GET",
    path: "/api/v1/forecast",
    description: "Get the 7-day rate forecast for a lane.",
    params: [
      { name: "origin", required: true, description: "Origin city-state" },
      { name: "destination", required: true, description: "Destination city-state" },
      { name: "equipment", required: false, description: "Equipment type (default: dry_van)" },
    ],
    response: `{
  "direction": "up",
  "pct_change": 3.2,
  "confidence": "medium",
  "horizon_days": 7,
  "generated_at": "2026-04-06T12:00:00Z"
}`,
  },
  {
    method: "GET",
    path: "/api/v1/carrier/:dot_number",
    description: "Get carrier risk score and payment flags by DOT number.",
    params: [
      { name: "dot_number", required: true, description: "Carrier DOT number (path param)" },
    ],
    response: `{
  "mc_number": "123456",
  "carrier_name": "Acme Freight LLC",
  "risk_score": 72,
  "risk_level": "medium",
  "flags": ["slow pay history", "authority age < 2yr"],
  "last_checked": "2026-04-06T12:00:00Z"
}`,
  },
];

const ERROR_CODES = [
  { code: 400, label: "Bad Request", description: "Missing required query parameters." },
  { code: 401, label: "Unauthorized", description: "Missing, malformed, or revoked API key." },
  { code: 403, label: "Forbidden", description: "Your plan does not include API access. Upgrade to Pro or Enterprise." },
  { code: 404, label: "Not Found", description: "No data found for the requested lane or carrier." },
  { code: 429, label: "Rate Limited", description: "Monthly request limit reached (Pro: 1,000/mo). Upgrade to Enterprise for unlimited access." },
];

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b border-border/60 bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="font-semibold tracking-tight">LaneBrief</Link>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className={cn(buttonVariants({ size: "sm" }))}>
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-10 sm:py-16 space-y-14">
        {/* Header */}
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Developer Docs</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">LaneBrief API Documentation</h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Embed real-time freight rates, 7-day forecasts, and carrier risk scores directly into your TMS, spreadsheets, or internal tools.
          </p>
          <Link href="/dashboard" className={cn(buttonVariants(), "mt-2 inline-flex")}>
            Get your API key →
          </Link>
        </div>

        {/* Authentication */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Authentication</h2>
          <p className="text-sm text-muted-foreground">
            All API requests must include your API key in the <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">X-LaneBrief-Key</code> request header.
            Generate a key from your{" "}
            <Link href="/dashboard" className="text-primary underline underline-offset-2 hover:text-primary/80">dashboard settings</Link>.
          </p>
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
            <code className="text-xs font-mono text-foreground">X-LaneBrief-Key: lb_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx</code>
          </div>
          <div className="rounded-lg border border-border p-4 space-y-2">
            <p className="text-sm font-medium">Rate limits</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li><span className="font-medium text-foreground">Pro:</span> 1,000 requests / month</li>
              <li><span className="font-medium text-foreground">Enterprise:</span> Unlimited requests</li>
              <li><span className="font-medium text-foreground">All plans:</span> 60 requests / minute (soft limit)</li>
            </ul>
          </div>
        </section>

        {/* Endpoints */}
        <section className="space-y-8">
          <h2 className="text-xl font-semibold">Endpoints</h2>
          {ENDPOINTS.map((ep) => (
            <div key={ep.path} className="rounded-xl border border-border overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 border-b border-border">
                <span className="rounded bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground tracking-wide">
                  {ep.method}
                </span>
                <code className="text-sm font-mono font-medium">{ep.path}</code>
              </div>
              <div className="p-4 space-y-4">
                <p className="text-sm text-muted-foreground">{ep.description}</p>
                {ep.params.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Parameters</p>
                    <div className="rounded-lg border border-border divide-y divide-border">
                      {ep.params.map((p) => (
                        <div key={p.name} className="flex items-start gap-3 px-3 py-2.5">
                          <code className="text-xs font-mono text-foreground shrink-0">{p.name}</code>
                          {p.required ? (
                            <span className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary shrink-0">required</span>
                          ) : (
                            <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground shrink-0">optional</span>
                          )}
                          <span className="text-xs text-muted-foreground">{p.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Response</p>
                  <pre className="rounded-lg bg-muted/60 border border-border px-4 py-3 text-xs font-mono overflow-x-auto leading-relaxed">
                    {ep.response}
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Error codes */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Error Codes</h2>
          <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
            {ERROR_CODES.map((e) => (
              <div key={e.code} className="flex items-start gap-4 px-4 py-3">
                <span className="rounded bg-muted px-2 py-0.5 text-xs font-mono font-semibold shrink-0 mt-0.5">{e.code}</span>
                <div>
                  <span className="text-sm font-medium">{e.label}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">{e.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Code examples */}
        <section className="space-y-6">
          <h2 className="text-xl font-semibold">Code Examples</h2>

          {/* curl */}
          <div className="space-y-2">
            <p className="text-sm font-medium">cURL</p>
            <pre className="rounded-lg bg-muted/60 border border-border px-4 py-3 text-xs font-mono overflow-x-auto leading-relaxed">{`curl -G https://lanebrief.com/api/v1/rates \\
  -H "X-LaneBrief-Key: lb_live_YOUR_KEY" \\
  --data-urlencode "origin=chicago-il" \\
  --data-urlencode "destination=dallas-tx" \\
  --data-urlencode "equipment=dry_van"`}</pre>
          </div>

          {/* Python */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Python</p>
            <pre className="rounded-lg bg-muted/60 border border-border px-4 py-3 text-xs font-mono overflow-x-auto leading-relaxed">{`import requests

response = requests.get(
    "https://lanebrief.com/api/v1/rates",
    headers={"X-LaneBrief-Key": "lb_live_YOUR_KEY"},
    params={
        "origin": "chicago-il",
        "destination": "dallas-tx",
        "equipment": "dry_van",
    },
)
data = response.json()
print(data["rate_per_mile"])`}</pre>
          </div>

          {/* JavaScript */}
          <div className="space-y-2">
            <p className="text-sm font-medium">JavaScript (fetch)</p>
            <pre className="rounded-lg bg-muted/60 border border-border px-4 py-3 text-xs font-mono overflow-x-auto leading-relaxed">{`const res = await fetch(
  "https://lanebrief.com/api/v1/rates?origin=chicago-il&destination=dallas-tx&equipment=dry_van",
  { headers: { "X-LaneBrief-Key": "lb_live_YOUR_KEY" } }
);
const data = await res.json();
console.log(data.rate_per_mile);`}</pre>
          </div>

          {/* Google Sheets */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Google Sheets</p>
            <p className="text-xs text-muted-foreground">
              Note: API key authentication is not supported in <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">IMPORTDATA</code>. Use a Google Apps Script to call the API with a header instead.
            </p>
            <pre className="rounded-lg bg-muted/60 border border-border px-4 py-3 text-xs font-mono overflow-x-auto leading-relaxed">{`// In Google Apps Script (Tools > Script editor):
function getLaneBriefRate() {
  const url = "https://lanebrief.com/api/v1/rates?origin=chicago-il&destination=dallas-tx&equipment=dry_van";
  const res = UrlFetchApp.fetch(url, {
    headers: { "X-LaneBrief-Key": "lb_live_YOUR_KEY" }
  });
  const data = JSON.parse(res.getContentText());
  return data.rate_per_mile;
}`}</pre>
          </div>
        </section>

        {/* CTA */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 text-center space-y-3">
          <p className="font-semibold">Ready to integrate?</p>
          <p className="text-sm text-muted-foreground">
            Generate your API key from the dashboard. Pro plan includes 1,000 requests/month.
          </p>
          <Link href="/dashboard" className={cn(buttonVariants(), "inline-flex")}>
            Get your API key →
          </Link>
        </div>
      </main>
    </div>
  );
}
