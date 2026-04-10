import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function DELETE(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ids } = await request.json() as { ids: string[] };

  if (!ids || ids.length === 0) {
    return NextResponse.json({ error: "No IDs provided" }, { status: 400 });
  }

  // Fetch file paths before deleting records
  const { data: invoices, error: fetchError } = await supabase
    .from("invoices")
    .select("id, file_path")
    .in("id", ids);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  // Delete files from storage
  const filePaths = (invoices ?? []).map((inv) => inv.file_path);
  if (filePaths.length > 0) {
    await supabase.storage.from("invoices").remove(filePaths);
  }

  // Delete DB records
  const { error: deleteError } = await supabase
    .from("invoices")
    .delete()
    .in("id", ids);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, deleted: ids.length });
}
