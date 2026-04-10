import { createClient } from "@/lib/supabase/server";
import { extractInvoiceData } from "@/lib/gemini";
import { getQuarterFromDate } from "@/lib/types";
import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { invoiceId, filePath, mimeType } = body;

    if (!invoiceId || !filePath || !mimeType) {
      return NextResponse.json({ error: "Missing fields", body }, { status: 400 });
    }

    // Check env var is present
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });
    }

    // Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("invoices")
      .download(filePath);

    if (downloadError || !fileData) {
      return NextResponse.json({ error: "File download failed", detail: downloadError?.message }, { status: 500 });
    }

    // Convert to base64
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    // Extract with Gemini
    let extracted;
    try {
      extracted = await extractInvoiceData(base64, mimeType);
    } catch (err) {
      await supabase.from("invoices").update({ status: "error" }).eq("id", invoiceId);
      return NextResponse.json({ error: "Gemini extraction failed", detail: String(err) }, { status: 500 });
    }

    // Calculate quarter/year from date
    const quarterData = extracted.date ? getQuarterFromDate(extracted.date) : null;

    // Update invoice record
    const { error: updateError } = await supabase
      .from("invoices")
      .update({
        vendor: extracted.vendor,
        date: extracted.date,
        amount: extracted.amount,
        currency: extracted.currency ?? "EUR",
        invoice_number: extracted.invoice_number,
        tax_amount: extracted.tax_amount,
        type: extracted.type ?? "payment",
        quarter: quarterData?.quarter ?? null,
        year: quarterData?.year ?? null,
        metadata: { line_items: extracted.line_items, ...extracted.raw },
        status: "done",
      })
      .eq("id", invoiceId);

    if (updateError) {
      return NextResponse.json({ error: "DB update failed", detail: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, extracted });

  } catch (err) {
    // Top-level catch — surface any unexpected crash
    return NextResponse.json({ error: "Unexpected error", detail: String(err) }, { status: 500 });
  }
}
