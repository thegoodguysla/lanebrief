import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { apiKeys, users } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { randomBytes, createHash, randomUUID } from "crypto";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const user = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!user[0]) return Response.json({ error: "User not found" }, { status: 404 });

  const keys = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      usageCount: apiKeys.usageCount,
      usageResetAt: apiKeys.usageResetAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, user[0].id), isNull(apiKeys.revokedAt)));

  return Response.json({ keys, planTier: user[0].planTier });
}

export async function POST(request: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const user = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!user[0]) return Response.json({ error: "User not found" }, { status: 404 });

  if (user[0].planTier === "free") {
    return Response.json({ error: "API access requires Pro or Enterprise plan" }, { status: 403 });
  }

  let name = "Default";
  try {
    const body = await request.json();
    if (body.name) name = String(body.name).slice(0, 64);
  } catch { /* optional body */ }

  const rawKey = "lb_live_" + randomBytes(24).toString("hex");
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 16) + "...";

  const [newKey] = await db.insert(apiKeys).values({
    id: randomUUID(),
    userId: user[0].id,
    name,
    keyHash,
    keyPrefix,
    usageCount: 0,
    usageResetAt: new Date(),
  }).returning({ id: apiKeys.id, name: apiKeys.name, keyPrefix: apiKeys.keyPrefix, createdAt: apiKeys.createdAt });

  // Return the full key ONCE — never stored
  return Response.json({ key: rawKey, id: newKey.id, name: newKey.name, keyPrefix: newKey.keyPrefix }, { status: 201 });
}
