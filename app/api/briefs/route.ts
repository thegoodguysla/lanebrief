import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { users, briefs, lanes } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

async function getDbUser(clerkId: string) {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  return user ?? null;
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getDbUser(userId);
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const laneId = searchParams.get("laneId");

  const db = getDb();
  const query = db
    .select()
    .from(briefs)
    .where(
      laneId
        ? and(eq(briefs.userId, user.id), eq(briefs.laneId, laneId))
        : eq(briefs.userId, user.id)
    )
    .orderBy(desc(briefs.generatedAt))
    .limit(20);

  const results = await query;
  return Response.json({ briefs: results });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getDbUser(userId);
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const { laneId } = await req.json() as { laneId: string };
  if (!laneId) return Response.json({ error: "laneId required" }, { status: 400 });

  const db = getDb();
  const [lane] = await db
    .select()
    .from(lanes)
    .where(and(eq(lanes.id, laneId), eq(lanes.userId, user.id)))
    .limit(1);

  if (!lane) return Response.json({ error: "Lane not found" }, { status: 404 });

  const now = new Date();
  const month = now.toLocaleString("en-US", { month: "long" });
  const year = now.getFullYear();

  const { text } = await generateText({
    model: anthropic("claude-sonnet-4.6"),
    prompt: `You are a freight market analyst writing a concise intelligence brief for an independent freight broker.

Lane: ${lane.origin} → ${lane.destination}
Equipment: ${lane.equipment}
Period: ${month} ${year}

Write a 3-5 paragraph intelligence brief covering:
1. Current market conditions and capacity on this lane
2. AI-estimated rate range (clearly labeled as AI-estimated)
3. Seasonal factors affecting this lane right now
4. Key risks or opportunities for this month

IMPORTANT DISCLAIMER: All rate data is AI-estimated based on general market knowledge, not live data. Include this disclaimer at the end.

Format as clean markdown.`,
  });

  const [existing] = await db
    .select()
    .from(briefs)
    .where(and(eq(briefs.userId, user.id), eq(briefs.laneId, laneId)))
    .orderBy(desc(briefs.generatedAt))
    .limit(1);

  const version = existing ? existing.version + 1 : 1;

  const [brief] = await db
    .insert(briefs)
    .values({
      id: randomUUID(),
      userId: user.id,
      laneId,
      title: `${lane.origin} → ${lane.destination} — ${month} ${year} Brief`,
      content: text,
      version,
    })
    .returning();

  return Response.json({ brief }, { status: 201 });
}
