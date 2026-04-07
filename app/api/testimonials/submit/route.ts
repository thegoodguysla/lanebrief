import { getDb } from "@/lib/db";
import { testimonialTokens, testimonials } from "@/lib/db/schema";
import { and, eq, gt, isNull } from "drizzle-orm";
import { createHash } from "crypto";
import { randomUUID } from "crypto";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { token, rating, text, name, title, consent } = body as {
    token?: string;
    rating?: unknown;
    text?: unknown;
    name?: unknown;
    title?: unknown;
    consent?: unknown;
  };

  if (!token || typeof token !== "string" || token.length !== 64) {
    return Response.json({ error: "Invalid token" }, { status: 400 });
  }
  if (!consent) {
    return Response.json({ error: "Consent required" }, { status: 400 });
  }
  const ratingNum = Number(rating);
  if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
    return Response.json({ error: "Rating must be 1–5" }, { status: 400 });
  }
  const nameStr = String(name ?? "").trim();
  if (!nameStr) {
    return Response.json({ error: "Name required" }, { status: 400 });
  }
  const textStr = String(text ?? "").trim().slice(0, 280) || null;
  const titleStr = String(title ?? "").trim() || null;

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const db = getDb();
  const now = new Date();

  const [tokenRow] = await db
    .select({ id: testimonialTokens.id, userId: testimonialTokens.userId })
    .from(testimonialTokens)
    .where(
      and(
        eq(testimonialTokens.tokenHash, tokenHash),
        gt(testimonialTokens.expiresAt, now),
        isNull(testimonialTokens.usedAt)
      )
    )
    .limit(1);

  if (!tokenRow) {
    return Response.json({ error: "Token invalid, expired, or already used" }, { status: 404 });
  }

  await db.insert(testimonials).values({
    id: randomUUID(),
    userId: tokenRow.userId,
    rating: ratingNum,
    text: textStr,
    name: nameStr,
    title: titleStr,
    approved: false,
  });

  // Mark token as used
  await db
    .update(testimonialTokens)
    .set({ usedAt: now })
    .where(eq(testimonialTokens.id, tokenRow.id));

  console.log(`[testimonials] Submitted by user ${tokenRow.userId}, rating ${ratingNum}`);
  return Response.json({ ok: true });
}
