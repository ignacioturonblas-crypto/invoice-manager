import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    // Fetch statement to get file path
    const { data: statement, error: fetchError } = await supabase
      .from("bank_statements")
      .select("file_path")
      .eq("id", id)
      .single();

    if (fetchError || !statement) {
      return NextResponse.json({ error: "Statement not found" }, { status: 404 });
    }

    // Delete from storage (transactions cascade via DB)
    await supabase.storage.from("bank-statements").remove([statement.file_path]);

    // Delete statement row (cascades to bank_transactions)
    const { error: deleteError } = await supabase
      .from("bank_statements")
      .delete()
      .eq("id", id);

    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Unexpected error", detail: String(err) }, { status: 500 });
  }
}
