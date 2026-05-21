import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PLACES_API = "https://maps.googleapis.com/maps/api/place";
const KEY = process.env.GOOGLE_MAPS_API_KEY!;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { query, city, country, category } = await req.json();
  if (!query) return NextResponse.json({ error: "query is required" }, { status: 400 });

  const fullQuery = [query, city, country].filter(Boolean).join(" ");

  // Fetch up to 60 results (3 pages)
  const results: PlaceResult[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < 3; page++) {
    const url = pageToken
      ? `${PLACES_API}/textsearch/json?pagetoken=${pageToken}&key=${KEY}&language=es`
      : `${PLACES_API}/textsearch/json?query=${encodeURIComponent(fullQuery)}&key=${KEY}&language=es&region=es`;

    if (pageToken) await new Promise((r) => setTimeout(r, 2000)); // required delay for next_page_token

    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      return NextResponse.json({ error: data.status, details: data.error_message }, { status: 400 });
    }

    results.push(...(data.results ?? []));
    pageToken = data.next_page_token;
    if (!pageToken) break;
  }

  // Save search record
  const { data: search, error: searchError } = await supabase
    .from("searches")
    .insert({ query, category: category || "other", city: city || null, country: country || "ES", total_found: results.length, imported_count: 0 })
    .select()
    .single();

  if (searchError) {
    console.error("Search save error:", searchError);
  }

  // Return lightweight candidates (not yet saved to contacts)
  const candidates = results.map((r) => ({
    place_id: r.place_id,
    name: r.name,
    address: r.formatted_address,
    rating: r.rating ?? null,
    reviews_count: r.user_ratings_total ?? null,
    open_now: r.opening_hours?.open_now ?? null,
  }));

  return NextResponse.json({ search_id: search?.id ?? null, candidates });
}

interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address: string;
  rating?: number;
  user_ratings_total?: number;
  opening_hours?: { open_now: boolean };
}
