import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { users, lanes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { FREE_LANE_LIMIT, isPro } from "@/lib/stripe";
import { Resend } from "resend";

async function getDbUser(clerkId: string) {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  return user ?? null;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getDbUser(userId);
  if (!user) return Response.json({ error: "User not found — call /api/user/sync first" }, { status: 404 });

  const db = getDb();
  const userLanes = await db.select().from(lanes).where(eq(lanes.userId, user.id));
  const proUser = isPro(user);
  return Response.json({
    lanes: userLanes,
    planTier: user.planTier,
    isPro: proUser,
    laneLimit: proUser ? null : FREE_LANE_LIMIT,
  });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getDbUser(userId);
  if (!user) return Response.json({ error: "User not found — call /api/user/sync first" }, { status: 404 });

  const db = getDb();
  const existing = await db.select().from(lanes).where(eq(lanes.userId, user.id));
  const proUser = isPro(user);

  if (!proUser && existing.length >= FREE_LANE_LIMIT) {
    return Response.json(
      {
        error: "Free plan limit reached",
        code: "LANE_LIMIT_REACHED",
        laneLimit: FREE_LANE_LIMIT,
        isPro: false,
      },
      { status: 422 }
    );
  }

  const body = await req.json();
  const { origin, destination, equipment = "dry_van" } = body as {
    origin: string;
    destination: string;
    equipment?: string;
  };

  if (!origin || !destination) {
    return Response.json({ error: "origin and destination are required" }, { status: 400 });
  }

  const [lane] = await db
    .insert(lanes)
    .values({ id: randomUUID(), userId: user.id, origin, destination, equipment })
    .returning();

  // Send upgrade email when free user saves their 3rd (last free) lane
  const newCount = existing.length + 1;
  if (!proUser && newCount === FREE_LANE_LIMIT) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const firstName = user.email.split("@")[0];
      await resend.emails.send({
        from: "Nick <nick@lanebrief.com>",
        to: user.email,
        subject: "You've maxed out your free lanes on LaneBrief",
        html: `<p>Hey ${firstName},</p>
<p>You've saved 3 lanes — that's the free plan limit.</p>
<p>Upgrade to LaneBrief Pro for unlimited lanes, 7-day forecasts, and your full Portfolio Intelligence View.</p>
<p>$79/month. Cancel anytime.</p>
<p><a href="https://lanebrief.com/pricing">Upgrade to Pro →</a></p>
<p>— Nick</p>`,
      });
    } catch (err) {
      console.error("Failed to send upgrade email:", err);
    }
  }

  return Response.json({ lane }, { status: 201 });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getDbUser(userId);
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const { laneId } = await req.json() as { laneId: string };
  if (!laneId) return Response.json({ error: "laneId required" }, { status: 400 });

  const db = getDb();
  await db.delete(lanes).where(and(eq(lanes.id, laneId), eq(lanes.userId, user.id)));
  return Response.json({ ok: true });
}
