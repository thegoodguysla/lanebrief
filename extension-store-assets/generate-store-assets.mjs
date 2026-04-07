/**
 * Generates Chrome Web Store listing assets for LaneBrief extension.
 * Run: node scripts/generate-store-assets.mjs
 *
 * Outputs to: ./store-assets/
 *   screenshot-1.png  (1280x800)
 *   screenshot-2.png  (1280x800)
 *   screenshot-3.png  (1280x800)
 *   promo-small.png   (440x280)
 *   promo-marquee.png (1400x560)
 */

import sharp from "/Users/nicktaylor/.paperclip/instances/default/projects/5fb7ffaa-a6d7-4bbb-8b68-891e3e47807b/1efba934-9ac1-4fdf-814b-325bebe0249d/_default/lanebrief/node_modules/sharp/lib/index.js";
import { mkdir } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "store-assets");
await mkdir(OUT, { recursive: true });

// Brand tokens
const BG = "#0D1F3C";
const TEAL = "#00C2A8";
const WHITE = "#FFFFFF";
const MUTED = "#94A3B8";
const CARD = "#132744";
const RED = "#EF4444";
const GREEN = "#22C55E";

function svgToPng(svgStr, width, height, outPath) {
  return sharp(Buffer.from(svgStr))
    .resize(width, height)
    .png()
    .toFile(outPath);
}

// ─── Screenshot 1: Rate overlay on a load search (1280x800) ──────────────────
const ss1 = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800">
  <defs>
    <style>
      text { font-family: Arial, Helvetica, sans-serif; }
    </style>
  </defs>
  <!-- Background page sim -->
  <rect width="1280" height="800" fill="#F8FAFC"/>
  <!-- Top bar sim -->
  <rect width="1280" height="56" fill="#1E293B"/>
  <text x="24" y="36" fill="${WHITE}" font-size="20" font-weight="bold">DAT One</text>
  <text x="200" y="36" fill="#94A3B8" font-size="14">Load Board</text>

  <!-- Load list rows -->
  <rect x="24" y="72" width="760" height="52" rx="6" fill="${WHITE}" stroke="#E2E8F0" stroke-width="1"/>
  <text x="44" y="102" fill="#1E293B" font-size="13" font-weight="bold">Chicago, IL → Dallas, TX</text>
  <text x="460" y="102" fill="#64748B" font-size="13">52,000 lbs  •  Dry Van  •  Flatbed</text>

  <rect x="24" y="132" width="760" height="52" rx="6" fill="${WHITE}" stroke="#E2E8F0" stroke-width="1"/>
  <text x="44" y="162" fill="#1E293B" font-size="13" font-weight="bold">Chicago, IL → Dallas, TX</text>
  <text x="460" y="162" fill="#64748B" font-size="13">44,000 lbs  •  Dry Van</text>

  <rect x="24" y="192" width="760" height="52" rx="6" fill="${WHITE}" stroke="#E2E8F0" stroke-width="1"/>
  <text x="44" y="222" fill="#1E293B" font-size="13" font-weight="bold">Chicago, IL → Dallas, TX</text>
  <text x="460" y="222" fill="#64748B" font-size="13">48,000 lbs  •  Dry Van</text>

  <!-- LaneBrief overlay panel -->
  <rect x="820" y="56" width="436" height="720" rx="12" fill="${BG}"/>
  <rect x="820" y="56" width="436" height="4" rx="2" fill="${TEAL}"/>

  <!-- Panel header -->
  <text x="844" y="96" fill="${TEAL}" font-size="16" font-weight="bold">▸ LaneBrief</text>
  <text x="920" y="96" fill="${WHITE}" font-size="16" font-weight="bold"> Rate Intelligence</text>
  <text x="844" y="116" fill="${MUTED}" font-size="12">Chicago, IL → Dallas, TX  •  Dry Van</text>

  <!-- Rate cards -->
  <rect x="844" y="134" width="180" height="80" rx="8" fill="${CARD}"/>
  <text x="864" y="158" fill="${MUTED}" font-size="10" text-transform="uppercase">Current Rate</text>
  <text x="864" y="186" fill="${WHITE}" font-size="28" font-weight="bold">$2.84</text>
  <text x="940" y="186" fill="${MUTED}" font-size="12">/mi</text>

  <rect x="1036" y="134" width="180" height="80" rx="8" fill="${CARD}"/>
  <text x="1056" y="158" fill="${MUTED}" font-size="10">7-Day Forecast</text>
  <text x="1056" y="182" fill="${RED}" font-size="22" font-weight="bold">▲ +8.4%</text>
  <text x="1056" y="202" fill="${MUTED}" font-size="11">High confidence</text>

  <!-- Capacity signal -->
  <rect x="844" y="228" width="372" height="64" rx="8" fill="${CARD}"/>
  <text x="864" y="252" fill="${MUTED}" font-size="11">Carrier Capacity</text>
  <text x="864" y="278" fill="${RED}" font-size="18" font-weight="bold">🔴 Tight</text>
  <text x="980" y="278" fill="${MUTED}" font-size="11">Spring produce pulling trucks from dry van pools</text>

  <!-- Profit calculator -->
  <rect x="844" y="306" width="372" height="120" rx="8" fill="${CARD}"/>
  <text x="864" y="330" fill="${WHITE}" font-size="13" font-weight="bold">Quick Profit Check</text>
  <text x="864" y="356" fill="${MUTED}" font-size="12">Miles: 921  •  Rate: $2.84/mi</text>
  <text x="864" y="376" fill="${MUTED}" font-size="12">Carrier cost est.: $2.10/mi</text>
  <rect x="864" y="390" width="332" height="2" fill="#1E3A5F"/>
  <text x="864" y="414" fill="${GREEN}" font-size="16" font-weight="bold">Margin: $684  (26%)</text>

  <!-- Carrier risk -->
  <rect x="844" y="440" width="372" height="100" rx="8" fill="${CARD}"/>
  <text x="864" y="464" fill="${WHITE}" font-size="13" font-weight="bold">Top Carrier Risk Scores</text>
  <text x="864" y="488" fill="${GREEN}" font-size="12">● Landstar System  —  Low Risk (92)</text>
  <text x="864" y="508" fill="${GREEN}" font-size="12">● Werner Enterprises  —  Low Risk (88)</text>
  <text x="864" y="528" fill="#F59E0B" font-size="12">● Covenant Logistics  —  Medium Risk (71)</text>

  <!-- CTA -->
  <rect x="844" y="556" width="372" height="44" rx="8" fill="${TEAL}"/>
  <text x="1030" y="583" fill="${BG}" font-size="14" font-weight="bold" text-anchor="middle">View Full Lane Brief →</text>

  <!-- Label badge -->
  <rect x="820" y="760" width="436" height="16" rx="0" fill="${TEAL}" opacity="0.1"/>
  <text x="1038" y="772" fill="${TEAL}" font-size="10" text-anchor="middle">lanebrief.com</text>
</svg>`;

// ─── Screenshot 2: Extension popup (1280x800) ─────────────────────────────────
const ss2 = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800">
  <!-- Background -->
  <rect width="1280" height="800" fill="#1E293B"/>

  <!-- Center popup sim -->
  <rect x="440" y="80" width="400" height="640" rx="12" fill="${BG}"/>
  <rect x="440" y="80" width="400" height="4" rx="2" fill="${TEAL}"/>

  <!-- Header -->
  <text x="460" y="122" fill="${TEAL}" font-size="18" font-weight="bold">▸ LaneBrief</text>
  <text x="460" y="146" fill="${MUTED}" font-size="12">Your saved lanes at a glance</text>

  <!-- Lane rows -->
  <rect x="460" y="162" width="360" height="72" rx="8" fill="${CARD}"/>
  <text x="480" y="188" fill="${WHITE}" font-size="13" font-weight="bold">CHI → DAL</text>
  <text x="480" y="208" fill="${MUTED}" font-size="11">$2.84/mi  •  Dry Van</text>
  <text x="720" y="194" fill="${RED}" font-size="18" font-weight="bold" text-anchor="end">▲ +8.4%</text>
  <text x="720" y="214" fill="${MUTED}" font-size="10" text-anchor="end">rates rising</text>

  <rect x="460" y="246" width="360" height="72" rx="8" fill="${CARD}"/>
  <text x="480" y="272" fill="${WHITE}" font-size="13" font-weight="bold">LAX → SEA</text>
  <text x="480" y="292" fill="${MUTED}" font-size="11">$3.12/mi  •  Dry Van</text>
  <text x="720" y="278" fill="${GREEN}" font-size="18" font-weight="bold" text-anchor="end">▼ -3.1%</text>
  <text x="720" y="298" fill="${MUTED}" font-size="10" text-anchor="end">rates softening</text>

  <rect x="460" y="330" width="360" height="72" rx="8" fill="${CARD}"/>
  <text x="480" y="356" fill="${WHITE}" font-size="13" font-weight="bold">ATL → NYC</text>
  <text x="480" y="376" fill="${MUTED}" font-size="11">$3.45/mi  •  Dry Van</text>
  <text x="720" y="362" fill="${MUTED}" font-size="18" font-weight="bold" text-anchor="end">→ Flat</text>
  <text x="720" y="382" fill="${MUTED}" font-size="10" text-anchor="end">stable</text>

  <!-- View Dashboard CTA -->
  <rect x="460" y="432" width="360" height="44" rx="8" fill="${TEAL}"/>
  <text x="640" y="459" fill="${BG}" font-size="14" font-weight="bold" text-anchor="middle">Open LaneBrief Dashboard →</text>

  <!-- Promo text -->
  <text x="640" y="520" fill="${WHITE}" font-size="22" font-weight="bold" text-anchor="middle">Rate intelligence,</text>
  <text x="640" y="548" fill="${TEAL}" font-size="22" font-weight="bold" text-anchor="middle">right where you work.</text>
  <text x="640" y="580" fill="${MUTED}" font-size="14" text-anchor="middle">Real-time rate overlays on DAT and Loadsmith.</text>
  <text x="640" y="602" fill="${MUTED}" font-size="14" text-anchor="middle">7-day forecasts. Carrier risk scores.</text>
</svg>`;

// ─── Screenshot 3: Lane brief detail (1280x800) ───────────────────────────────
const ss3 = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800">
  <rect width="1280" height="800" fill="${BG}"/>
  <rect width="1280" height="4" fill="${TEAL}"/>

  <!-- Nav -->
  <rect width="1280" height="56" fill="${CARD}"/>
  <text x="24" y="36" fill="${TEAL}" font-size="18" font-weight="bold">▸ LaneBrief</text>
  <text x="200" y="36" fill="${MUTED}" font-size="13">Chicago, IL → Dallas, TX</text>

  <!-- Headline -->
  <text x="64" y="112" fill="${WHITE}" font-size="32" font-weight="bold">Chicago → Dallas</text>
  <text x="64" y="144" fill="${MUTED}" font-size="16">Dry Van  •  Updated today</text>

  <!-- Rate cards row -->
  <rect x="64" y="168" width="220" height="96" rx="10" fill="${CARD}"/>
  <text x="84" y="196" fill="${MUTED}" font-size="11">CURRENT RATE</text>
  <text x="84" y="234" fill="${WHITE}" font-size="36" font-weight="bold">$2.84</text>
  <text x="184" y="234" fill="${MUTED}" font-size="14">/mi</text>

  <rect x="304" y="168" width="220" height="96" rx="10" fill="${CARD}"/>
  <text x="324" y="196" fill="${MUTED}" font-size="11">MARKET AVG (30D)</text>
  <text x="324" y="234" fill="${WHITE}" font-size="36" font-weight="bold">$2.61</text>
  <text x="424" y="234" fill="${MUTED}" font-size="14">/mi</text>

  <rect x="544" y="168" width="220" height="96" rx="10" fill="${CARD}"/>
  <text x="564" y="196" fill="${MUTED}" font-size="11">7-DAY FORECAST</text>
  <text x="564" y="228" fill="${RED}" font-size="26" font-weight="bold">▲ +8.4%</text>
  <text x="564" y="250" fill="${MUTED}" font-size="11">High confidence</text>

  <rect x="784" y="168" width="220" height="96" rx="10" fill="${CARD}"/>
  <text x="804" y="196" fill="${MUTED}" font-size="11">CAPACITY</text>
  <text x="804" y="234" fill="${RED}" font-size="22" font-weight="bold">🔴 Tight</text>

  <!-- Sparkline area -->
  <rect x="64" y="284" width="940" height="140" rx="10" fill="${CARD}"/>
  <text x="84" y="312" fill="${WHITE}" font-size="13" font-weight="bold">30-Day Rate Trend</text>
  <polyline points="84,380 140,370 196,365 252,372 308,360 364,350 420,355 476,345 532,340 588,332 644,338 700,325 756,318 812,310 868,305 924,295 980,288" fill="none" stroke="${RED}" stroke-width="2.5" stroke-linejoin="round"/>
  <text x="84" y="408" fill="${MUTED}" font-size="11">$2.40 low</text>
  <text x="940" y="408" fill="${MUTED}" font-size="11" text-anchor="end">$2.84 high</text>

  <!-- Forecast card -->
  <rect x="64" y="444" width="460" height="100" rx="10" fill="${CARD}"/>
  <text x="84" y="470" fill="${WHITE}" font-size="13" font-weight="bold">Rate Forecast</text>
  <text x="84" y="494" fill="${RED}" font-size="18" font-weight="bold">▲ Rates Rising  (+8.4%)</text>
  <text x="84" y="516" fill="${MUTED}" font-size="12">Spring produce season is pulling flatbed and reefer</text>
  <text x="84" y="534" fill="${MUTED}" font-size="12">trucks, tightening dry van capacity in the Midwest.</text>

  <!-- Carrier capacity card -->
  <rect x="544" y="444" width="460" height="100" rx="10" fill="${CARD}"/>
  <text x="564" y="470" fill="${WHITE}" font-size="13" font-weight="bold">Carrier Capacity</text>
  <text x="564" y="494" fill="${RED}" font-size="18" font-weight="bold">🔴 Tight</text>
  <text x="564" y="516" fill="${MUTED}" font-size="12">Fewer available dry van trucks than typical for</text>
  <text x="564" y="534" fill="${MUTED}" font-size="12">this lane. Lock in carrier rates early.</text>
</svg>`;

// ─── Small promo tile (440x280) ───────────────────────────────────────────────
const promoSmall = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="280">
  <rect width="440" height="280" fill="${BG}"/>
  <rect width="440" height="4" fill="${TEAL}"/>

  <!-- Wordmark -->
  <text x="32" y="68" fill="${TEAL}" font-size="28" font-weight="bold">▸</text>
  <text x="56" y="68" fill="${WHITE}" font-size="28" font-weight="bold">LaneBrief</text>

  <text x="32" y="108" fill="${WHITE}" font-size="20" font-weight="bold">Rate intelligence for</text>
  <text x="32" y="134" fill="${TEAL}" font-size="20" font-weight="bold">freight brokers.</text>

  <text x="32" y="172" fill="${MUTED}" font-size="13">Real-time overlays on DAT &amp; Loadsmith.</text>
  <text x="32" y="192" fill="${MUTED}" font-size="13">7-day forecasts. Carrier risk scores.</text>

  <!-- Mini rate badge -->
  <rect x="32" y="216" width="160" height="44" rx="8" fill="${CARD}"/>
  <text x="52" y="236" fill="${MUTED}" font-size="10">CHI→DAL  TODAY</text>
  <text x="52" y="254" fill="${WHITE}" font-size="16" font-weight="bold">$2.84/mi</text>
  <text x="152" y="250" fill="${RED}" font-size="14" font-weight="bold">▲ +8.4%</text>
</svg>`;

// ─── Marquee promo tile (1400x560) ────────────────────────────────────────────
const promoMarquee = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="560">
  <rect width="1400" height="560" fill="${BG}"/>
  <rect width="1400" height="6" fill="${TEAL}"/>
  <rect x="0" y="554" width="1400" height="6" fill="${TEAL}"/>

  <!-- Left: branding -->
  <text x="80" y="148" fill="${TEAL}" font-size="40" font-weight="bold">▸</text>
  <text x="128" y="148" fill="${WHITE}" font-size="40" font-weight="bold">LaneBrief</text>

  <text x="80" y="210" fill="${WHITE}" font-size="32" font-weight="bold">Freight rate intelligence,</text>
  <text x="80" y="252" fill="${TEAL}" font-size="32" font-weight="bold">right inside DAT &amp; Loadsmith.</text>

  <text x="80" y="308" fill="${MUTED}" font-size="18">See current rates, 7-day forecasts, and carrier risk scores</text>
  <text x="80" y="334" fill="${MUTED}" font-size="18">overlaid on every load — without switching tabs.</text>

  <text x="80" y="388" fill="${WHITE}" font-size="15">Free for 3 lanes  •  No credit card required</text>

  <rect x="80" y="420" width="240" height="56" rx="10" fill="${TEAL}"/>
  <text x="200" y="453" fill="${BG}" font-size="16" font-weight="bold" text-anchor="middle">Install Free →</text>

  <!-- Right: mock overlay card -->
  <rect x="820" y="80" width="500" height="400" rx="16" fill="${CARD}"/>
  <rect x="820" y="80" width="500" height="4" rx="2" fill="${TEAL}"/>

  <text x="848" y="124" fill="${TEAL}" font-size="16" font-weight="bold">▸ LaneBrief</text>
  <text x="932" y="124" fill="${WHITE}" font-size="16" font-weight="bold"> Rate Intelligence</text>
  <text x="848" y="148" fill="${MUTED}" font-size="13">Chicago, IL → Dallas, TX</text>

  <rect x="848" y="168" width="200" height="84" rx="8" fill="${BG}"/>
  <text x="868" y="194" fill="${MUTED}" font-size="11">CURRENT RATE</text>
  <text x="868" y="232" fill="${WHITE}" font-size="32" font-weight="bold">$2.84/mi</text>

  <rect x="1060" y="168" width="200" height="84" rx="8" fill="${BG}"/>
  <text x="1080" y="194" fill="${MUTED}" font-size="11">7-DAY FORECAST</text>
  <text x="1080" y="224" fill="${RED}" font-size="26" font-weight="bold">▲ +8.4%</text>
  <text x="1080" y="244" fill="${MUTED}" font-size="12">Rising  •  High confidence</text>

  <rect x="848" y="268" width="412" height="60" rx="8" fill="${BG}"/>
  <text x="868" y="292" fill="${MUTED}" font-size="12">Carrier Capacity</text>
  <text x="868" y="316" fill="${RED}" font-size="16" font-weight="bold">🔴 Tight  —  Lock in carrier rates now</text>

  <rect x="848" y="344" width="412" height="48" rx="8" fill="${TEAL}"/>
  <text x="1054" y="373" fill="${BG}" font-size="14" font-weight="bold" text-anchor="middle">View Full Lane Brief →</text>

  <text x="1070" y="450" fill="${MUTED}" font-size="12" text-anchor="middle">lanebrief.com</text>
</svg>`;

// ─── Render all ───────────────────────────────────────────────────────────────
const tasks = [
  { svg: ss1,         w: 1280, h: 800,  file: "screenshot-1.png" },
  { svg: ss2,         w: 1280, h: 800,  file: "screenshot-2.png" },
  { svg: ss3,         w: 1280, h: 800,  file: "screenshot-3.png" },
  { svg: promoSmall,  w: 440,  h: 280,  file: "promo-small.png"  },
  { svg: promoMarquee,w: 1400, h: 560,  file: "promo-marquee.png"},
];

for (const { svg, w, h, file } of tasks) {
  const outPath = join(OUT, file);
  await sharp(Buffer.from(svg))
    .resize(w, h, { fit: "fill" })
    .png()
    .toFile(outPath);
  console.log(`✓ ${file}`);
}

console.log(`\nAll assets written to: ${OUT}`);
