"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { FileText, Plus, Pencil, Trash2, Loader2, Download, X, Check } from "lucide-react"
import type { CreatedInvoice, LineItem, InvoiceDirection, Supplier, MyCompany } from "@/lib/types"

// ─── Invoice CSS (for print window) ──────────────────────────────────────────

const INVOICE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #111; padding: 32px; max-width: 800px; margin: 0 auto; }
  h1 { font-size: 22px; font-weight: 700; margin-bottom: 0; }
  h2 { font-size: 14px; font-weight: 700; margin: 1.5em 0 0.75em; }
  .columns { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
  .address { flex: 1; line-height: 1.6; font-size: 12.5px; }
  .address strong:first-child { display: block; margin-bottom: 2px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #666; }
  hr { border: none; border-top: 1px solid #d1d5db; margin: 1.5em 0; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th { text-align: left; padding: 8px 10px; border-bottom: 1px solid #d1d5db; border-top: 1px solid #d1d5db; font-weight: 600; font-size: 11.5px; }
  td { padding: 8px 10px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
  .text-right { text-align: right; }
  .total-row td { border-bottom: none; padding-top: 4px; padding-bottom: 4px; }
  .grand-total td { font-weight: 700; font-size: 14px; border-top: 1px solid #d1d5db; padding-top: 10px; }
  .footer { margin-top: 2em; font-size: 12px; color: #555; }
  .pill { display: inline-block; padding: 1px 7px; border-radius: 20px; font-size: 11px; font-weight: 600; }
  @media print { body { padding: 20px; } }
`

// ─── Helpers ──────────────────────────────────────────────────────────────────

function money(n: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n)
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00")
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })
}

function lineTotal(item: LineItem): number {
  return item.quantity * item.unit_price
}

function calcTotals(items: LineItem[], shipping: number, vatRate: number) {
  const subtotalWithVat = items.reduce((s, i) => s + lineTotal(i), 0) + shipping
  if (vatRate === 0) {
    return { subtotalBase: subtotalWithVat, ivaAmount: 0, total: subtotalWithVat }
  }
  const subtotalBase = subtotalWithVat / (1 + vatRate / 100)
  const ivaAmount = subtotalWithVat - subtotalBase
  return { subtotalBase, ivaAmount, total: subtotalWithVat }
}

// ─── Invoice HTML generator ───────────────────────────────────────────────────

function buildInvoiceHtml(inv: Partial<InvoiceForm>): string {
  const items = inv.line_items ?? []
  const shipping = Number(inv.shipping_amount ?? 0)
  const vatRate = Number(inv.vat_rate ?? 21)
  const { subtotalBase, ivaAmount, total } = calcTotals(items, shipping, vatRate)
  const hasShipTo = inv.ship_to_name || inv.ship_to_address

  const addressBlock = (label: string, name: string | null | undefined, vat: string | null | undefined, address: string | null | undefined, zip: string | null | undefined, country: string | null | undefined, phone: string | null | undefined, email?: string | null) => {
    const lines = [name, vat ? `NIF: ${vat}` : null, address, zip, country, phone, email].filter(Boolean)
    return `<div class="address"><strong>${label}</strong>${lines.join("<br/>")}</div>`
  }

  return `
<div>
  <div class="columns" style="margin-bottom:1.5em">
    <h1>Factura #${inv.invoice_number || "—"}</h1>
    <div style="text-align:right;font-size:12.5px;line-height:1.7">
      ${inv.order_reference ? `Pedido ${inv.order_reference}<br/>` : ""}
      ${inv.invoice_date ? formatDate(inv.invoice_date) : ""}
    </div>
  </div>
  <div class="columns" style="margin-bottom:1.5em">
    ${addressBlock("De", inv.from_name, inv.from_vat, inv.from_address, inv.from_zip, inv.from_country, inv.from_phone)}
    ${addressBlock("Facturar a", inv.bill_to_name, inv.bill_to_vat, inv.bill_to_address, inv.bill_to_zip, inv.bill_to_country, null)}
    ${hasShipTo ? addressBlock("Enviar a", inv.ship_to_name, null, inv.ship_to_address, inv.ship_to_zip, inv.ship_to_country, null) : ""}
  </div>
  <hr/>
  <h2>Detalles del Pedido</h2>
  <table>
    <thead>
      <tr>
        <th style="width:60px">Cantidad</th>
        <th>Artículo</th>
        <th class="text-right" style="width:120px">Precio IVA incl.</th>
      </tr>
    </thead>
    <tbody>
      ${items.map(item => `
        <tr>
          <td>${item.quantity}</td>
          <td>${item.description || "—"}</td>
          <td class="text-right">${money(lineTotal(item))}</td>
        </tr>
      `).join("")}
      <tr class="total-row">
        <td colspan="2" class="text-right" style="color:#888">Envío</td>
        <td class="text-right" style="color:#888">${shipping > 0 ? money(shipping) : "GRATIS"}</td>
      </tr>
      ${vatRate > 0 ? `
      <tr class="total-row">
        <td colspan="2" class="text-right" style="color:#888">Subtotal sin IVA</td>
        <td class="text-right" style="color:#888">${money(subtotalBase)}</td>
      </tr>
      <tr class="total-row">
        <td colspan="2" class="text-right" style="color:#888">IVA ${vatRate}%</td>
        <td class="text-right" style="color:#888">${money(ivaAmount)}</td>
      </tr>
      ` : ""}
      <tr class="grand-total">
        <td colspan="2" class="text-right">Total</td>
        <td class="text-right">${money(total)}</td>
      </tr>
    </tbody>
  </table>
  ${inv.notes ? `<h2>Nota</h2><p style="font-size:12.5px;margin-top:0.5em">${inv.notes}</p>` : ""}
  ${inv.from_email ? `<p class="footer">Si tienes alguna pregunta, por favor envía un correo electrónico a <u>${inv.from_email}</u></p>` : ""}
</div>`
}

function printInvoice(inv: Partial<InvoiceForm>) {
  const html = buildInvoiceHtml(inv)
  const w = window.open("", "_blank")
  w?.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Factura ${inv.invoice_number ?? ""}</title><style>${INVOICE_CSS}</style></head><body>${html}</body></html>`)
  w?.document.close()
  w?.focus()
  setTimeout(() => w?.print(), 300)
}

// ─── Form type ────────────────────────────────────────────────────────────────

type InvoiceForm = {
  invoice_number: string
  invoice_date: string
  direction: InvoiceDirection
  order_reference: string
  from_name: string; from_vat: string; from_address: string; from_zip: string
  from_country: string; from_phone: string; from_email: string
  bill_to_name: string; bill_to_vat: string; bill_to_address: string
  bill_to_zip: string; bill_to_country: string
  ship_to_name: string; ship_to_address: string; ship_to_zip: string; ship_to_country: string
  line_items: LineItem[]
  shipping_amount: number
  vat_rate: number
  notes: string
  supplier_id: string
}

const BLANK_FORM: InvoiceForm = {
  invoice_number: "", invoice_date: todayISO(), direction: "outgoing", order_reference: "",
  from_name: "", from_vat: "", from_address: "", from_zip: "", from_country: "", from_phone: "", from_email: "",
  bill_to_name: "", bill_to_vat: "", bill_to_address: "", bill_to_zip: "", bill_to_country: "",
  ship_to_name: "", ship_to_address: "", ship_to_zip: "", ship_to_country: "",
  line_items: [{ description: "", quantity: 1, unit_price: 0 }],
  shipping_amount: 0, vat_rate: 21, notes: "", supplier_id: "",
}

// ─── Small field component ────────────────────────────────────────────────────

function F({ label, value, onChange, placeholder, type = "text", className = "" }: {
  label: string; value: string | number; onChange: (v: string) => void
  placeholder?: string; type?: string; className?: string
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? label}
        className="w-full h-8 px-2.5 text-[13px] rounded-md border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring/50"
      />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
      {children}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const supabase = createClient()
  const [invoices, setInvoices] = useState<CreatedInvoice[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [company, setCompany] = useState<MyCompany | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<"list" | "builder">("list")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<InvoiceForm>(BLANK_FORM)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showShipTo, setShowShipTo] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [invRes, supRes, coRes] = await Promise.all([
      supabase.from("created_invoices").select("*").order("invoice_date", { ascending: false }),
      supabase.from("suppliers").select("*").order("business_name"),
      supabase.from("my_company").select("*").maybeSingle(),
    ])
    setInvoices((invRes.data as CreatedInvoice[]) ?? [])
    setSuppliers((supRes.data as Supplier[]) ?? [])
    setCompany(coRes.data ?? null)
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Auto-suggest invoice number
  async function suggestInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear()
    const { data } = await supabase
      .from("created_invoices")
      .select("invoice_number")
      .ilike("invoice_number", `%-${year}`)
      .order("invoice_number", { ascending: false })
      .limit(1)
    if (data && data.length > 0) {
      const last = data[0].invoice_number
      const num = parseInt(last.split("-")[0], 10)
      if (!isNaN(num)) return `${String(num + 1).padStart(3, "0")}-${year}`
    }
    return `001-${year}`
  }

  async function openNew() {
    const suggested = await suggestInvoiceNumber()
    const f: InvoiceForm = {
      ...BLANK_FORM,
      invoice_number: suggested,
      invoice_date: todayISO(),
      from_name: company?.business_name ?? "",
      from_vat: company?.vat_number ?? "",
      from_address: company?.billing_address ?? "",
      from_zip: company?.zip_code ?? "",
      from_country: company?.country ?? "",
      from_phone: company?.phone ?? "",
      from_email: company?.email ?? "",
    }
    setForm(f)
    setEditingId(null)
    setShowShipTo(false)
    setView("builder")
  }

  function openEdit(inv: CreatedInvoice) {
    setForm({
      invoice_number: inv.invoice_number,
      invoice_date: inv.invoice_date,
      direction: inv.direction,
      order_reference: inv.order_reference ?? "",
      from_name: inv.from_name ?? "", from_vat: inv.from_vat ?? "",
      from_address: inv.from_address ?? "", from_zip: inv.from_zip ?? "",
      from_country: inv.from_country ?? "", from_phone: inv.from_phone ?? "",
      from_email: inv.from_email ?? "",
      bill_to_name: inv.bill_to_name ?? "", bill_to_vat: inv.bill_to_vat ?? "",
      bill_to_address: inv.bill_to_address ?? "", bill_to_zip: inv.bill_to_zip ?? "",
      bill_to_country: inv.bill_to_country ?? "",
      ship_to_name: inv.ship_to_name ?? "", ship_to_address: inv.ship_to_address ?? "",
      ship_to_zip: inv.ship_to_zip ?? "", ship_to_country: inv.ship_to_country ?? "",
      line_items: inv.line_items.length > 0 ? inv.line_items : [{ description: "", quantity: 1, unit_price: 0 }],
      shipping_amount: inv.shipping_amount, vat_rate: inv.vat_rate,
      notes: inv.notes ?? "", supplier_id: inv.supplier_id ?? "",
    })
    setShowShipTo(!!(inv.ship_to_name || inv.ship_to_address))
    setEditingId(inv.id)
    setView("builder")
  }

  function fillFromSupplier(supplierId: string) {
    if (!supplierId) {
      setForm(f => ({ ...f, supplier_id: "", bill_to_name: "", bill_to_vat: "", bill_to_address: "", bill_to_zip: "", bill_to_country: "" }))
      return
    }
    const sup = suppliers.find(s => s.id === supplierId)
    if (!sup) return
    setForm(f => ({
      ...f,
      supplier_id: supplierId,
      bill_to_name: sup.business_name,
      bill_to_vat: sup.vat_number ?? "",
      bill_to_address: sup.address ?? "",
      bill_to_zip: sup.zip_code ?? "",
      bill_to_country: sup.country ?? "",
    }))
  }

  function setF<K extends keyof InvoiceForm>(key: K, value: InvoiceForm[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function updateItem(idx: number, field: keyof LineItem, value: string) {
    setForm(f => {
      const items = [...f.line_items]
      items[idx] = { ...items[idx], [field]: field === "description" ? value : Number(value) }
      return { ...f, line_items: items }
    })
  }

  function addItem() {
    setForm(f => ({ ...f, line_items: [...f.line_items, { description: "", quantity: 1, unit_price: 0 }] }))
  }

  function removeItem(idx: number) {
    setForm(f => ({ ...f, line_items: f.line_items.filter((_, i) => i !== idx) }))
  }

  async function saveInvoice(andPrint = false): Promise<string | null> {
    if (!form.invoice_number.trim()) { toast.error("Invoice number is required"); return null }
    setSaving(true)
    const payload = {
      invoice_number: form.invoice_number, invoice_date: form.invoice_date,
      direction: form.direction, order_reference: form.order_reference || null,
      from_name: form.from_name || null, from_vat: form.from_vat || null,
      from_address: form.from_address || null, from_zip: form.from_zip || null,
      from_country: form.from_country || null, from_phone: form.from_phone || null,
      from_email: form.from_email || null,
      bill_to_name: form.bill_to_name || null, bill_to_vat: form.bill_to_vat || null,
      bill_to_address: form.bill_to_address || null, bill_to_zip: form.bill_to_zip || null,
      bill_to_country: form.bill_to_country || null,
      ship_to_name: showShipTo ? (form.ship_to_name || null) : null,
      ship_to_address: showShipTo ? (form.ship_to_address || null) : null,
      ship_to_zip: showShipTo ? (form.ship_to_zip || null) : null,
      ship_to_country: showShipTo ? (form.ship_to_country || null) : null,
      line_items: form.line_items,
      shipping_amount: form.shipping_amount, vat_rate: form.vat_rate,
      notes: form.notes || null,
      supplier_id: form.supplier_id || null,
    }
    const { error } = editingId
      ? await supabase.from("created_invoices").update(payload).eq("id", editingId)
      : await supabase.from("created_invoices").insert(payload)
    setSaving(false)
    if (error) { toast.error(`Save failed: ${error.message}`); return null }
    toast.success(editingId ? "Invoice updated" : "Invoice saved")
    await fetchAll()
    if (andPrint) printInvoice(form)
    return editingId ?? "new"
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    const { error } = await supabase.from("created_invoices").delete().eq("id", id)
    setDeleting(null)
    if (error) { toast.error("Delete failed"); return }
    toast.success("Invoice deleted")
    setInvoices(prev => prev.filter(i => i.id !== id))
    if (editingId === id) { setView("list"); setEditingId(null) }
  }

  // Totals
  const { subtotalBase, ivaAmount, total } = calcTotals(form.line_items, form.shipping_amount, form.vat_rate)

  const inputCls = "w-full h-8 px-2.5 text-[13px] rounded-md border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring/50"

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-muted-foreground text-[13px]">
      <Loader2 className="size-4 animate-spin mr-2" /> Loading…
    </div>
  )

  // ── List view ──
  if (view === "list") return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[18px] font-semibold">Invoices</h1>
        <Button size="sm" onClick={openNew}>
          <Plus className="size-3.5 mr-1" /> New invoice
        </Button>
      </div>

      {invoices.length === 0 ? (
        <div className="bg-card rounded-xl shadow-sm flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <FileText className="size-10 opacity-25" />
          <p className="text-[13px] font-medium text-foreground">No invoices yet</p>
          <p className="text-[12px]">Create your first invoice to get started</p>
          <Button size="sm" onClick={openNew}><Plus className="size-3.5 mr-1" /> New invoice</Button>
        </div>
      ) : (
        <div className="bg-card rounded-xl shadow-sm overflow-hidden">
          <div className="hidden md:grid px-5 h-9 border-b border-border text-[11px] font-medium text-muted-foreground uppercase tracking-wide items-center gap-4"
            style={{ gridTemplateColumns: "120px 90px 90px 1fr 100px 80px" }}>
            <div>Number</div><div>Date</div><div>Type</div><div>Recipient</div><div className="text-right">Total</div><div />
          </div>
          <div className="divide-y divide-border/60">
            {invoices.map(inv => {
              const items = inv.line_items as LineItem[]
              const { total: t } = calcTotals(items, inv.shipping_amount, inv.vat_rate)
              return (
                <div key={inv.id} className="group px-5 flex md:grid items-center gap-4 h-[52px] hover:bg-accent/40 cursor-pointer transition-colors"
                  style={{ gridTemplateColumns: "120px 90px 90px 1fr 100px 80px" }}
                  onClick={() => openEdit(inv)}>
                  <span className="text-[13px] font-medium truncate">{inv.invoice_number}</span>
                  <span className="text-[12px] text-muted-foreground hidden md:block">{formatDate(inv.invoice_date)}</span>
                  <span className={`hidden md:inline-flex text-[11px] font-medium px-1.5 py-0.5 rounded ${inv.direction === "outgoing" ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"}`}>
                    {inv.direction === "outgoing" ? "Outgoing" : "Incoming"}
                  </span>
                  <span className="text-[13px] text-muted-foreground truncate hidden md:block">{inv.bill_to_name ?? "—"}</span>
                  <span className="text-[13px] font-medium tabular-nums text-right hidden md:block">{money(t)}</span>
                  <div className="flex items-center gap-1 ml-auto md:ml-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={e => { e.stopPropagation(); printInvoice({ ...inv, line_items: inv.line_items as LineItem[] } as InvoiceForm) }}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Download PDF">
                      <Download className="size-3.5" />
                    </button>
                    <button onClick={e => { e.stopPropagation(); handleDelete(inv.id) }}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive" title="Delete">
                      {deleting === inv.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )

  // ── Builder view ──
  return (
    <div className="max-w-6xl">
      {/* Builder header */}
      <div className="flex items-center justify-between mb-5 gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setView("list")} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="size-4" />
          </button>
          <h1 className="text-[16px] font-semibold">
            {editingId ? `Edit invoice ${form.invoice_number}` : "New invoice"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setView("list")} className="h-8 text-xs">Cancel</Button>
          <Button variant="outline" size="sm" onClick={() => saveInvoice(false)} disabled={saving} className="h-8 text-xs">
            {saving ? <Loader2 className="size-3 animate-spin mr-1" /> : <Check className="size-3 mr-1" />}
            Save
          </Button>
          <Button size="sm" onClick={() => saveInvoice(true)} disabled={saving} className="h-8 text-xs">
            <Download className="size-3 mr-1" /> Save & Download
          </Button>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* ── Form ── */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* Meta */}
          <Section title="Invoice details">
            <div className="grid grid-cols-2 gap-3">
              <F label="Invoice number" value={form.invoice_number} onChange={v => setF("invoice_number", v)} placeholder="001-2026" />
              <F label="Date" value={form.invoice_date} onChange={v => setF("invoice_date", v)} type="date" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="Order reference" value={form.order_reference} onChange={v => setF("order_reference", v)} placeholder="Optional" />
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Direction</label>
                <div className="flex rounded-md overflow-hidden border border-border h-8">
                  {(["outgoing", "incoming"] as const).map(d => (
                    <button key={d} onClick={() => setF("direction", d)}
                      className={`flex-1 text-[12px] font-medium transition-colors ${form.direction === d ? "bg-foreground text-background" : "bg-card text-muted-foreground hover:bg-muted"}`}>
                      {d === "outgoing" ? "Outgoing" : "Incoming"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* From */}
          <Section title="De (from)">
            <div className="grid grid-cols-2 gap-3">
              <F label="Business name" value={form.from_name} onChange={v => setF("from_name", v)} />
              <F label="NIF / VAT" value={form.from_vat} onChange={v => setF("from_vat", v)} />
              <F label="Address" value={form.from_address} onChange={v => setF("from_address", v)} className="col-span-2" />
              <F label="Zip code" value={form.from_zip} onChange={v => setF("from_zip", v)} />
              <F label="Country" value={form.from_country} onChange={v => setF("from_country", v)} />
              <F label="Phone" value={form.from_phone} onChange={v => setF("from_phone", v)} />
              <F label="Email" value={form.from_email} onChange={v => setF("from_email", v)} type="email" />
            </div>
          </Section>

          {/* Bill to */}
          <Section title="Facturar a (bill to)">
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">From suppliers list</label>
              <select
                value={form.supplier_id}
                onChange={e => fillFromSupplier(e.target.value)}
                className={inputCls}
              >
                <option value="">Manual entry</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.business_name}{s.country ? ` — ${s.country}` : ""}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="Name" value={form.bill_to_name} onChange={v => setF("bill_to_name", v)} />
              <F label="NIF / VAT" value={form.bill_to_vat} onChange={v => setF("bill_to_vat", v)} />
              <F label="Address" value={form.bill_to_address} onChange={v => setF("bill_to_address", v)} className="col-span-2" />
              <F label="Zip code" value={form.bill_to_zip} onChange={v => setF("bill_to_zip", v)} />
              <F label="Country" value={form.bill_to_country} onChange={v => setF("bill_to_country", v)} />
            </div>
          </Section>

          {/* Ship to */}
          <Section title="Enviar a (ship to)">
            {!showShipTo ? (
              <button onClick={() => setShowShipTo(true)} className="text-[12px] text-primary hover:underline">+ Add shipping address</button>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <F label="Name" value={form.ship_to_name} onChange={v => setF("ship_to_name", v)} />
                  <F label="Address" value={form.ship_to_address} onChange={v => setF("ship_to_address", v)} />
                  <F label="Zip code" value={form.ship_to_zip} onChange={v => setF("ship_to_zip", v)} />
                  <F label="Country" value={form.ship_to_country} onChange={v => setF("ship_to_country", v)} />
                </div>
                <button onClick={() => setShowShipTo(false)} className="text-[12px] text-muted-foreground hover:text-destructive">Remove shipping address</button>
              </div>
            )}
          </Section>

          {/* Line items */}
          <Section title="Line items">
            <div className="space-y-2">
              {/* Header */}
              <div className="hidden md:grid text-[10px] font-medium text-muted-foreground uppercase tracking-wide gap-2 px-1"
                style={{ gridTemplateColumns: "1fr 56px 80px 70px 28px" }}>
                <div>Description</div><div className="text-right">Qty</div>
                <div className="text-right">Unit price</div><div className="text-right">Total</div><div />
              </div>
              {form.line_items.map((item, idx) => (
                <div key={idx} className="grid gap-2 items-center" style={{ gridTemplateColumns: "1fr 56px 80px 70px 28px" }}>
                  <input
                    value={item.description}
                    onChange={e => updateItem(idx, "description", e.target.value)}
                    placeholder="Item description"
                    className={inputCls}
                  />
                  <input
                    type="number" min="1" value={item.quantity}
                    onChange={e => updateItem(idx, "quantity", e.target.value)}
                    className={inputCls + " text-right"}
                  />
                  <input
                    type="number" min="0" step="0.01" value={item.unit_price}
                    onChange={e => updateItem(idx, "unit_price", e.target.value)}
                    className={inputCls + " text-right"}
                  />
                  <span className="text-[12px] text-muted-foreground text-right tabular-nums">{money(lineTotal(item))}</span>
                  <button onClick={() => removeItem(idx)} disabled={form.line_items.length === 1}
                    className="flex items-center justify-center size-7 rounded hover:bg-muted text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors">
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              <button onClick={addItem} className="text-[12px] text-primary hover:underline mt-1">+ Add line</button>
            </div>
          </Section>

          {/* Totals config */}
          <Section title="Totals">
            <div className="grid grid-cols-2 gap-3">
              <F label="Shipping (€)" value={form.shipping_amount} onChange={v => setF("shipping_amount", Number(v))} type="number" placeholder="0" />
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">IVA rate</label>
                <select value={form.vat_rate} onChange={e => setF("vat_rate", Number(e.target.value))} className={inputCls}>
                  <option value={0}>0% (sin IVA)</option>
                  <option value={4}>4%</option>
                  <option value={10}>10%</option>
                  <option value={21}>21%</option>
                </select>
              </div>
            </div>
            {/* Summary */}
            <div className="rounded-lg bg-muted/40 px-4 py-3 space-y-1.5 text-[13px]">
              {form.shipping_amount > 0 && (
                <div className="flex justify-between text-muted-foreground"><span>Envío</span><span>{money(form.shipping_amount)}</span></div>
              )}
              {form.vat_rate > 0 && (
                <>
                  <div className="flex justify-between text-muted-foreground"><span>Subtotal sin IVA</span><span>{money(subtotalBase)}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>IVA {form.vat_rate}%</span><span>{money(ivaAmount)}</span></div>
                </>
              )}
              <div className="flex justify-between font-semibold border-t border-border pt-1.5"><span>Total</span><span>{money(total)}</span></div>
            </div>
          </Section>

          {/* Notes */}
          <Section title="Notes">
            <textarea
              value={form.notes}
              onChange={e => setF("notes", e.target.value)}
              placeholder="Optional notes or payment instructions…"
              rows={3}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-[13px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none placeholder:text-muted-foreground/60"
            />
          </Section>
        </div>

        {/* ── Live preview ── */}
        <div className="hidden lg:block w-[400px] shrink-0 sticky top-6">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Preview</p>
          <div className="bg-white rounded-xl shadow-md border border-border/40 overflow-auto max-h-[calc(100vh-120px)]">
            <div
              ref={previewRef}
              className="p-6 text-[11px] leading-relaxed"
              dangerouslySetInnerHTML={{ __html: buildInvoiceHtml(form) }}
              style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif", color: "#111" }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
