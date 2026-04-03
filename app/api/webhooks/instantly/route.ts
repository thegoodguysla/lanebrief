import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const HOT_INTENT_WORDS = [
  "interested",
  "yes",
  "tell me more",
  "how much",
  "sounds good",
  "let's talk",
  "sure",
  "definitely",
  "i'm in",
  "sign me up",
  "pricing",
  "cost",
  "demo",
  "call",
];

function detectHotIntent(replyText: string): boolean {
  const lower = replyText.toLowerCase();
  return HOT_INTENT_WORDS.some((word) => lower.includes(word));
}

function draftResponse(
  firstName: string,
  replyText: string,
  lane: string
): string {
  const isHot = detectHotIntent(replyText);
  if (isHot) {
    return `Hi ${firstName},\n\nGreat to hear from you! I'd love to show you what LaneBrief looks like for ${lane || "your top lanes"}.\n\nDo you have 15 minutes this week for a quick call? I can walk you through the weekly brief format and we can run your top lane live.\n\nCalendly: [YOUR_CALENDLY_LINK]\n\n— Nick`;
  }
  return `Hi ${firstName},\n\nThanks for getting back to me. Happy to answer any questions you have about how LaneBrief works for ${lane || "independent brokers"}.\n\nThe short version: you tell us your top 3 lanes, we send you a weekly brief every Monday with rate movements, capacity signals, and what to watch for. $199/mo, cancel anytime.\n\nWant me to run a sample for one of your lanes? Just reply with an origin-destination and I'll pull it.\n\n— Nick`;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Instantly webhook event types we care about: reply_received
  const eventType = body.event_type as string;
  if (eventType !== "reply_received") {
    return Response.json({ ok: true, ignored: eventType });
  }

  const lead = (body.lead as Record<string, string>) || {};
  const email = body.email as string || lead.email || "";
  const firstName = lead.first_name || (email.split("@")[0] ?? "there");
  const lastName = lead.last_name || "";
  const company = lead.company_name || "";
  const lane = (lead as Record<string, string>).LANE || "your top lanes";
  const replyText = (body.reply_text as string) || "";
  const campaignName = (body.campaign_name as string) || "LaneBrief Broker Outreach";

  const isHot = detectHotIntent(replyText);
  const urgency = isHot ? "🔥 HOT REPLY" : "📬 Reply";
  const draftReply = draftResponse(firstName, replyText, lane);

  const html = `
<h2>${urgency} — ${firstName} ${lastName} ${company ? `(${company})` : ""}</h2>
<p><strong>Email:</strong> ${email}</p>
<p><strong>Campaign:</strong> ${campaignName}</p>
<p><strong>Lane:</strong> ${lane}</p>
<hr>
<h3>Their reply:</h3>
<blockquote style="border-left: 3px solid #ccc; padding-left: 16px; color: #333;">
${replyText.replace(/\n/g, "<br>")}
</blockquote>
<hr>
<h3>Suggested response:</h3>
<pre style="background: #f5f5f5; padding: 16px; border-radius: 4px; white-space: pre-wrap;">${draftReply}</pre>
<hr>
<p><a href="https://app.instantly.ai/app/inbox">Open Instantly Inbox →</a></p>
${isHot ? '<p><strong style="color: red;">⚡ HOT LEAD — respond within 1 hour</strong></p>' : ""}
`;

  try {
    await getResend().emails.send({
      from: "LaneBrief Alerts <alerts@email.lanebrief.com>",
      to: ["nick@lanebrief.com"],
      subject: `${urgency}: ${firstName} ${lastName} replied to your cold email`,
      html,
    });
  } catch (err) {
    console.error("Failed to send reply alert email:", err);
    return Response.json({ error: "Failed to send notification" }, { status: 500 });
  }

  return Response.json({ ok: true, hot: isHot });
}
