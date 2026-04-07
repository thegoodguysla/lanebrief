import { getDb } from "@/lib/db";
import { testimonials } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

// GET /api/testimonials — public: returns approved testimonials for display
export async function GET() {
  const db = getDb();
  const rows = await db
    .select({
      id: testimonials.id,
      rating: testimonials.rating,
      text: testimonials.text,
      name: testimonials.name,
      title: testimonials.title,
      createdAt: testimonials.createdAt,
    })
    .from(testimonials)
    .where(eq(testimonials.approved, true))
    .orderBy(desc(testimonials.createdAt))
    .limit(20);

  return Response.json({ testimonials: rows });
}
