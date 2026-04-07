import { getDb } from "@/lib/db";
import { testimonials } from "@/lib/db/schema";
import { currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

const ADMIN_EMAILS = ["nick@lanebrief.com", "nick@thegoodguys.la"];

async function requireAdmin() {
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress ?? "";
  if (!ADMIN_EMAILS.includes(email)) return null;
  return user;
}

// PATCH /api/admin/testimonials/[id] — approve, reject, or update a testimonial
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { approved } = body as { approved?: unknown };
  if (typeof approved !== "boolean") {
    return Response.json({ error: "approved (boolean) required" }, { status: 400 });
  }

  const db = getDb();
  const [row] = await db
    .update(testimonials)
    .set({ approved })
    .where(eq(testimonials.id, id))
    .returning();

  if (!row) return Response.json({ error: "Not found" }, { status: 404 });

  console.log(`[testimonials] ${approved ? "Approved" : "Rejected"} testimonial ${id}`);
  return Response.json({ testimonial: row });
}

// DELETE /api/admin/testimonials/[id]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const db = getDb();

  await db.delete(testimonials).where(eq(testimonials.id, id));
  console.log(`[testimonials] Deleted testimonial ${id}`);
  return Response.json({ ok: true });
}
