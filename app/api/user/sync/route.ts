import { auth, currentUser } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

// Called after sign-in/sign-up to upsert the Clerk user into our DB
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clerkUser = await currentUser();
  if (!clerkUser) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const email =
    clerkUser.emailAddresses[0]?.emailAddress ?? "";

  const db = getDb();
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1);

  if (existing.length > 0) {
    return Response.json({ user: existing[0] });
  }

  const [newUser] = await db
    .insert(users)
    .values({ id: randomUUID(), clerkId: userId, email })
    .returning();

  return Response.json({ user: newUser }, { status: 201 });
}
