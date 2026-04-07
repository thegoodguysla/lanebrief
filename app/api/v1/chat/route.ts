import { auth } from "@clerk/nextjs/server";
import { streamText } from "ai";
import { getDb } from "@/lib/db";
import { users, chatMessages } from "@/lib/db/schema";
import { eq, and, gte, count } from "drizzle-orm";
import { randomUUID } from "crypto";

export const runtime = "edge";

const FREE_DAILY_LIMIT = 20;

type Message = { role: "user" | "assistant"; content: string };

type ChatRequest = {
  lane: {
    origin: string;
    destination: string;
    currentRate: number;
    marketAvg: number;
    direction: "up" | "down" | "flat";
    pctChange: number;
    confidence: "high" | "medium" | "low";
    reasoning: string;
    capacityLevel: "tight" | "moderate" | "loose";
    capacityReasoning: string;
    tariff: "MX" | "CA" | null;
    sparkline: number[];
  };
  messages: Message[];
};

function buildSystemPrompt(lane: ChatRequest["lane"]): string {
  const { origin, destination, currentRate, marketAvg, direction, pctChange, confidence, reasoning, capacityLevel, capacityReasoning, tariff, sparkline } = lane;

  const trendDir = direction === "up" ? `+${pctChange.toFixed(1)}% (rising)` : direction === "down" ? `-${Math.abs(pctChange).toFixed(1)}% (softening)` : "flat";
  const sparkMin = sparkline.length > 0 ? Math.min(...sparkline).toFixed(2) : "n/a";
  const sparkMax = sparkline.length > 0 ? Math.max(...sparkline).toFixed(2) : "n/a";
  const tariffNote = tariff === "MX" ? "⚠ US-Mexico tariff exposure on this lane." : tariff === "CA" ? "⚠ US-Canada tariff exposure on this lane." : "No cross-border tariff exposure.";

  return `You are a freight market analyst for LaneBrief, an AI-powered freight intelligence platform. You answer broker questions about the ${origin} → ${destination} dry van lane.

## Current Lane Data
- Route: ${origin} → ${destination} (dry van)
- Current spot rate: $${currentRate.toFixed(2)}/mi
- 30-day market avg: $${marketAvg.toFixed(2)}/mi
- 7-day forecast: ${trendDir} (${confidence} confidence)
- Forecast reasoning: ${reasoning}
- Carrier capacity: ${capacityLevel} — ${capacityReasoning}
- 30-day rate range: $${sparkMin} – $${sparkMax}/mi
- Tariff: ${tariffNote}

## Response Rules
- Keep answers under 150 words — conversational, not an essay
- Be specific with numbers when you have them
- Give a clear recommendation when the user asks "should I" questions
- If asked something outside your data, say so briefly and pivot to what you do know
- Tone: confident freight analyst, not a chatbot`;
}

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();

  let dbUserId: string | null = null;
  let isPro = false;

  if (clerkId) {
    const db = getDb();
    const [user] = await db.select({ id: users.id, planTier: users.planTier })
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);
    if (user) {
      dbUserId = user.id;
      isPro = user.planTier === "pro";
    }
  }

  // Rate limit free (and unauthenticated) users to 20 messages/day
  if (!isPro) {
    const db = getDb();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const whereClause = dbUserId
      ? and(eq(chatMessages.userId, dbUserId), gte(chatMessages.createdAt, todayStart))
      : null;

    if (whereClause) {
      const [{ value: msgCount }] = await db
        .select({ value: count() })
        .from(chatMessages)
        .where(whereClause);

      if (msgCount >= FREE_DAILY_LIMIT) {
        return Response.json(
          { error: "rate_limited", message: "You've reached 20 messages today. Upgrade to Pro for unlimited lane chat." },
          { status: 429 }
        );
      }
    } else if (!clerkId) {
      // Unauthenticated — prompt to sign in
      return Response.json(
        { error: "unauthenticated", message: "Sign in for free to chat about this lane." },
        { status: 401 }
      );
    }
  }

  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { lane, messages } = body;
  if (!lane?.origin || !lane?.destination || !Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "Missing required fields: lane, messages" }, { status: 400 });
  }

  // Log the user message
  const userMsg = messages[messages.length - 1];
  if (userMsg?.role === "user" && dbUserId) {
    const db = getDb();
    await db.insert(chatMessages).values({
      id: randomUUID(),
      userId: dbUserId,
      origin: lane.origin,
      destination: lane.destination,
      role: "user",
      content: userMsg.content,
    }).catch(() => {}); // non-blocking — don't fail the request
  }

  const result = streamText({
    model: "anthropic/claude-haiku-4.5",
    system: buildSystemPrompt(lane),
    messages,
    maxOutputTokens: 300,
    onFinish: async ({ text }) => {
      if (dbUserId) {
        const db = getDb();
        await db.insert(chatMessages).values({
          id: randomUUID(),
          userId: dbUserId,
          origin: lane.origin,
          destination: lane.destination,
          role: "assistant",
          content: text,
        }).catch(() => {});
      }
    },
  });

  return result.toTextStreamResponse();
}
