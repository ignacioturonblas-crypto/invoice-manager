import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { campaign_id, contact_ids } = await req.json() as {
    campaign_id: string;
    contact_ids: string[];
  };

  if (!campaign_id || !contact_ids?.length) {
    return NextResponse.json({ error: "campaign_id and contact_ids required" }, { status: 400 });
  }

  // Fetch campaign
  const { data: campaign, error: campError } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaign_id)
    .single();

  if (campError || !campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  // Fetch contacts
  const { data: contacts, error: contactsError } = await supabase
    .from("contacts")
    .select("id, name, email, website")
    .in("id", contact_ids);

  if (contactsError) {
    return NextResponse.json({ error: "Failed to fetch contacts" }, { status: 500 });
  }

  const results: SendResult[] = [];

  for (const contact of contacts ?? []) {
    if (!contact.email) {
      results.push({ contact_id: contact.id, name: contact.name, status: "skipped", reason: "no_email" });
      continue;
    }

    // Render template variables
    const subject = renderTemplate(campaign.subject, contact, campaign);
    const html = renderTemplate(campaign.body, contact, campaign)
      .split("\n")
      .map((line: string) => `<p>${line}</p>`)
      .join("");

    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "sales@massio.co",
        to: contact.email,
        replyTo: process.env.RESEND_REPLY_TO ?? "massioconcept@gmail.com",
        subject,
        html,
      });

      // Record outreach
      await supabase.from("contact_outreach").upsert(
        {
          contact_id: contact.id,
          campaign_id,
          email_used: contact.email,
          status: "sent",
          sent_at: new Date().toISOString(),
        },
        { onConflict: "contact_id,campaign_id" }
      );

      // Update contact status to contacted
      await supabase
        .from("contacts")
        .update({ status: "contacted" })
        .eq("id", contact.id)
        .eq("status", "new"); // only update if still "new"

      results.push({ contact_id: contact.id, name: contact.name, status: "sent", reason: null });
    } catch (err) {
      console.error("Send error for", contact.email, err);
      results.push({ contact_id: contact.id, name: contact.name, status: "error", reason: "send_failed" });
    }
  }

  // Increment campaign sent_count
  const sentCount = results.filter((r) => r.status === "sent").length;
  if (sentCount > 0) {
    await supabase.rpc("increment_campaign_sent", { campaign_id, count: sentCount });
  }

  const summary = {
    total: contact_ids.length,
    sent: results.filter((r) => r.status === "sent").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    errors: results.filter((r) => r.status === "error").length,
  };

  return NextResponse.json({ results, summary });
}

function renderTemplate(
  template: string,
  contact: { name: string; website?: string | null },
  campaign: { wholesale_link?: string | null; calendly_link?: string | null }
): string {
  return template
    .replace(/\{\{name\}\}/g, contact.name)
    .replace(/\{\{website\}\}/g, contact.website ?? "")
    .replace(/\{\{wholesale_link\}\}/g, campaign.wholesale_link ?? "")
    .replace(/\{\{calendly_link\}\}/g, campaign.calendly_link ?? "");
}

interface SendResult {
  contact_id: string;
  name: string;
  status: "sent" | "skipped" | "error";
  reason: string | null;
}
