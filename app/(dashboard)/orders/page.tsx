"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { KpiCard } from "@/components/kpi-card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Package, Plus, CheckCircle2, AlertCircle, Clock, TrendingUp,
  ChevronRight, X, Check, Trash2, Loader2,
} from "lucide-react";
import type { Order, OrderEvent, OrderStatus, OrderType, Supplier } from "@/lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const ORDER_STATUSES: OrderStatus[] = ["draft", "confirmed", "in_production", "quality_check", "shipped", "delivered", "cancelled"];

const STATUS_LABELS: Record<OrderStatus, string> = {
  draft: "Draft", confirmed: "Confirmed", in_production: "In production",
  quality_check: "Quality check", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  confirmed: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  in_production: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  quality_check: "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400",
  shipped: "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400",
  delivered: "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400",
  cancelled: "bg-muted text-muted-foreground line-through",
};

const ACTIVE_STATUSES: OrderStatus[] = ["draft", "confirmed", "in_production", "quality_check", "shipped"];

const chipBase = "px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors cursor-pointer";
const chipActive = "bg-foreground text-background";
const chipInactive = "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.round((Date.parse(dateStr) - Date.now()) / 86_400_000);
}

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  return d.toLocaleDateString("es-ES", {
    day: "2-digit", month: "short",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function DaysPill({ days, status }: { days: number | null; status: OrderStatus }) {
  if (status === "delivered") return <CheckCircle2 className="size-3.5 text-green-600" />;
  if (status === "cancelled") return <span className="text-[11px] text-muted-foreground">—</span>;
  if (days === null) return <span className="text-[11px] text-muted-foreground">—</span>;
  if (days > 14) return <span className="text-[12px] text-muted-foreground tabular-nums">{days}d</span>;
  if (days >= 8) return <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 tabular-nums">{days}d</span>;
  if (days >= 1) return <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 tabular-nums">{days}d</span>;
  if (days === 0) return <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-700">Today</span>;
  return <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-800 tabular-nums">{days}d</span>;
}

function supplierInitial(name: string): string {
  return name.trim()[0]?.toUpperCase() ?? "?";
}

// ─── Main page (wrapped for Suspense) ─────────────────────────────────────────

function OrdersPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [orders, setOrders] = useState<Order[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterType, setFilterType] = useState<OrderType | "all">("all");
  const [filterStage, setFilterStage] = useState<OrderStatus | "overdue" | "all">("all");
  const [filterSupplier, setFilterSupplier] = useState<string>("all");

  // Detail panel
  const [selected, setSelected] = useState<Order | null>(null);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [panelSaving, setPanelSaving] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Order>>({});
  const [noteInput, setNoteInput] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [deletingOrder, setDeletingOrder] = useState(false);

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<{ supplier_id: string; reference: string; type: OrderType; quantity: string; expected_date: string; notes: string }>({
    supplier_id: "", reference: "", type: "sampling", quantity: "", expected_date: "", notes: "",
  });
  const [addSaving, setAddSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    const [ordersRes, suppliersRes] = await Promise.all([
      supabase.from("orders").select("*, supplier:suppliers(id, business_name, country)").order("expected_date", { ascending: true, nullsFirst: false }),
      supabase.from("suppliers").select("*").order("business_name"),
    ]);
    setOrders((ordersRes.data as Order[]) ?? []);
    setSuppliers((suppliersRes.data as Supplier[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Handle URL params
  useEffect(() => {
    const sup = searchParams.get("supplier");
    const type = searchParams.get("type") as OrderType | null;
    const add = searchParams.get("add");
    if (sup) setFilterSupplier(sup);
    if (type) setFilterType(type);
    if (add === "1") {
      const preSupplier = searchParams.get("supplier") ?? "";
      setAddForm((f) => ({ ...f, supplier_id: preSupplier }));
      setAddOpen(true);
    }
  }, [searchParams]);

  // ── Derived data ──
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filtered = orders.filter((o) => {
    if (filterType !== "all" && o.type !== filterType) return false;
    if (filterSupplier !== "all" && o.supplier_id !== filterSupplier) return false;
    if (filterStage === "overdue") {
      if (!o.expected_date) return false;
      return new Date(o.expected_date + "T00:00:00") < today && ACTIVE_STATUSES.includes(o.status);
    }
    if (filterStage !== "all") return o.status === filterStage;
    return true;
  });

  const activeCount = orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length;
  const arrivingIn7 = orders.filter((o) => {
    if (!o.expected_date || !ACTIVE_STATUSES.includes(o.status)) return false;
    const d = daysUntil(o.expected_date);
    return d !== null && d >= 0 && d <= 7;
  }).length;
  const overdueCount = orders.filter((o) => {
    if (!o.expected_date || !ACTIVE_STATUSES.includes(o.status)) return false;
    return new Date(o.expected_date + "T00:00:00") < today;
  }).length;
  const deliveredWithDates = orders.filter((o) => o.status === "delivered" && o.actual_date && o.order_date);
  const avgLeadDays = deliveredWithDates.length > 0
    ? Math.round(deliveredWithDates.reduce((sum, o) => sum + (Date.parse(o.actual_date!) - Date.parse(o.order_date)) / 86_400_000, 0) / deliveredWithDates.length)
    : null;

  // ── Panel actions ──
  async function openDetail(order: Order) {
    setSelected(order);
    setEditForm({
      reference: order.reference, type: order.type, quantity: order.quantity,
      unit_cost: order.unit_cost, currency: order.currency,
      order_date: order.order_date, expected_date: order.expected_date,
      actual_date: order.actual_date, notes: order.notes,
    });
    const { data } = await supabase.from("order_events").select("*").eq("order_id", order.id).order("event_date", { ascending: false });
    setEvents((data as OrderEvent[]) ?? []);
    setNoteInput("");
    setAddingNote(false);
  }

  async function handleStageClick(newStatus: OrderStatus) {
    if (!selected) return;
    const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", selected.id);
    if (error) { toast.error("Failed to update stage"); return; }
    await supabase.from("order_events").insert({ order_id: selected.id, status: newStatus, event_date: new Date().toISOString().slice(0, 10) });
    const updated = { ...selected, status: newStatus };
    setSelected(updated);
    setOrders((prev) => prev.map((o) => o.id === selected.id ? updated : o));
    const { data } = await supabase.from("order_events").select("*").eq("order_id", selected.id).order("event_date", { ascending: false });
    setEvents((data as OrderEvent[]) ?? []);
    toast.success(`Moved to ${STATUS_LABELS[newStatus]}`);
  }

  async function handleSavePanel() {
    if (!selected) return;
    setPanelSaving(true);
    const { error } = await supabase.from("orders").update({
      reference: editForm.reference, type: editForm.type,
      quantity: editForm.quantity || null, unit_cost: editForm.unit_cost || null,
      currency: editForm.currency, order_date: editForm.order_date,
      expected_date: editForm.expected_date || null, actual_date: editForm.actual_date || null,
      notes: editForm.notes || null,
    }).eq("id", selected.id);
    setPanelSaving(false);
    if (error) { toast.error("Save failed"); return; }
    const updated = { ...selected, ...editForm } as Order;
    setSelected(updated);
    setOrders((prev) => prev.map((o) => o.id === selected.id ? updated : o));
    toast.success("Saved");
  }

  async function handleAddNote() {
    if (!selected || !noteInput.trim()) return;
    setAddingNote(true);
    await supabase.from("order_events").insert({ order_id: selected.id, status: selected.status, note: noteInput.trim(), event_date: new Date().toISOString().slice(0, 10) });
    const { data } = await supabase.from("order_events").select("*").eq("order_id", selected.id).order("event_date", { ascending: false });
    setEvents((data as OrderEvent[]) ?? []);
    setNoteInput("");
    setAddingNote(false);
    toast.success("Note added");
  }

  async function handleDeleteOrder() {
    if (!selected) return;
    setDeletingOrder(true);
    const { error } = await supabase.from("orders").delete().eq("id", selected.id);
    setDeletingOrder(false);
    if (error) { toast.error("Delete failed"); return; }
    setOrders((prev) => prev.filter((o) => o.id !== selected.id));
    setSelected(null);
    toast.success("Order deleted");
  }

  // ── Add order ──
  async function handleAddOrder(andAnother = false) {
    if (!addForm.supplier_id || !addForm.reference || !addForm.type) {
      toast.error("Supplier, reference and type are required");
      return;
    }
    setAddSaving(true);
    const { data, error } = await supabase.from("orders").insert({
      supplier_id: addForm.supplier_id, reference: addForm.reference, type: addForm.type,
      quantity: addForm.quantity ? Number(addForm.quantity) : null,
      expected_date: addForm.expected_date || null, notes: addForm.notes || null,
      order_date: new Date().toISOString().slice(0, 10), status: "draft",
    }).select("*, supplier:suppliers(id, business_name, country)").single();
    setAddSaving(false);
    if (error || !data) { toast.error("Failed to create order"); return; }
    // Insert initial draft event
    await supabase.from("order_events").insert({ order_id: data.id, status: "draft", event_date: new Date().toISOString().slice(0, 10) });
    setOrders((prev) => [data as Order, ...prev]);
    toast.success("Order created");
    if (andAnother) {
      setAddForm((f) => ({ ...f, reference: "", quantity: "", expected_date: "", notes: "" }));
    } else {
      setAddOpen(false);
      setAddForm({ supplier_id: "", reference: "", type: "sampling", quantity: "", expected_date: "", notes: "" });
    }
  }

  const prefilledSupplier = searchParams.get("supplier") ?? "";

  const inputClass = "w-full h-8 px-3 text-[13px] rounded-md border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring/50";
  const labelClass = "text-[11px] font-medium text-muted-foreground uppercase tracking-wide";

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-muted-foreground text-[13px]">
      <Loader2 className="size-4 animate-spin mr-2" /> Loading…
    </div>
  );

  return (
    <div className="space-y-5 max-w-4xl">

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Active orders" value={String(activeCount)} icon={<Package className="size-4 text-primary" />} iconBg="bg-primary/10" />
        <KpiCard label="Arriving in 7d" value={String(arrivingIn7)} icon={<Clock className="size-4 text-amber-600" />} iconBg="bg-amber-50 dark:bg-amber-950/30" />
        <KpiCard label="Overdue" value={String(overdueCount)} icon={<AlertCircle className="size-4 text-red-600" />} iconBg="bg-red-50 dark:bg-red-950/30" />
        <KpiCard label="Avg lead time" value={avgLeadDays !== null ? `${avgLeadDays}d` : "—"} icon={<TrendingUp className="size-4 text-muted-foreground" />} iconBg="bg-muted" />
      </div>

      {/* Filters + Add button */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Type chips */}
          {(["all", "sampling", "production"] as const).map((t) => (
            <button key={t} onClick={() => setFilterType(t)} className={`${chipBase} ${filterType === t ? chipActive : chipInactive}`}>
              {t === "all" ? "All types" : t === "sampling" ? "Sampling" : "Production"}
            </button>
          ))}
          <span className="text-border">|</span>
          {/* Stage chips */}
          {(["all", "confirmed", "in_production", "quality_check", "shipped", "overdue"] as const).map((s) => (
            <button key={s} onClick={() => setFilterStage(s)} className={`${chipBase} ${filterStage === s ? chipActive : chipInactive}`}>
              {s === "all" ? "All stages" : s === "overdue" ? "Overdue" : STATUS_LABELS[s as OrderStatus]}
            </button>
          ))}
          {/* Supplier filter */}
          <select
            value={filterSupplier}
            onChange={(e) => setFilterSupplier(e.target.value)}
            className="h-8 rounded-full border border-border bg-card px-3 text-[12px] focus:outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="all">All suppliers</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.business_name}</option>)}
          </select>
        </div>
        <Button size="sm" onClick={() => { setAddForm((f) => ({ ...f, supplier_id: filterSupplier !== "all" ? filterSupplier : "" })); setAddOpen(true); }}>
          <Plus className="size-3.5 mr-1" /> Add order
        </Button>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="hidden md:grid px-5 h-9 border-b border-border text-label text-muted-foreground items-center"
          style={{ gridTemplateColumns: "32px 1fr 80px 110px 56px 96px 72px 28px" }}>
          <div />
          <div>Order</div>
          <div>Type</div>
          <div>Stage</div>
          <div className="text-right">Qty</div>
          <div>Expected</div>
          <div className="text-right">Days</div>
          <div />
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <Package className="size-10 opacity-25" />
            <p className="text-[13px] font-medium text-foreground">No orders yet</p>
            <p className="text-[12px]">Add your first order to start tracking</p>
            <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5 mr-1" /> Add order</Button>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {filtered.map((order) => {
              const days = daysUntil(order.expected_date);
              const sup = order.supplier;
              return (
                <div
                  key={order.id}
                  onClick={() => openDetail(order)}
                  className="group px-5 flex md:grid items-center gap-3 h-[52px] hover:bg-accent/40 cursor-pointer transition-colors"
                  style={{ gridTemplateColumns: "32px 1fr 80px 110px 56px 96px 72px 28px" }}
                >
                  {/* Avatar */}
                  <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-primary">{sup ? supplierInitial(sup.business_name) : "?"}</span>
                  </div>
                  {/* Ref + supplier */}
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium truncate">{order.reference}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{sup?.business_name ?? "—"}</p>
                  </div>
                  {/* Type */}
                  <span className={`hidden md:inline-flex text-[11px] font-medium px-1.5 py-0.5 rounded ${order.type === "sampling" ? "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400" : "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400"}`}>
                    {order.type === "sampling" ? "Sample" : "Prod"}
                  </span>
                  {/* Stage */}
                  <span className={`hidden md:inline-flex text-[11px] font-medium px-1.5 py-0.5 rounded ${STATUS_COLORS[order.status]}`}>
                    {STATUS_LABELS[order.status]}
                  </span>
                  {/* Qty */}
                  <span className="hidden md:block text-[12px] text-muted-foreground tabular-nums text-right">
                    {order.quantity ?? "—"}
                  </span>
                  {/* Expected */}
                  <span className="hidden md:block text-[12px] text-muted-foreground">{formatShortDate(order.expected_date)}</span>
                  {/* Days */}
                  <div className="hidden md:flex justify-end">
                    <DaysPill days={days} status={order.status} />
                  </div>
                  {/* Chevron */}
                  <div className="sm:opacity-0 sm:group-hover:opacity-100 sm:transition-opacity ml-auto md:ml-0">
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Detail panel (right slide-over) ── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-overlay" onClick={() => setSelected(null)} />
          <div className="relative z-10 w-full max-w-md bg-card shadow-lg flex flex-col overflow-hidden">
            {/* Panel header */}
            <div className="px-5 py-4 border-b border-border flex items-start gap-3 shrink-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${selected.type === "sampling" ? "bg-blue-50 text-blue-700" : "bg-violet-50 text-violet-700"}`}>
                    {selected.type === "sampling" ? "Sampling" : "Production"}
                  </span>
                  <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${STATUS_COLORS[selected.status]}`}>
                    {STATUS_LABELS[selected.status]}
                  </span>
                </div>
                <p className="text-[15px] font-semibold mt-1 truncate">{selected.reference}</p>
                <p className="text-[12px] text-muted-foreground">{selected.supplier?.business_name}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground mt-0.5 shrink-0">
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Stage bar */}
              <div className="px-5 py-4 border-b border-border">
                <p className={labelClass + " mb-3"}>Stage</p>
                <div className="flex items-center gap-1 flex-wrap">
                  {(ORDER_STATUSES.filter((s) => s !== "cancelled") as OrderStatus[]).map((s, i, arr) => (
                    <div key={s} className="flex items-center">
                      <button
                        onClick={() => handleStageClick(s)}
                        className={`text-[11px] font-medium px-2 py-1 rounded transition-colors
                          ${selected.status === s ? STATUS_COLORS[s] + " ring-1 ring-current/30" : "bg-muted text-muted-foreground hover:bg-accent"}`}
                      >
                        {STATUS_LABELS[s]}
                      </button>
                      {i < arr.length - 1 && <ChevronRight className="size-3 text-muted-foreground mx-0.5 shrink-0" />}
                    </div>
                  ))}
                </div>
                {selected.status !== "cancelled" && (
                  <button onClick={() => handleStageClick("cancelled")} className="mt-3 text-[11px] text-muted-foreground hover:text-destructive transition-colors">
                    Cancel order
                  </button>
                )}
              </div>

              {/* Editable fields */}
              <div className="px-5 py-4 border-b border-border space-y-3">
                <div>
                  <p className={labelClass}>Reference</p>
                  <input className={inputClass + " mt-1"} value={editForm.reference ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, reference: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className={labelClass}>Type</p>
                    <select className={inputClass + " mt-1"} value={editForm.type ?? "sampling"} onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value as OrderType }))}>
                      <option value="sampling">Sampling</option>
                      <option value="production">Production</option>
                    </select>
                  </div>
                  <div>
                    <p className={labelClass}>Quantity</p>
                    <input type="number" className={inputClass + " mt-1"} value={editForm.quantity ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, quantity: e.target.value ? Number(e.target.value) : null }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className={labelClass}>Unit cost</p>
                    <input type="number" step="0.01" className={inputClass + " mt-1"} value={editForm.unit_cost ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, unit_cost: e.target.value ? Number(e.target.value) : null }))} />
                  </div>
                  <div>
                    <p className={labelClass}>Currency</p>
                    <input className={inputClass + " mt-1"} value={editForm.currency ?? "EUR"} onChange={(e) => setEditForm((f) => ({ ...f, currency: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className={labelClass}>Order date</p>
                    <input type="date" className={inputClass + " mt-1"} value={editForm.order_date ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, order_date: e.target.value }))} />
                  </div>
                  <div>
                    <p className={labelClass}>Expected date</p>
                    <input type="date" className={inputClass + " mt-1"} value={editForm.expected_date ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, expected_date: e.target.value }))} />
                  </div>
                </div>
                {selected.status === "delivered" && (
                  <div>
                    <p className={labelClass}>Actual arrival</p>
                    <input type="date" className={inputClass + " mt-1"} value={editForm.actual_date ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, actual_date: e.target.value }))} />
                  </div>
                )}
                <div>
                  <p className={labelClass}>Notes</p>
                  <textarea rows={3} className={inputClass + " mt-1 h-auto py-2 resize-none"} value={editForm.notes ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>

              {/* Timeline */}
              <div className="px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <p className={labelClass}>History</p>
                  <button onClick={() => setAddingNote((v) => !v)} className="text-[11px] text-primary hover:underline">
                    {addingNote ? "Cancel" : "+ Add note"}
                  </button>
                </div>
                {addingNote && (
                  <div className="flex gap-2 mb-3">
                    <input
                      className={inputClass + " flex-1"}
                      placeholder="Add a note…"
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddNote(); }}
                    />
                    <button onClick={handleAddNote} disabled={!noteInput.trim()} className="px-2 rounded-md bg-foreground text-background disabled:opacity-40">
                      <Check className="size-3.5" />
                    </button>
                  </div>
                )}
                {events.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground">No history yet.</p>
                ) : (
                  <div className="space-y-2">
                    {events.map((ev) => (
                      <div key={ev.id} className="flex gap-3 items-start">
                        <span className="text-[11px] text-muted-foreground w-16 shrink-0 pt-0.5">{formatShortDate(ev.event_date)}</span>
                        <div className="flex-1">
                          <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${STATUS_COLORS[ev.status]}`}>{STATUS_LABELS[ev.status]}</span>
                          {ev.note && <p className="text-[12px] text-muted-foreground mt-1">{ev.note}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Panel footer */}
            <div className="px-5 py-3 border-t border-border flex items-center justify-between shrink-0">
              <button
                onClick={handleDeleteOrder}
                disabled={deletingOrder}
                className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-destructive transition-colors"
              >
                {deletingOrder ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                Delete
              </button>
              <Button size="sm" onClick={handleSavePanel} disabled={panelSaving}>
                {panelSaving ? <Loader2 className="size-3.5 animate-spin mr-1" /> : null}
                Save changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add order dialog ── */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setAddOpen(false)}>
          <div className="absolute inset-0 bg-overlay" />
          <div className="relative z-10 bg-card rounded-xl shadow-lg w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <p className="text-[13px] font-semibold">New order</p>
              <button onClick={() => setAddOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <p className={labelClass}>Supplier *</p>
                <select
                  className={inputClass + " mt-1"}
                  value={addForm.supplier_id}
                  onChange={(e) => setAddForm((f) => ({ ...f, supplier_id: e.target.value }))}
                  disabled={!!prefilledSupplier}
                >
                  <option value="">Select supplier…</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.business_name}</option>)}
                </select>
              </div>
              <div>
                <p className={labelClass}>Reference *</p>
                <input className={inputClass + " mt-1"} placeholder="e.g. SS25 Jacket sample" value={addForm.reference} onChange={(e) => setAddForm((f) => ({ ...f, reference: e.target.value }))} />
              </div>
              <div>
                <p className={labelClass}>Type *</p>
                <div className="flex gap-2 mt-1">
                  {(["sampling", "production"] as const).map((t) => (
                    <button key={t} onClick={() => setAddForm((f) => ({ ...f, type: t }))}
                      className={`flex-1 h-8 rounded-md text-[12px] font-medium border transition-colors ${addForm.type === t ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground/30"}`}>
                      {t === "sampling" ? "Sampling" : "Production"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className={labelClass}>Quantity</p>
                  <input type="number" className={inputClass + " mt-1"} placeholder="500" value={addForm.quantity} onChange={(e) => setAddForm((f) => ({ ...f, quantity: e.target.value }))} />
                </div>
                <div>
                  <p className={labelClass}>Expected date</p>
                  <input type="date" className={inputClass + " mt-1"} value={addForm.expected_date} onChange={(e) => setAddForm((f) => ({ ...f, expected_date: e.target.value }))} />
                </div>
              </div>
              <div>
                <p className={labelClass}>Notes</p>
                <textarea rows={2} className={inputClass + " mt-1 h-auto py-2 resize-none"} placeholder="Optional" value={addForm.notes} onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="px-5 py-3 border-t border-border flex items-center gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => handleAddOrder(true)} disabled={addSaving}>Save & add another</Button>
              <Button size="sm" onClick={() => handleAddOrder(false)} disabled={addSaving}>
                {addSaving ? <Loader2 className="size-3.5 animate-spin mr-1" /> : null} Save order
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-48 text-muted-foreground text-[13px]"><Loader2 className="size-4 animate-spin mr-2" /> Loading…</div>}>
      <OrdersPageInner />
    </Suspense>
  );
}
