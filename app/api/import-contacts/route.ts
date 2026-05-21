import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PLACES_API = "https://maps.googleapis.com/maps/api/place";
const KEY = process.env.GOOGLE_MAPS_API_KEY!;
const FIELDS = "name,formatted_phone_number,website,formatted_address,rating,user_ratings_total";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { place_ids, search_id, category, city, country } = await req.json() as {
    place_ids: string[];
    search_id: string | null;
    category: string;
    city?: string;
    country?: string;
  };

  if (!place_ids?.length) return NextResponse.json({ error: "place_ids required" }, { status: 400 });

  const results: ImportResult[] = [];

  for (const place_id of place_ids) {
    try {
      // Get place details from Google
      const detailRes = await fetch(
        `${PLACES_API}/details/json?place_id=${place_id}&fields=${FIELDS}&key=${KEY}&language=es`
      );
      const detail = await detailRes.json();
      const p = detail.result;

      if (!p) {
        results.push({ place_id, name: null, status: "error", email_found: false });
        continue;
      }

      // Try to scrape email from homepage
      let email: string | null = null;
      if (p.website) {
        try {
          const homeRes = await fetch(p.website, { signal: AbortSignal.timeout(5000) });
          const html = await homeRes.text();
          const match = html.match(/href="mailto:([^"?]+)"/i);
          if (match) email = match[1].toLowerCase();
        } catch {
          // Scrape failed silently — email stays null
        }
      }

      // Parse city from formatted_address if not provided
      const addressCity = city ?? parseCity(p.formatted_address);

      // Upsert — google_place_id is UNIQUE so no duplicates
      const { error: upsertError } = await supabase.from("contacts").upsert(
        {
          name: p.name,
          category: category || "interior_studio",
          address: p.formatted_address ?? null,
          city: addressCity ?? null,
          country: country ?? "ES",
          phone: p.formatted_phone_number ?? null,
          website: p.website ?? null,
          email,
          google_place_id: place_id,
          rating: p.rating ?? null,
          reviews_count: p.user_ratings_total ?? null,
          source_search_id: search_id ?? null,
          status: "new",
        },
        { onConflict: "google_place_id", ignoreDuplicates: false }
      );

      results.push({
        place_id,
        name: p.name,
        status: upsertError ? "error" : "imported",
        email_found: !!email,
      });
    } catch (err) {
      console.error("Import error for", place_id, err);
      results.push({ place_id, name: null, status: "error", email_found: false });
    }
  }

  // Update search imported_count
  if (search_id) {
    const imported = results.filter((r) => r.status === "imported").length;
    await supabase
      .from("searches")
      .update({ imported_count: imported })
      .eq("id", search_id);
  }

  const imported = results.filter((r) => r.status === "imported").length;
  const emailsFound = results.filter((r) => r.email_found).length;

  return NextResponse.json({ results, summary: { total: place_ids.length, imported, skipped: place_ids.length - imported, emails_found: emailsFound } });
}

function parseCity(address: string | undefined): string | null {
  if (!address) return null;
  // "Carrer de X, 123, Eixample, 08019 Barcelona, España" → "Barcelona"
  const parts = address.split(",").map((s) => s.trim());
  for (const part of parts.reverse()) {
    const clean = part.replace(/España|Espanya|Spain/gi, "").trim();
    if (clean && !/^\d/.test(clean)) return clean;
  }
  return null;
}

interface ImportResult {
  place_id: string;
  name: string | null;
  status: "imported" | "error";
  email_found: boolean;
}
