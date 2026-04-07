import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { users, teams, teamMembers } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { randomUUID } from "crypto";
import { Resend } from "resend";
import { isPro } from "@/lib/stripe";

// POST /api/team/invite — team owner sends an invite to a teammate by email

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1);

  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });
  if (!isPro(dbUser)) return Response.json({ error: "Pro plan required to invite teammates" }, { status: 403 });

  const body = await request.json() as { email?: string };
  const inviteeEmail = (body.email ?? "").trim().toLowerCase();
  if (!inviteeEmail || !inviteeEmail.includes("@")) {
    return Response.json({ error: "Valid email required" }, { status: 400 });
  }

  // Get or create team for this owner
  let team = await db.query.teams.findFirst({ where: eq(teams.ownerUserId, dbUser.id) });
  if (!team) {
    const [newTeam] = await db
      .insert(teams)
      .values({ id: randomUUID(), ownerUserId: dbUser.id, name: `${dbUser.email}'s team`, seatCount: 3 })
      .returning();
    team = newTeam;
  }

  // Check seat limit
  const [{ count: memberCount }] = await db
    .select({ count: count() })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, team.id));

  if (memberCount >= team.seatCount) {
    return Response.json({ error: `Seat limit reached (${team.seatCount} seats). Upgrade to add more.` }, { status: 403 });
  }

  // Create invite token (7-day expiry)
  const token = randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + 7 * 86400_000);

  await db
    .insert(teamMembers)
    .values({
      id: randomUUID(),
      teamId: team.id,
      email: inviteeEmail,
      inviteToken: token,
      inviteExpiresAt: expiresAt,
    })
    .onConflictDoNothing();

  // Send invite email
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const inviterName = dbUser.email.split("@")[0];
    const acceptUrl = `https://lanebrief.com/join?token=${token}`;

    await resend.emails.send({
      from: "Nick Taylor <nick@email.lanebrief.com>",
      replyTo: dbUser.email,
      to: inviteeEmail,
      subject: `${inviterName} invited you to LaneBrief`,
      html: `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #0D1F3C; max-width: 600px;">
<p>Hi there,</p>
<p><strong>${inviterName}</strong> has added you to their LaneBrief team.</p>
<p>LaneBrief tracks real-time freight rates, 7-day forecasts, and carrier risk scores for your lanes.</p>
<p><a href="${acceptUrl}" style="display: inline-block; background-color: #00C2A8; color: #FFFFFF; font-size: 14px; font-weight: bold; text-decoration: none; padding: 10px 24px; border-radius: 6px;">Accept invite and set up your account →</a></p>
<p style="font-size: 13px; color: #6B7B8D;">This invite expires in 7 days. If you have questions, reply to this email.</p>
</div>`,
    }).catch((err) => console.error("[team/invite] email send failed:", err));
  }

  return Response.json({ success: true, email: inviteeEmail });
}
