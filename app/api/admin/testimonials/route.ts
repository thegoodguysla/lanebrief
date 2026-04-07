import { getDb } from "@/lib/db";
import { testimonials } from "@/lib/db/schema";
import { currentUser } from "@clerk/nextjs/server";
import { desc } from "drizzle-orm";
import { randomUUID } from "crypto";

const ADMIN_EMAILS = ["nick@lanebrief.com", "nick@thegoodguys.la"];

async function requireAdmin() {
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress ?? "";
  if (!ADMIN_EMAILS.includes(email)) return null;
  return user;
}

// GET /api/admin/testimonials — list all testimonials for moderation
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const db = getDb();
  const rows = await db
    .select()
    .from(testimonials)
    .orderBy(desc(testimonials.createdAt));

  return Response.json({ testimonials: rows });
}

// POST /api/admin/testimonials — manually create a testimonial
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { rating, text, name, title, approved } = body as {
    rating?: unknown;
    text?: unknown;
    name?: unknown;
    title?: unknown;
    approved?: unknown;
  };

  const ratingNum = Number(rating);
  if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
    return Response.json({ error: "Rating must be 1–5" }, { status: 400 });
  }
  const nameStr = String(name ?? "").trim();
  if (!nameStr) return Response.json({ error: "Name required" }, { status: 400 });

  const db = getDb();
  const [row] = await db
    .insert(testimonials)
    .values({
      id: randomUUID(),
      userId: null,
      rating: ratingNum,
      text: String(text ?? "").trim().slice(0, 280) || null,
      name: nameStr,
      title: String(title ?? "").trim() || null,
      approved: Boolean(approved),
    })
    .returning();

  return Response.json({ testimonial: row }, { status: 201 });
}
