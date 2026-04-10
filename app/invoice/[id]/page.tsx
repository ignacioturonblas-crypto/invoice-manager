"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useParams } from "next/navigation";
import type { Invoice, Quarter } from "@/lib/types";
import { getQuarterFromDate } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  Trash2,
  RefreshCw,
  Loader2,
  FileText,
  ExternalLink,
} from "lucide-react";

type EditableFields = {
  vendor: string;
  date: string;
  amount: string;
  currency: string;
  invoice_number: string;
  tax_amount: string;
  type: "payment" | "income";
  quarter: Quarter | "";
  year: string;
  notes: string;
};

export default function InvoicePage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const supabase = createClient();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reextracting, setReextracting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fields, setFields] = useState<EditableFields>({
    vendor: "",
    date: "",
    amount: "",
    currency: "EUR",
    invoice_number: "",
    tax_amount: "",
    type: "payment",
    quarter: "",
    year: "",
    notes: "",
  });

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        toast.error("Invoice not found");
        router.push("/dashboard");
        return;
      }

      const inv = data as Invoice;
      setInvoice(inv);
      setFields({
        vendor: inv.vendor ?? "",
        date: inv.date ?? "",
        amount: inv.amount != null ? String(inv.amount) : "",
        currency: inv.currency ?? "EUR",
        invoice_number: inv.invoice_number ?? "",
        tax_amount: inv.tax_amount != null ? String(inv.tax_amount) : "",
        type: inv.type,
        quarter: inv.quarter ?? "",
        year: inv.year != null ? String(inv.year) : "",
        notes: inv.notes ?? "",
      });

      // Get signed URL for the file
      const { data: urlData } = await supabase.storage
        .from("invoices")
        .createSignedUrl(inv.file_path, 3600);
      if (urlData) setFileUrl(urlData.signedUrl);

      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function set(key: keyof EditableFields, value: string) {
    setFields((prev) => {
      const next = { ...prev, [key]: value };
      // Auto-calculate quarter/year from date
      if (key === "date" && value) {
        const qd = getQuarterFromDate(value);
        if (qd) {
          next.quarter = qd.quarter;
          next.year = String(qd.year);
        }
      }
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase
      .from("invoices")
      .update({
        vendor: fields.vendor || null,
        date: fields.date || null,
        amount: fields.amount ? parseFloat(fields.amount) : null,
        currency: fields.currency || "EUR",
        invoice_number: fields.invoice_number || null,
        tax_amount: fields.tax_amount ? parseFloat(fields.tax_amount) : null,
        type: fields.type,
        quarter: fields.quarter || null,
        year: fields.year ? parseInt(fields.year) : null,
        notes: fields.notes || null,
        status: "done",
      })
      .eq("id", id);

    if (error) {
      toast.error("Failed to save changes");
    } else {
      toast.success("Changes saved");
    }
    setSaving(false);
  }

  async function handleReextract() {
    if (!invoice) return;
    setReextracting(true);
    const mimeType =
      invoice.file_type === "pdf" ? "application/pdf" : "image/jpeg";

    const res = await fetch("/api/extract-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceId: invoice.id,
        filePath: invoice.file_path,
        mimeType,
      }),
    });

    if (res.ok) {
      toast.success("Re-extraction complete — reloading…");
      // Reload to get updated fields
      window.location.reload();
    } else {
      toast.error("Re-extraction failed");
    }
    setReextracting(false);
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch("/api/delete-invoice", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });

    if (res.ok) {
      toast.success("Invoice deleted");
      router.push("/dashboard");
    } else {
      toast.error("Delete failed");
      setDeleting(false);
    }
    setDeleteDialogOpen(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!invoice) return null;

  const isPdf = invoice.file_type === "pdf";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background/80 backdrop-blur border-b border-border sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReextract}
              disabled={reextracting}
              className="gap-1.5"
            >
              {reextracting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Re-extract
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="gap-1.5"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save
            </Button>
            <button
              className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* File preview */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium truncate max-w-xs">
                  {invoice.file_name}
                </span>
              </div>
              {fileUrl && (
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
            <div className="aspect-[3/4] bg-muted flex items-center justify-center">
              {fileUrl ? (
                isPdf ? (
                  <iframe
                    src={fileUrl}
                    className="w-full h-full border-0"
                    title="Invoice preview"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={fileUrl}
                    alt="Invoice"
                    className="w-full h-full object-contain"
                  />
                )
              ) : (
                <div className="text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2" />
                  <p className="text-sm">Preview unavailable</p>
                </div>
              )}
            </div>
          </div>

          {/* Editable fields */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Extracted details</h2>
              {invoice.status === "processing" && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  Processing
                </Badge>
              )}
            </div>

            <Separator />

            {/* Type */}
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={fields.type}
                onValueChange={(v) => v && set("type", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="payment">Payment (you paid)</SelectItem>
                  <SelectItem value="income">Income (you received)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Vendor */}
            <div className="space-y-1.5">
              <Label htmlFor="vendor">Vendor / Client</Label>
              <Input
                id="vendor"
                value={fields.vendor}
                onChange={(e) => set("vendor", e.target.value)}
                placeholder="Company or person name"
              />
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={fields.date}
                onChange={(e) => set("date", e.target.value)}
              />
            </div>

            {/* Amount + Currency */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={fields.amount}
                  onChange={(e) => set("amount", e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={fields.currency}
                  onValueChange={(v) => v && set("currency", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tax */}
            <div className="space-y-1.5">
              <Label htmlFor="tax">Tax amount</Label>
              <Input
                id="tax"
                type="number"
                step="0.01"
                value={fields.tax_amount}
                onChange={(e) => set("tax_amount", e.target.value)}
                placeholder="0.00"
              />
            </div>

            {/* Invoice number */}
            <div className="space-y-1.5">
              <Label htmlFor="invoice_number">Invoice number</Label>
              <Input
                id="invoice_number"
                value={fields.invoice_number}
                onChange={(e) => set("invoice_number", e.target.value)}
                placeholder="INV-001"
              />
            </div>

            {/* Quarter + Year */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Quarter</Label>
                <Select
                  value={fields.quarter || "none"}
                  onValueChange={(v) => v && set("quarter", v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    <SelectItem value="T1">T1 (Jan–Mar)</SelectItem>
                    <SelectItem value="T2">T2 (Apr–Jun)</SelectItem>
                    <SelectItem value="T3">T3 (Jul–Sep)</SelectItem>
                    <SelectItem value="T4">T4 (Oct–Dec)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  type="number"
                  value={fields.year}
                  onChange={(e) => set("year", e.target.value)}
                  placeholder="2026"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                value={fields.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Any additional notes…"
                rows={3}
                className="w-full text-sm rounded-md border border-border bg-transparent px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full gap-1.5">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save changes
            </Button>
          </div>
        </div>
      </main>

      {/* Delete confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete invoice?</DialogTitle>
            <DialogDescription>
              This will permanently delete the file and all extracted data. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1.5" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
