import { getDb } from "@/lib/db";
import { testimonialTokens, users } from "@/lib/db/schema";
import { and, eq, gt, isNull } from "drizzle-orm";
import { createHash } from "crypto";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token || token.length !== 64) {
    return Response.json({ error: "Invalid token" }, { status: 400 });
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const db = getDb();
  const now = new Date();

  const [row] = await db
    .select({
      id: testimonialTokens.id,
      userId: testimonialTokens.userId,
      expiresAt: testimonialTokens.expiresAt,
      usedAt: testimonialTokens.usedAt,
      userName: users.email,
    })
    .from(testimonialTokens)
    .innerJoin(users, eq(users.id, testimonialTokens.userId))
    .where(
      and(
        eq(testimonialTokens.tokenHash, tokenHash),
        gt(testimonialTokens.expiresAt, now),
        isNull(testimonialTokens.usedAt)
      )
    )
    .limit(1);

  if (!row) {
    return Response.json({ error: "Token invalid or expired" }, { status: 404 });
  }

  // Derive first name from email for pre-fill
  const emailLocal = row.userName.split("@")[0].split(".")[0].split("+")[0];
  const firstName = emailLocal.charAt(0).toUpperCase() + emailLocal.slice(1);

  return Response.json({ valid: true, tokenId: row.id, name: firstName });
}
