import { createHash } from "crypto";
import { getDb } from "@/lib/db";
import { apiKeys, users } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export type ValidatedKey = {
  userId: string;
  planTier: string;
  usageCount: number;
  keyId: string;
};

const PRO_MONTHLY_LIMIT = 1000;

export async function validateApiKey(request: Request): Promise<ValidatedKey | { error: string; status: number }> {
  const key = request.headers.get("X-LaneBrief-Key");
  if (!key || !key.startsWith("lb_live_")) {
    return { error: "Missing or invalid API key", status: 401 };
  }

  const keyHash = createHash("sha256").update(key).digest("hex");
  const db = getDb();

  const result = await db
    .select({ key: apiKeys, user: users })
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.userId, users.id))
    .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
    .limit(1);

  if (result.length === 0) {
    return { error: "Invalid or revoked API key", status: 401 };
  }

  const { key: apiKey, user } = result[0];

  if (user.planTier === "free") {
    return { error: "API access requires a Pro or Enterprise plan", status: 403 };
  }

  // Check monthly limit for pro users
  const now = new Date();
  const resetAt = new Date(apiKey.usageResetAt);
  const isNewMonth = now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear();

  let currentUsage = apiKey.usageCount;
  if (isNewMonth) {
    // Reset usage for new month
    await db.update(apiKeys).set({ usageCount: 0, usageResetAt: now }).where(eq(apiKeys.id, apiKey.id));
    currentUsage = 0;
  }

  if (user.planTier === "pro" && currentUsage >= PRO_MONTHLY_LIMIT) {
    return { error: "Monthly API limit reached. Upgrade to Enterprise for unlimited access.", status: 429 };
  }

  // Increment usage
  await db.update(apiKeys).set({ usageCount: currentUsage + 1 }).where(eq(apiKeys.id, apiKey.id));

  return {
    userId: user.id,
    planTier: user.planTier,
    usageCount: currentUsage + 1,
    keyId: apiKey.id,
  };
}

export function isValidatedKey(result: ValidatedKey | { error: string; status: number }): result is ValidatedKey {
  return "userId" in result;
}
