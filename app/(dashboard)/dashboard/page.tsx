"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Invoice, Quarter } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { KpiCard } from "@/components/kpi-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Search, Trash2, Loader2, Receipt, TrendingUp, TrendingDown, Hash, Calendar } from "lucide-react";
import Link from "next/link";

const QUARTERS: Quarter[] = ["T1", "T2", "T3", "T4"];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

const chipBase = "text-xs px-3 py-1.5 rounded-full border transition-colors cursor-pointer";
const chipActive = "bg-primary text-primary-foreground border-primary";
const chipInactive = "border-border text-muted-foreground hover:border-foreground/30";

export default function DashboardPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "payment" | "income">("all");
  const [filterQuarter, setFilterQuarter] = useState<Quarter | "all">("all");
  const [filterYear, setFilterYear] = useState<number | "all">(CURRENT_YEAR);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const supabase = createClient();

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("invoices")
      .select("*")
      .order("created_at", { ascending: false });

    if (filterType !== "all") query = query.eq("type", filterType);
    if (filterQuarter !== "all") query = query.eq("quarter", filterQuarter);
    if (filterYear !== "all") query = query.eq("year", filterYear);
    if (search.trim()) query = query.ilike("vendor", `%${search.trim()}%`);

    const { data, error } = await query;
    if (!error) setInvoices((data as Invoice[]) ?? []);
    setLoading(false);
  }, [filterType, filterQuarter, filterYear, search, supabase]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === invoices.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(invoices.map((i) => i.id)));
    }
  }

  async function handleDelete(ids: string[]) {
    setDeleting(true);
    const res = await fetch("/api/delete-invoice", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });

    if (res.ok) {
      toast.success(`Deleted ${ids.length} invoice${ids.length > 1 ? "s" : ""}`);
      setSelected(new Set());
      fetchInvoices();
    } else {
      toast.error("Delete failed");
    }
    setDeleting(false);
    setDeleteDialogOpen(false);
  }

  // Stats
  const totalPayments = invoices
    .filter((i) => i.type === "payment" && i.amount)
    .reduce((sum, i) => sum + (i.amount ?? 0), 0);
  const totalIncome = invoices
    .filter((i) => i.type === "income" && i.amount)
    .reduce((sum, i) => sum + (i.amount ?? 0), 0);
  const lastUpload = invoices[0]?.created_at
    ? new Date(invoices[0].created_at).toLocaleDateString("es-ES")
    : "—";

  const fmt = (n: number) =>
    new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

  return (
    <div className="max-w-4xl space-y-5">
      {/* Stats */}
      {invoices.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Total spent"
            value={fmt(totalPayments)}
            icon={<TrendingDown className="h-4 w-4 text-red-500" />}
            iconBg="bg-red-50 dark:bg-red-950/30"
          />
          <KpiCard
            label="Total earned"
            value={fmt(totalIncome)}
            icon={<TrendingUp className="h-4 w-4 text-green-500" />}
            iconBg="bg-green-50 dark:bg-green-950/30"
          />
          <KpiCard
            label="Invoices"
            value={String(invoices.length)}
            icon={<Hash className="h-4 w-4 text-primary" />}
            iconBg="bg-primary/10"
          />
          <KpiCard
            label="Last upload"
            value={lastUpload}
            icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
            iconBg="bg-muted"
          />
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by vendor…"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Filter chips — always visible */}
      <div className="flex flex-wrap gap-2 overflow-x-auto -mx-6 px-6 pb-0.5">
        <button
          onClick={() => setFilterYear("all")}
          className={`${chipBase} ${filterYear === "all" ? chipActive : chipInactive} shrink-0`}
        >
          All years
        </button>
        {YEARS.map((y) => (
          <button
            key={y}
            onClick={() => setFilterYear(y)}
            className={`${chipBase} ${filterYear === y ? chipActive : chipInactive} shrink-0`}
          >
            {y}
          </button>
        ))}
        <span className="border-l border-border mx-1 self-stretch" />
        <button
          onClick={() => setFilterQuarter("all")}
          className={`${chipBase} ${filterQuarter === "all" ? chipActive : chipInactive} shrink-0`}
        >
          All quarters
        </button>
        {QUARTERS.map((q) => (
          <button
            key={q}
            onClick={() => setFilterQuarter(q)}
            className={`${chipBase} ${filterQuarter === q ? chipActive : chipInactive} shrink-0`}
          >
            {q}
          </button>
        ))}
        <span className="border-l border-border mx-1 self-stretch" />
        {(["all", "payment", "income"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`${chipBase} ${filterType === t ? chipActive : chipInactive} capitalize shrink-0`}
          >
            {t === "all" ? "All types" : t}
          </button>
        ))}
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="bg-foreground text-background rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button
            size="sm"
            variant="destructive"
            className="gap-1.5 h-7 text-xs"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete selected
          </Button>
        </div>
      )}

      {/* Invoice list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-20">
          <Receipt className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="font-semibold text-foreground">No invoices yet</p>
          <p className="text-sm text-muted-foreground mt-1 mb-5">Upload your first invoice to get started</p>
          <Link href="/upload">
            <Button className="gap-1.5">
              <Plus className="h-4 w-4" />
              Upload invoice
            </Button>
          </Link>
        </div>
      ) : (
        <div className="bg-card rounded-xl shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="px-5 h-9 border-b border-border flex items-center gap-4 bg-muted/40">
            <div className="w-5 shrink-0">
              <Checkbox
                checked={selected.size === invoices.length && invoices.length > 0}
                onCheckedChange={toggleSelectAll}
                aria-label="Select all"
              />
            </div>
            <span className="text-label text-muted-foreground flex-1">Vendor</span>
            <span className="text-label text-muted-foreground w-24 hidden sm:block">Date</span>
            <span className="text-label text-muted-foreground w-20 hidden md:block">Quarter</span>
            <span className="text-label text-muted-foreground w-16 hidden md:block">Type</span>
            <span className="text-label text-muted-foreground w-28 text-right">Amount</span>
            <div className="w-7 shrink-0" />
          </div>

          {invoices.map((invoice, i) => (
            <div
              key={invoice.id}
              className={[
                "group px-5 flex items-center gap-4 h-[52px] hover:bg-accent/40 transition-colors duration-150",
                i < invoices.length - 1 ? "border-b border-border/60" : "",
              ].join(" ")}
            >
              {/* Checkbox — visible on hover or when checked */}
              <div className="w-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                style={{ opacity: selected.has(invoice.id) ? 1 : undefined }}
              >
                <Checkbox
                  checked={selected.has(invoice.id)}
                  onCheckedChange={() => toggleSelect(invoice.id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Select ${invoice.vendor ?? invoice.file_name}`}
                />
              </div>

              {/* Vendor + status */}
              <Link
                href={`/invoice/${invoice.id}`}
                className="flex-1 flex items-center gap-3 min-w-0 h-full"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-foreground truncate leading-none">
                      {invoice.vendor ?? invoice.file_name}
                    </span>
                    {invoice.status === "processing" && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5 shrink-0 gap-1">
                        <Loader2 className="h-2 w-2 animate-spin" />
                        Processing
                      </Badge>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground sm:hidden mt-0.5 block">
                    {invoice.date ? new Date(invoice.date).toLocaleDateString("es-ES") : "—"}
                    {invoice.quarter && invoice.year ? ` · ${invoice.quarter} ${invoice.year}` : ""}
                  </span>
                </div>
              </Link>

              {/* Date */}
              <span className="text-[12px] text-muted-foreground w-24 hidden sm:block shrink-0">
                {invoice.date ? new Date(invoice.date).toLocaleDateString("es-ES") : "—"}
              </span>

              {/* Quarter */}
              <div className="w-20 hidden md:flex shrink-0">
                {invoice.quarter && invoice.year ? (
                  <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {invoice.quarter} {invoice.year}
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground/50">—</span>
                )}
              </div>

              {/* Type */}
              <div className="w-16 hidden md:flex shrink-0">
                <span className={[
                  "text-[11px] font-medium px-2 py-0.5 rounded capitalize",
                  invoice.type === "income"
                    ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400"
                    : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
                ].join(" ")}>
                  {invoice.type}
                </span>
              </div>

              {/* Amount */}
              <span className={[
                "text-[13px] font-semibold tabular-nums w-28 text-right shrink-0",
                invoice.type === "income" ? "text-green-700 dark:text-green-400" : "text-foreground",
              ].join(" ")}>
                {invoice.amount != null ? fmt(invoice.amount) : "—"}
              </span>

              {/* Delete — hover only */}
              <div className="w-7 shrink-0 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <button
                  className="p-1 rounded text-muted-foreground/50 hover:text-destructive hover:bg-destructive/8 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setSelected(new Set([invoice.id]));
                    setDeleteDialogOpen(true);
                  }}
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selected.size > 1 ? `${selected.size} invoices` : "invoice"}?</DialogTitle>
            <DialogDescription>
              This will permanently delete the {selected.size > 1 ? "files and records" : "file and record"}. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDelete(Array.from(selected))}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
