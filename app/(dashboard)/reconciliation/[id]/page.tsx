"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/kpi-card";
import { toast } from "sonner";
import Link from "next/link";
import {
  CheckCircle2, AlertCircle, MinusCircle, Banknote, ArrowLeft,
  X, RotateCcw, Unlink, Search, Loader2, Upload,
} from "lucide-react";
import type { BankStatement, BankTransaction, Invoice } from "@/lib/types";

type FilterState = "all" | "matched" | "unmatched" | "dismissed";

export default function ReconciliationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [statement, setStatement] = useState<BankStatement | null>(null);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [filter, setFilter] = useState<FilterState>("all");
  const [loading, setLoading] = useState(true);

  // Manual match dialog state
  const [matchDialog, setMatchDialog] = useState<BankTransaction | null>(null);
  const [matchTab, setMatchTab] = useState<"upload" | "link">("upload");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const [confirmingMatch, setConfirmingMatch] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const [stmtRes, txRes] = await Promise.all([
      supabase.from("bank_statements").select("*").eq("id", id).single(),
      supabase
        .from("bank_transactions")
        .select("*, matched_invoice:invoices(id, vendor, invoice_number, date, amount)")
        .eq("statement_id", id)
        .order("date", { ascending: true }),
    ]);

    if (stmtRes.data) setStatement(stmtRes.data as BankStatement);
    if (txRes.data) setTransactions(txRes.data as BankTransaction[]);
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Fetch invoices for the link tab
  async function openMatchDialog(tx: BankTransaction) {
    setMatchDialog(tx);
    setMatchTab("upload");
    setInvoiceSearch("");
    if (allInvoices.length === 0) {
      const { data } = await supabase.from("invoices").select("*").eq("status", "done").order("date", { ascending: false });
      setAllInvoices((data as Invoice[]) ?? []);
    }
  }

  async function patchTransaction(txId: string, match_status: string, matched_invoice_id?: string | null) {
    const res = await fetch(`/api/bank-transactions/${txId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ match_status, matched_invoice_id: matched_invoice_id ?? null }),
    });
    if (!res.ok) { toast.error("Update failed"); return false; }
    return true;
  }

  async function handleDismiss(tx: BankTransaction) {
    const ok = await patchTransaction(tx.id, "dismissed", null);
    if (ok) setTransactions((prev) => prev.map((t) => t.id === tx.id ? { ...t, match_status: "dismissed", matched_invoice_id: null } : t));
  }

  async function handleRestore(tx: BankTransaction) {
    const ok = await patchTransaction(tx.id, "unmatched", null);
    if (ok) setTransactions((prev) => prev.map((t) => t.id === tx.id ? { ...t, match_status: "unmatched", matched_invoice_id: null, matched_invoice: undefined } : t));
  }

  async function handleUnlink(tx: BankTransaction) {
    const ok = await patchTransaction(tx.id, "unmatched", null);
    if (ok) setTransactions((prev) => prev.map((t) => t.id === tx.id ? { ...t, match_status: "unmatched", matched_invoice_id: null, matched_invoice: undefined } : t));
  }

  async function handleLinkInvoice(invoiceId: string) {
    if (!matchDialog) return;
    setConfirmingMatch(invoiceId);
    const ok = await patchTransaction(matchDialog.id, "matched", invoiceId);
    if (ok) {
      const inv = allInvoices.find((i) => i.id === invoiceId);
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === matchDialog.id
            ? { ...t, match_status: "matched", matched_invoice_id: invoiceId, matched_invoice: inv ? { id: inv.id, vendor: inv.vendor, invoice_number: inv.invoice_number, date: inv.date, amount: inv.amount } : undefined }
            : t
        )
      );
      toast.success("Invoice linked");
      setMatchDialog(null);
    }
    setConfirmingMatch(null);
  }

  // Upload-from-dialog: upload a new invoice and auto-check match
  const onDropInvoice = useCallback(async (accepted: File[]) => {
    if (!matchDialog) return;
    const file = accepted[0];
    if (!file) return;
    setUploadingInvoice(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploadingInvoice(false); return; }

    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const filePath = `${user.id}/${fileName}`;
    const mimeType = file.type || "application/octet-stream";
    const fileType = file.type.includes("pdf") ? "pdf" : "image";

    const { error: uploadError } = await supabase.storage.from("invoices").upload(filePath, file, { contentType: mimeType });
    if (uploadError) { toast.error("Upload failed"); setUploadingInvoice(false); return; }

    const { data: invoice, error: dbError } = await supabase
      .from("invoices")
      .insert({ file_path: filePath, file_name: file.name, file_type: fileType, type: "payment", status: "processing", uploaded_by: user.id })
      .select()
      .single();

    if (dbError || !invoice) { toast.error("Failed to create invoice"); setUploadingInvoice(false); return; }

    // Extract
    const extractRes = await fetch("/api/extract-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId: invoice.id, filePath, mimeType }),
    });

    if (!extractRes.ok) { toast.error("Extraction failed"); setUploadingInvoice(false); return; }

    // Fetch the updated invoice to check if it matches
    const { data: updatedInvoice } = await supabase.from("invoices").select("*").eq("id", invoice.id).single();

    if (updatedInvoice && updatedInvoice.amount != null && matchDialog.amount != null) {
      const amountMatch = Math.abs(updatedInvoice.amount - matchDialog.amount) < 0.01;
      const daysDiff = matchDialog.date && updatedInvoice.date
        ? Math.abs((Date.parse(updatedInvoice.date) - Date.parse(matchDialog.date)) / 86_400_000)
        : 999;

      if (amountMatch && daysDiff <= 3) {
        // Auto-match
        await patchTransaction(matchDialog.id, "matched", updatedInvoice.id);
        setTransactions((prev) =>
          prev.map((t) =>
            t.id === matchDialog.id
              ? { ...t, match_status: "matched", matched_invoice_id: updatedInvoice.id, matched_invoice: { id: updatedInvoice.id, vendor: updatedInvoice.vendor, invoice_number: updatedInvoice.invoice_number, date: updatedInvoice.date, amount: updatedInvoice.amount } }
              : t
          )
        );
        toast.success("Invoice uploaded and automatically matched!");
        setMatchDialog(null);
      } else {
        toast.success("Invoice uploaded. No automatic match — link it manually if needed.");
        setMatchDialog(null);
      }
    }

    setUploadingInvoice(false);
  }, [matchDialog, supabase, patchTransaction]);

  const { getRootProps: getInvoiceRootProps, getInputProps: getInvoiceInputProps, isDragActive: isInvoiceDragActive } = useDropzone({
    onDrop: onDropInvoice,
    accept: { "application/pdf": [".pdf"], "image/*": [".jpg", ".jpeg", ".png", ".heic"] },
    maxFiles: 1,
    disabled: uploadingInvoice,
  });

  const filtered = filter === "all" ? transactions : transactions.filter((t) => t.match_status === filter);

  const matched = transactions.filter((t) => t.match_status === "matched").length;
  const unmatched = transactions.filter((t) => t.match_status === "unmatched").length;
  const dismissed = transactions.filter((t) => t.match_status === "dismissed").length;
  const reconciledTotal = transactions
    .filter((t) => t.match_status === "matched" && t.amount != null)
    .reduce((sum, t) => sum + (t.amount ?? 0), 0);

  const chipBase = "px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors cursor-pointer";
  const chipActive = "bg-foreground text-background";
  const chipInactive = "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground";

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-muted-foreground text-[13px]">
      <Loader2 className="size-4 animate-spin mr-2" /> Loading…
    </div>
  );

  if (!statement) return (
    <div className="text-[13px] text-muted-foreground">Statement not found.</div>
  );

  const invoiceSearchLower = invoiceSearch.toLowerCase();
  const filteredInvoices = allInvoices.filter((inv) =>
    !invoiceSearch || inv.vendor?.toLowerCase().includes(invoiceSearchLower) || inv.invoice_number?.toLowerCase().includes(invoiceSearchLower)
  );

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/reconciliation")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="size-4" />
        </button>
        <div>
          <h1 className="text-[15px] font-semibold">{statement.file_name}</h1>
          <p className="text-[12px] text-muted-foreground">{statement.quarter} {statement.year}</p>
        </div>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Matched" value={String(matched)} icon={<CheckCircle2 className="size-4 text-green-600" />} iconBg="bg-green-50 dark:bg-green-950/30" />
        <KpiCard label="Unmatched" value={String(unmatched)} icon={<AlertCircle className="size-4 text-amber-600" />} iconBg="bg-amber-50 dark:bg-amber-950/30" />
        <KpiCard label="Dismissed" value={String(dismissed)} icon={<MinusCircle className="size-4 text-muted-foreground" />} iconBg="bg-muted" />
        <KpiCard
          label="Reconciled total"
          value={reconciledTotal.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
          icon={<Banknote className="size-4 text-primary" />}
          iconBg="bg-primary/10"
        />
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "matched", "unmatched", "dismissed"] as FilterState[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`${chipBase} ${filter === f ? chipActive : chipInactive}`}>
            {f === "all" ? `All (${transactions.length})` : f === "matched" ? `Matched (${matched})` : f === "unmatched" ? `Unmatched (${unmatched})` : `Dismissed (${dismissed})`}
          </button>
        ))}
      </div>

      {/* Reconciliation table */}
      <div className="bg-card rounded-xl shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-[13px] text-muted-foreground text-center py-10">No transactions in this view.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {filtered.map((tx) => (
              <div
                key={tx.id}
                className={`group px-5 flex items-center gap-3 h-[52px] transition-colors
                  ${tx.match_status === "matched" ? "bg-green-50/40 dark:bg-green-950/20 hover:bg-green-50/60" : ""}
                  ${tx.match_status === "unmatched" ? "bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-50/60" : ""}
                  ${tx.match_status === "dismissed" ? "hover:bg-accent/30" : ""}`}
              >
                {/* Status pill */}
                <StatusPill status={tx.match_status} />

                {/* Date */}
                <span className="text-[12px] text-muted-foreground w-24 shrink-0">
                  {tx.date ? new Date(tx.date + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) : "—"}
                </span>

                {/* Description */}
                <span className="flex-1 text-[13px] truncate">{tx.description ?? "—"}</span>

                {/* Amount */}
                <span className={`text-[13px] font-semibold tabular-nums w-24 text-right shrink-0 ${tx.direction === "credit" ? "text-green-700 dark:text-green-400" : ""}`}>
                  {tx.direction === "credit" ? "+" : "-"}
                  {tx.amount != null ? tx.amount.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"} €
                </span>

                {/* Matched invoice / missing */}
                <div className="w-44 shrink-0 text-right">
                  {tx.match_status === "matched" && tx.matched_invoice ? (
                    <Link
                      href={`/invoice/${tx.matched_invoice.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-[12px] text-primary hover:underline truncate block"
                    >
                      {tx.matched_invoice.vendor ?? tx.matched_invoice.invoice_number ?? "Invoice"}
                    </Link>
                  ) : tx.match_status === "unmatched" ? (
                    <button
                      onClick={() => openMatchDialog(tx)}
                      className="text-[12px] text-amber-600 hover:text-amber-700 hover:underline"
                    >
                      Missing invoice →
                    </button>
                  ) : (
                    <span className="text-[12px] text-muted-foreground">Dismissed</span>
                  )}
                </div>

                {/* Hover action */}
                <div className="w-7 shrink-0 flex justify-center sm:opacity-0 sm:group-hover:opacity-100 sm:transition-opacity">
                  {tx.match_status === "unmatched" && (
                    <button onClick={() => handleDismiss(tx)} title="Dismiss" className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                      <X className="size-3.5" />
                    </button>
                  )}
                  {tx.match_status === "dismissed" && (
                    <button onClick={() => handleRestore(tx)} title="Restore" className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                      <RotateCcw className="size-3.5" />
                    </button>
                  )}
                  {tx.match_status === "matched" && (
                    <button onClick={() => handleUnlink(tx)} title="Unlink" className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                      <Unlink className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Match dialog */}
      {matchDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setMatchDialog(null)}>
          <div className="absolute inset-0 bg-overlay" />
          <div
            className="relative z-10 bg-card rounded-xl shadow-lg w-full max-w-md mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Dialog header */}
            <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold">Resolve unmatched transaction</p>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  {matchDialog.description} · {matchDialog.amount != null ? `${matchDialog.amount.toFixed(2)} €` : "—"}
                </p>
              </div>
              <button onClick={() => setMatchDialog(null)} className="text-muted-foreground hover:text-foreground mt-0.5">
                <X className="size-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border">
              {(["upload", "link"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setMatchTab(tab)}
                  className={`flex-1 py-2.5 text-[12px] font-medium transition-colors ${matchTab === tab ? "border-b-2 border-foreground text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {tab === "upload" ? "Upload invoice" : "Link existing"}
                </button>
              ))}
            </div>

            <div className="p-5">
              {matchTab === "upload" && (
                <div
                  {...getInvoiceRootProps()}
                  className={`border-2 border-dashed rounded-lg px-6 py-8 text-center cursor-pointer transition-colors
                    ${isInvoiceDragActive ? "border-ring bg-primary/5" : "border-border hover:border-muted-foreground/50"}
                    ${uploadingInvoice ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <input {...getInvoiceInputProps()} />
                  {uploadingInvoice ? (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Loader2 className="size-5 animate-spin" />
                      <p className="text-[12px]">Uploading & extracting…</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Upload className="size-5" />
                      <p className="text-[12px]">{isInvoiceDragActive ? "Drop here" : "Drop invoice or click to browse"}</p>
                      <p className="text-[11px] text-muted-foreground/60">PDF, JPG, PNG, HEIC</p>
                    </div>
                  )}
                </div>
              )}

              {matchTab === "link" && (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search by vendor or invoice number…"
                      value={invoiceSearch}
                      onChange={(e) => setInvoiceSearch(e.target.value)}
                      className="w-full h-8 pl-8 pr-3 text-[13px] rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/50"
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto divide-y divide-border/60 rounded-lg border border-border">
                    {filteredInvoices.length === 0 ? (
                      <p className="text-[12px] text-muted-foreground text-center py-4">No invoices found</p>
                    ) : (
                      filteredInvoices.map((inv) => (
                        <button
                          key={inv.id}
                          onClick={() => handleLinkInvoice(inv.id)}
                          disabled={confirmingMatch === inv.id}
                          className="w-full px-3 py-2.5 flex items-center justify-between gap-3 hover:bg-accent/40 transition-colors text-left"
                        >
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium truncate">{inv.vendor ?? "Unknown vendor"}</p>
                            <p className="text-[11px] text-muted-foreground">{inv.date} · {inv.invoice_number ?? "No invoice #"}</p>
                          </div>
                          <span className="text-[13px] font-semibold tabular-nums shrink-0">
                            {inv.amount != null ? `${inv.amount.toFixed(2)} €` : "—"}
                          </span>
                          {confirmingMatch === inv.id && <Loader2 className="size-3.5 animate-spin shrink-0" />}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "matched") return (
    <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded shrink-0 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400">
      ● Matched
    </span>
  );
  if (status === "unmatched") return (
    <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded shrink-0 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-500">
      ● Missing
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded shrink-0 bg-muted text-muted-foreground">
      ● Dismissed
    </span>
  );
}
