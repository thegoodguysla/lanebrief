import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { users, smsVerificationCodes } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { code?: string };
  if (!body.code || !/^\d{6}$/.test(body.code)) {
    return Response.json({ error: "6-digit code is required" }, { status: 400 });
  }

  const db = getDb();

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, userId)).limit(1);
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const now = new Date();
  const [pending] = await db
    .select()
    .from(smsVerificationCodes)
    .where(
      and(
        eq(smsVerificationCodes.userId, user.id),
        eq(smsVerificationCodes.code, body.code),
        gt(smsVerificationCodes.expiresAt, now)
      )
    )
    .limit(1);

  if (!pending) {
    return Response.json({ error: "Invalid or expired code" }, { status: 400 });
  }

  // Mark phone verified and store the phone number
  await db
    .update(users)
    .set({ phone: pending.phone, phoneVerified: true, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  // Clean up used code
  await db.delete(smsVerificationCodes).where(eq(smsVerificationCodes.userId, user.id));

  return Response.json({ ok: true, phone: pending.phone });
}
