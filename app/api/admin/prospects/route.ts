import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { users, prospects } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

const ADMIN_EMAILS = ["nick@lanebrief.com", "nick@thegoodguys.la"];

async function requireAdmin() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;
  const db = getDb();
  const [caller] = await db.select({ email: users.email }).from(users).where(eq(users.clerkId, clerkUserId)).limit(1);
  if (!caller || !ADMIN_EMAILS.includes(caller.email)) return null;
  return caller;
}

// GET /api/admin/prospects
export async function GET() {
  if (!await requireAdmin()) return Response.json({ error: "Forbidden" }, { status: 403 });
  const db = getDb();
  const rows = await db.select().from(prospects).orderBy(desc(prospects.createdAt));
  return Response.json({ prospects: rows });
}

// POST /api/admin/prospects
export async function POST(req: Request) {
  if (!await requireAdmin()) return Response.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const { name, email, company, stage, replySnippet, notes } = body;
  if (!name || !email) return Response.json({ error: "name and email required" }, { status: 400 });
  const db = getDb();
  const [row] = await db.insert(prospects).values({
    id: randomUUID(),
    name,
    email,
    company: company ?? null,
    stage: stage ?? "replied",
    replySnippet: replySnippet ?? null,
    notes: notes ?? null,
  }).returning();
  return Response.json({ prospect: row }, { status: 201 });
}
