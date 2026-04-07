import { auth, clerkClient } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { users, lanes, reportShares, rateSnapshots, tenderAcceptanceCache, capacityHeatmapCache } from "@/lib/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { Resend } from "resend";
import { randomUUID } from "crypto";
import { buildIntelligenceReportHtml } from "@/app/api/cron/weekly-intelligence-report/route";
import type { LaneBrief } from "@/app/api/cron/weekly-intelligence-report/route";

const FROM = "LaneBrief Intel <intel@email.lanebrief.com>";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { referredEmail?: string };
  const referredEmail = (body.referredEmail ?? "").trim().toLowerCase();
  if (!referredEmail || !referredEmail.includes("@")) {
    return Response.json({ error: "Valid email required" }, { status: 400 });
  }

  const db = getDb();

  // Resolve internal user
  const [dbUser] = await db.select().from(users).where(eq(users.clerkId, userId)).limit(1);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  // Get Clerk profile for first name
  const clerk = await clerkClient();
  const clerkUser = await clerk.users.getUser(userId);
  const referrerName = clerkUser.firstName ?? "A colleague";

  // Get user's lanes (top 5)
  const userLanes = await db.select().from(lanes).where(eq(lanes.userId, dbUser.id)).limit(5);
  if (userLanes.length === 0) {
    return Response.json({ error: "No lanes to share" }, { status: 400 });
  }

  const laneIds = userLanes.map((l) => l.id);

  // Build report using cached data (fast — no AI calls for instant response)
  const [capacityRows, tenderRows, snapRows] = await Promise.all([
    db.select().from(capacityHeatmapCache).where(inArray(capacityHeatmapCache.laneId, laneIds)).orderBy(desc(capacityHeatmapCache.generatedAt)),
    db.select().from(tenderAcceptanceCache).where(inArray(tenderAcceptanceCache.laneId, laneIds)).orderBy(desc(tenderAcceptanceCache.generatedAt)),
    db.select().from(rateSnapshots).where(inArray(rateSnapshots.laneId, laneIds)).orderBy(desc(rateSnapshots.generatedAt)),
  ]);

  const capacityByLane = new Map(
    capacityRows.reduce<[string, typeof capacityRows[0]][]>((acc, r) => {
      if (!acc.find(([id]) => id === r.laneId)) acc.push([r.laneId, r]);
      return acc;
    }, [])
  );
  const tenderByLane = new Map(
    tenderRows.reduce<[string, typeof tenderRows[0]][]>((acc, r) => {
      if (!acc.find(([id]) => id === r.laneId)) acc.push([r.laneId, r]);
      return acc;
    }, [])
  );
  const snapByLane = new Map(
    snapRows.reduce<[string, typeof snapRows[0]][]>((acc, r) => {
      if (!acc.find(([id]) => id === r.laneId)) acc.push([r.laneId, r]);
      return acc;
    }, [])
  );

  const MX_HIGH_RISK = ["nuevo laredo", "laredo", "ciudad juarez", "ciudad juárez", "juarez", "juárez", "el paso", "reynosa", "pharr", "mcallen", "piedras negras", "eagle pass", "ciudad acuna", "ciudad acuña", "del rio", "nogales", "otay mesa", "tijuana"];
  const MX_MEDIUM_RISK = ["calexico", "mexicali"];
  const MX_GENERAL = ["mexico", " mx", ",mx", "monterrey", "guadalajara", "cdmx", "mexico city", "matamoros", "saltillo", "hermosillo", "chihuahua", "torreon"];
  const CA_HIGH_RISK = ["detroit", "windsor", "port huron", "sarnia"];
  const CA_MEDIUM_RISK = ["buffalo", "fort erie", "blaine", "surrey", "pembina", "emerson", "sweetgrass", "coutts"];
  const CA_GENERAL = ["canada", "ontario", "quebec", "british columbia", "alberta", "manitoba", "saskatchewan", "nova scotia", "new brunswick", "prince edward island", "newfoundland", " on,", " qc,", " ab,", " mb,", " sk,", " ns,", " nb,", " pe,", " nl,", "toronto", "montreal", "vancouver", "calgary", "edmonton", "ottawa", "winnipeg", "halifax", "hamilton", "london, on", "kitchener"];

  function getTariffFlag(origin: string, destination: string): LaneBrief["tariffFlag"] {
    const text = `${origin} ${destination}`.toLowerCase();
    if (MX_HIGH_RISK.some((kw) => text.includes(kw))) return "MX-high";
    if (CA_HIGH_RISK.some((kw) => text.includes(kw))) return "CA-high";
    if (MX_MEDIUM_RISK.some((kw) => text.includes(kw))) return "MX-medium";
    if (CA_MEDIUM_RISK.some((kw) => text.includes(kw))) return "CA-medium";
    if (MX_GENERAL.some((kw) => text.includes(kw))) return "MX-medium";
    if (CA_GENERAL.some((kw) => text.includes(kw))) return "CA-medium";
    return null;
  }

  const briefLanes: LaneBrief[] = userLanes.map((lane) => {
    const snap = snapByLane.get(lane.id);
    const cap = capacityByLane.get(lane.id);
    const tender = tenderByLane.get(lane.id);
    const rate = snap?.marketAvgUsdPerMile ?? 2.5;

    return {
      origin: lane.origin,
      destination: lane.destination,
      equipment: lane.equipment,
      rateSummary: `$${rate.toFixed(2)}/mi`,
      rateUsdPerMile: rate,
      deltaPct: snap?.deltaPct ?? null,
      capacitySignal: cap ? (cap.capacityLevel as LaneBrief["capacitySignal"]) : null,
      tenderRisk: tender ? (tender.riskLevel as LaneBrief["tenderRisk"]) : null,
      tenderAcceptancePct: tender?.estimatedAcceptancePct ?? null,
      tariffFlag: getTariffFlag(lane.origin, lane.destination),
      carrierRecommendation: cap?.reasoning ? cap.reasoning.slice(0, 60) : "Check regional carriers for best rates",
      aiSummary: `Current market conditions for ${lane.origin} → ${lane.destination}`,
    };
  });

  // Create share token + record
  const shareToken = randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db.insert(reportShares).values({
    id: randomUUID(),
    referrerUserId: dbUser.id,
    referredEmail,
    shareToken,
    expiresAt,
  });

  // Build share email HTML
  const weekOf = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const shareUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://lanebrief.com"}/reports/shared/${shareToken}`;

  const sharedByBanner = `
<div style="background: #EFF6FF; padding: 12px 20px; border-radius: 6px; margin-bottom: 20px; text-align: center; border: 1px solid #BFDBFE;">
  <p style="margin: 0; font-size: 13px; color: #1D4ED8; font-weight: bold;">📩 Sent to you by ${referrerName} via LaneBrief</p>
  <a href="${shareUrl}" style="color: #1D4ED8; font-size: 12px; text-decoration: none;">View online →</a>
</div>`;

  const reportHtml = buildIntelligenceReportHtml(briefLanes);

  // Inject shared-by banner after the header
  const htmlWithBanner = reportHtml.replace(
    /<div style="padding: 28px 0 0 0;/,
    `<div style="padding: 28px 0 0 0;`
  );

  // Build the full share email
  const referralCta = `
<div style="padding: 20px 24px; background: #F0FDF4; border-top: 1px solid #D1FAE5; text-align: center;">
  <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: bold; color: #0D1F3C;">
    ${referrerName} thought you'd find this useful.
  </p>
  <p style="margin: 0 0 12px 0; font-size: 13px; color: #4A5568;">
    LaneBrief delivers weekly freight market intelligence for your specific lanes — free to try.
  </p>
  <a href="https://lanebrief.com/sign-up" style="display: inline-block; background-color: #00C2A8; color: #FFFFFF; font-size: 14px; font-weight: bold; text-decoration: none; padding: 10px 24px; border-radius: 6px;">
    Get your own report → lanebrief.com/sign-up
  </a>
</div>`;

  const emailHtml = `
<div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px;">
  ${sharedByBanner}
  ${reportHtml}
  ${referralCta}
</div>`;

  // Send via Resend
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: FROM,
    replyTo: "intel@lanebrief.com",
    to: referredEmail,
    subject: `${referrerName} shared a LaneBrief freight market report with you`,
    html: emailHtml,
  });

  return Response.json({ ok: true, shareUrl });
}
