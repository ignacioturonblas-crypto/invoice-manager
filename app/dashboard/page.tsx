"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Invoice, Quarter } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Search, LogOut, Trash2, Loader2, Receipt, TrendingUp, TrendingDown, SlidersHorizontal } from "lucide-react";
import Link from "next/link";

const QUARTERS: Quarter[] = ["T1", "T2", "T3", "T4"];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

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
  const [filterOpen, setFilterOpen] = useState(false);
  const router = useRouter();
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

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

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

  const fmt = (n: number) =>
    new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background/80 backdrop-blur border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="text-[15px] font-semibold tracking-tight text-primary/90">Invoice Manager</h1>
          <div className="flex items-center gap-2">
            <Link href="/upload">
              <Button size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Upload
              </Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Log out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* Stats */}
        {invoices.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className="p-2 bg-red-50 dark:bg-red-950/30 rounded-lg transition-colors">
                <TrendingDown className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Total spent</p>
                <p className="text-base font-bold tabular-nums">{fmt(totalPayments)}</p>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className="p-2 bg-green-50 dark:bg-green-950/30 rounded-lg transition-colors">
                <TrendingUp className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Total earned</p>
                <p className="text-base font-bold tabular-nums">{fmt(totalIncome)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Search + filter toggle */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by vendor…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilterOpen((o) => !o)}
            className="gap-1.5 shrink-0"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filter
            {(filterYear !== CURRENT_YEAR || filterQuarter !== "all" || filterType !== "all") && (
              <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </Button>
        </div>

        {/* Collapsible filter panel */}
        {filterOpen && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-3 animate-in fade-in-0 slide-in-from-top-2 duration-150">
            {/* Year filter */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilterYear("all")}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  filterYear === "all"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-foreground/30"
                }`}
              >
                All years
              </button>
              {YEARS.map((y) => (
                <button
                  key={y}
                  onClick={() => setFilterYear(y)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    filterYear === y
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-foreground/30"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>

            {/* Quarter filter */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilterQuarter("all")}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  filterQuarter === "all"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-foreground/30"
                }`}
              >
                All quarters
              </button>
              {QUARTERS.map((q) => (
                <button
                  key={q}
                  onClick={() => setFilterQuarter(q)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    filterQuarter === q
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-foreground/30"
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Type filter */}
            <div className="flex gap-2">
              {(["all", "payment", "income"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${
                    filterType === t
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-foreground/30"
                  }`}
                >
                  {t === "all" ? "All types" : t}
                </button>
              ))}
            </div>
          </div>
        )}

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
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Select all header */}
            <div className="px-4 py-3 border-b border-border flex items-center gap-3">
              <Checkbox
                checked={selected.size === invoices.length && invoices.length > 0}
                onCheckedChange={toggleSelectAll}
                aria-label="Select all"
              />
              <span className="text-xs text-muted-foreground">{invoices.length} invoice{invoices.length !== 1 ? "s" : ""}</span>
            </div>

            {invoices.map((invoice, i) => (
              <div key={invoice.id} className={i < invoices.length - 1 ? "border-b border-border" : ""}>
                <div className="px-4 py-4 flex items-center gap-3 hover:bg-accent/50 transition-colors group">
                  <Checkbox
                    checked={selected.has(invoice.id)}
                    onCheckedChange={() => toggleSelect(invoice.id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select ${invoice.vendor ?? invoice.file_name}`}
                  />
                  <Link
                    href={`/invoice/${invoice.id}`}
                    className="flex-1 flex items-center gap-3 min-w-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold truncate">
                          {invoice.vendor ?? invoice.file_name}
                        </span>
                        {invoice.status === "processing" && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            <Loader2 className="h-2.5 w-2.5 animate-spin mr-1" />
                            Processing
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {invoice.date && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(invoice.date).toLocaleDateString("es-ES")}
                          </span>
                        )}
                        {invoice.quarter && invoice.year && (
                          <Badge variant="outline" className="text-xs px-1.5 py-0">
                            {invoice.quarter} {invoice.year}
                          </Badge>
                        )}
                        <Badge
                          variant="secondary"
                          className={`text-xs px-1.5 py-0 ${
                            invoice.type === "income"
                              ? "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400"
                              : "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400"
                          }`}
                        >
                          {invoice.type}
                        </Badge>
                      </div>
                    </div>
                    {invoice.amount != null && (
                      <span className="text-[15px] font-bold tabular-nums shrink-0">
                        {fmt(invoice.amount)}
                      </span>
                    )}
                  </Link>
                  <button
                    className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelected(new Set([invoice.id]));
                      setDeleteDialogOpen(true);
                    }}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

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
