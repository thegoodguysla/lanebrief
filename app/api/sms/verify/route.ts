import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { users, smsVerificationCodes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendSms } from "@/lib/twilio";
import { randomUUID } from "crypto";

// Rate limit: 1 code per 60 seconds (simple in-process check using DB timestamp)
const THROTTLE_SECONDS = 60;
const CODE_TTL_MINUTES = 10;

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizePhone(raw: string): string | null {
  // Accept +1XXXXXXXXXX or 10-digit US numbers
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.startsWith("+") && digits.length >= 7) return `+${digits}`;
  return null;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { phone?: string };
  if (!body.phone) return Response.json({ error: "phone is required" }, { status: 400 });

  const phone = normalizePhone(body.phone);
  if (!phone) return Response.json({ error: "Invalid phone number" }, { status: 400 });

  const db = getDb();

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, userId)).limit(1);
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  // Throttle: delete old codes, check if a recent one exists
  const recentCutoff = new Date(Date.now() - THROTTLE_SECONDS * 1000);
  const existing = await db
    .select({ createdAt: smsVerificationCodes.createdAt })
    .from(smsVerificationCodes)
    .where(eq(smsVerificationCodes.userId, user.id))
    .limit(1);

  if (existing.length > 0 && existing[0].createdAt > recentCutoff) {
    return Response.json({ error: "Please wait before requesting another code" }, { status: 429 });
  }

  // Delete any prior codes for this user
  await db.delete(smsVerificationCodes).where(eq(smsVerificationCodes.userId, user.id));

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

  await db.insert(smsVerificationCodes).values({
    id: randomUUID(),
    userId: user.id,
    phone,
    code,
    expiresAt,
  });

  try {
    await sendSms(phone, `Your LaneBrief verification code is: ${code}. Expires in ${CODE_TTL_MINUTES} minutes.`);
  } catch (err) {
    console.error("[sms/verify] Failed to send SMS:", err);
    return Response.json({ error: "Failed to send SMS — check Twilio credentials" }, { status: 502 });
  }

  return Response.json({ ok: true, phone });
}
