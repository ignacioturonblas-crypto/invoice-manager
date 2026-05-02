import { createClient } from "@/lib/supabase/server";
import { extractBankStatement } from "@/lib/mistral";
import { matchTransactions } from "@/lib/reconciliation";
import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { statementId, filePath } = await request.json();

    if (!statementId || !filePath) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    if (!process.env.MISTRAL_API_KEY) {
      return NextResponse.json({ error: "MISTRAL_API_KEY not set" }, { status: 500 });
    }

    // Download PDF from bank-statements bucket
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("bank-statements")
      .download(filePath);

    if (downloadError || !fileData) {
      await supabase.from("bank_statements").update({ status: "error" }).eq("id", statementId);
      return NextResponse.json({ error: "File download failed", detail: downloadError?.message }, { status: 500 });
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    // Extract transactions via Mistral OCR + chat
    let extracted;
    try {
      extracted = await extractBankStatement(base64);
    } catch (err) {
      await supabase.from("bank_statements").update({ status: "error" }).eq("id", statementId);
      return NextResponse.json({ error: "Mistral extraction failed", detail: String(err) }, { status: 500 });
    }

    // Fetch all done invoices for matching
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, amount, date, type")
      .eq("status", "done");

    const matched = matchTransactions(extracted.transactions, invoices ?? []);

    // Bulk insert all transactions
    const rows = matched.map((tx) => ({
      statement_id: statementId,
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      direction: tx.direction,
      match_status: tx.matchedInvoiceId ? "matched" : "unmatched",
      matched_invoice_id: tx.matchedInvoiceId,
      manually_set: false,
    }));

    if (rows.length > 0) {
      const { error: insertError } = await supabase.from("bank_transactions").insert(rows);
      if (insertError) {
        await supabase.from("bank_statements").update({ status: "error" }).eq("id", statementId);
        return NextResponse.json({ error: "Insert failed", detail: insertError.message }, { status: 500 });
      }
    }

    const matchedCount = rows.filter((r) => r.match_status === "matched").length;
    const unmatchedCount = rows.filter((r) => r.match_status === "unmatched").length;

    // Update statement as done
    await supabase
      .from("bank_statements")
      .update({ status: "done", raw_text: JSON.stringify(extracted.raw) })
      .eq("id", statementId);

    return NextResponse.json({ success: true, statementId, matched: matchedCount, unmatched: unmatchedCount });

  } catch (err) {
    return NextResponse.json({ error: "Unexpected error", detail: String(err) }, { status: 500 });
  }
}
