"use client";

import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Upload, FileText, Trash2, Loader2, CheckCircle, AlertCircle, Clock,
} from "lucide-react";
import type { BankStatement } from "@/lib/types";

const QUARTERS = ["T1", "T2", "T3", "T4"] as const;
const currentYear = new Date().getFullYear();
const YEARS = [currentYear, currentYear - 1, currentYear - 2];

export default function ReconciliationPage() {
  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [quarter, setQuarter] = useState<string>("T1");
  const [year, setYear] = useState<number>(currentYear);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const fetchStatements = useCallback(async () => {
    const { data } = await supabase
      .from("bank_statements")
      .select("*")
      .order("created_at", { ascending: false });
    setStatements((data as BankStatement[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchStatements(); }, [fetchStatements]);

  const onDrop = useCallback(async (accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    setUploading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }

    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const filePath = `${user.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("bank-statements")
      .upload(filePath, file, { contentType: "application/pdf" });

    if (uploadError) {
      toast.error("Upload failed: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: statement, error: dbError } = await supabase
      .from("bank_statements")
      .insert({ file_path: filePath, file_name: file.name, quarter, year, status: "processing" })
      .select()
      .single();

    if (dbError || !statement) {
      toast.error("Failed to create statement record");
      setUploading(false);
      return;
    }

    const res = await fetch("/api/process-bank-statement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statementId: statement.id, filePath }),
    });

    setUploading(false);

    if (!res.ok) {
      toast.error("Processing failed — check the statement and try again");
      fetchStatements();
      return;
    }

    const result = await res.json();
    toast.success(`Done — ${result.matched} matched, ${result.unmatched} unmatched`);
    router.push(`/reconciliation/${statement.id}`);
  }, [supabase, quarter, year, router, fetchStatements]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled: uploading,
  });

  async function handleDelete(id: string) {
    setDeleteId(id);
    const res = await fetch(`/api/bank-statements/${id}`, { method: "DELETE" });
    if (res.ok) {
      setStatements((prev) => prev.filter((s) => s.id !== id));
      toast.success("Statement deleted");
    } else {
      toast.error("Delete failed");
    }
    setDeleteId(null);
  }

  const selectClass = "h-8 rounded-md border border-border bg-card px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring/50";

  return (
    <div className="max-w-3xl space-y-6">
      {/* Upload card */}
      <div className="bg-card rounded-xl shadow-sm p-6 space-y-4">
        <h2 className="text-[13px] font-semibold">Upload bank statement</h2>

        <div className="flex items-center gap-3">
          <select value={quarter} onChange={(e) => setQuarter(e.target.value)} className={selectClass}>
            {QUARTERS.map((q) => <option key={q} value={q}>{q}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={selectClass}>
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg px-6 py-10 text-center cursor-pointer transition-colors
            ${isDragActive ? "border-ring bg-primary/5" : "border-border hover:border-muted-foreground/50"}
            ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
              <p className="text-[13px]">Processing statement…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Upload className="size-6" />
              <p className="text-[13px]">{isDragActive ? "Drop the PDF here" : "Drop your bank statement PDF or click to browse"}</p>
              <p className="text-[11px] text-muted-foreground/60">PDF only</p>
            </div>
          )}
        </div>
      </div>

      {/* Past statements */}
      {!loading && statements.length > 0 && (
        <div className="bg-card rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h2 className="text-[13px] font-semibold">Past statements</h2>
          </div>
          <div className="divide-y divide-border/60">
            {statements.map((s) => (
              <div
                key={s.id}
                className="group px-5 flex items-center gap-4 h-[52px] hover:bg-accent/40 cursor-pointer"
                onClick={() => s.status === "done" && router.push(`/reconciliation/${s.id}`)}
              >
                <FileText className="size-4 text-muted-foreground shrink-0" />
                <span className="flex-1 text-[13px] truncate">{s.file_name}</span>
                <span className="text-[12px] text-muted-foreground w-8">{s.quarter}</span>
                <span className="text-[12px] text-muted-foreground w-10">{s.year}</span>
                <StatusPill status={s.status} />
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                  disabled={deleteId === s.id}
                  className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  title="Delete statement"
                >
                  {deleteId === s.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && statements.length === 0 && (
        <p className="text-[13px] text-muted-foreground text-center py-8">No statements uploaded yet.</p>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "done") return (
    <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400">
      <CheckCircle className="size-3" /> Done
    </span>
  );
  if (status === "error") return (
    <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400">
      <AlertCircle className="size-3" /> Error
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">
      <Clock className="size-3" /> Processing
    </span>
  );
}
