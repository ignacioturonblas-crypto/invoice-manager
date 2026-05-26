import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get contacts with website but no email
  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("id, name, website")
    .is("email", null)
    .not("website", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!contacts?.length) return NextResponse.json({ summary: { total: 0, found: 0 } });

  let found = 0;

  for (const contact of contacts) {
    try {
      const res = await fetch(contact.website!, { signal: AbortSignal.timeout(6000) });
      const html = await res.text();
      const match = html.match(/href="mailto:([^"?]+)"/i);
      if (match) {
        const email = match[1].toLowerCase();
        await supabase.from("contacts").update({ email }).eq("id", contact.id);
        found++;
      }
    } catch {
      // Scrape failed — skip
    }
  }

  return NextResponse.json({ summary: { total: contacts.length, found, missing: contacts.length - found } });
}
