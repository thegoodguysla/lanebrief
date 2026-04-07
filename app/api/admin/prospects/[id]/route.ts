import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { users, prospects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const ADMIN_EMAILS = ["nick@lanebrief.com", "nick@thegoodguys.la"];

async function requireAdmin() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;
  const db = getDb();
  const [caller] = await db.select({ email: users.email }).from(users).where(eq(users.clerkId, clerkUserId)).limit(1);
  if (!caller || !ADMIN_EMAILS.includes(caller.email)) return null;
  return caller;
}

// PATCH /api/admin/prospects/[id]
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const { stage, notes, company, replySnippet } = body;
  const db = getDb();
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (stage !== undefined) updates.stage = stage;
  if (notes !== undefined) updates.notes = notes;
  if (company !== undefined) updates.company = company;
  if (replySnippet !== undefined) updates.replySnippet = replySnippet;
  const [row] = await db.update(prospects).set(updates).where(eq(prospects.id, id)).returning();
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ prospect: row });
}

// DELETE /api/admin/prospects/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const db = getDb();
  await db.delete(prospects).where(eq(prospects.id, id));
  return Response.json({ ok: true });
}
