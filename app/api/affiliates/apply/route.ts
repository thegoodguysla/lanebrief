import { getDb } from "@/lib/db";
import { affiliates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

function generateCode(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 12);
  const suffix = randomUUID().replace(/-/g, "").slice(0, 4);
  return `${base}${suffix}`;
}

export async function POST(req: Request) {
  const body = await req.json() as {
    name?: string;
    email?: string;
    audience?: string;
    howToPromote?: string;
  };

  const { name, email, audience, howToPromote } = body;

  if (!name?.trim() || !email?.trim()) {
    return Response.json({ error: "Name and email are required" }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return Response.json({ error: "Invalid email address" }, { status: 400 });
  }

  const db = getDb();

  // Check for duplicate application
  const existing = await db
    .select({ id: affiliates.id, status: affiliates.status })
    .from(affiliates)
    .where(eq(affiliates.email, email.toLowerCase()))
    .limit(1);

  if (existing.length > 0) {
    const status = existing[0].status;
    if (status === "approved") {
      return Response.json({ error: "This email is already an approved affiliate" }, { status: 409 });
    }
    return Response.json({ error: "An application for this email already exists" }, { status: 409 });
  }

  const code = generateCode(name.trim());

  await db.insert(affiliates).values({
    id: randomUUID(),
    name: name.trim(),
    email: email.toLowerCase().trim(),
    code,
    status: "pending",
    audience: audience?.trim() ?? null,
    howToPromote: howToPromote?.trim() ?? null,
  });

  return Response.json({ success: true }, { status: 201 });
}
