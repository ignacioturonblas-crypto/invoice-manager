"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  Plus, Search, Copy, Pencil, Trash2, ChevronDown, ChevronUp,
  Building2, X, Check, Loader2, Package
} from "lucide-react"
import type { Supplier, MyCompany, Snippet, SupplierOrderStats } from "@/lib/types"
import { useRouter } from "next/navigation"

// ─── helpers ────────────────────────────────────────────────────────────────

function formatSupplierForCopy(s: Supplier): string {
  const lines: string[] = []
  lines.push(`Business Name: ${s.business_name}`)
  if (s.product_type)     lines.push(`Product Type: ${s.product_type}`)
  if (s.vat_number)       lines.push(`VAT/Business ID: ${s.vat_number}`)
  if (s.address)          lines.push(`Address: ${s.address}`)
  if (s.shipping_address) lines.push(`Shipping Address: ${s.shipping_address}`)
  if (s.zip_code)         lines.push(`Zip Code: ${s.zip_code}`)
  if (s.country)          lines.push(`Country: ${s.country}`)
  if (s.contact_person)   lines.push(`Contact Person: ${s.contact_person}`)
  if (s.phone)            lines.push(`Phone: ${s.phone}`)
  return lines.join("\n")
}

function formatCompanyForCopy(c: MyCompany): string {
  const lines: string[] = []
  if (c.business_name)    lines.push(`Business Name: ${c.business_name}`)
  if (c.vat_number)       lines.push(`VAT/Business ID: ${c.vat_number}`)
  if (c.billing_address)  lines.push(`Billing Address: ${c.billing_address}`)
  if (c.shipping_address) lines.push(`Shipping Address: ${c.shipping_address}`)
  if (c.zip_code)         lines.push(`Zip Code: ${c.zip_code}`)
  if (c.country)          lines.push(`Country: ${c.country}`)
  if (c.contact_person)   lines.push(`Contact Person: ${c.contact_person}`)
  if (c.phone)            lines.push(`Phone: ${c.phone}`)
  if (c.email)            lines.push(`Email: ${c.email}`)
  return lines.join("\n")
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text)
}

// ─── blank forms ─────────────────────────────────────────────────────────────

type SupplierFormData = {
  business_name: string
  vat_number: string
  address: string
  shipping_address: string
  zip_code: string
  country: string
  contact_person: string
  phone: string
  notes: string
  product_type: string
}

type CompanyFormData = {
  business_name: string
  vat_number: string
  billing_address: string
  shipping_address: string
  zip_code: string
  country: string
  contact_person: string
  phone: string
  email: string
}

const BLANK_SUPPLIER: SupplierFormData = {
  business_name: "",
  vat_number: "",
  address: "",
  shipping_address: "",
  zip_code: "",
  country: "",
  contact_person: "",
  phone: "",
  notes: "",
  product_type: "",
}

const BLANK_COMPANY: CompanyFormData = {
  business_name: "",
  vat_number: "",
  billing_address: "",
  shipping_address: "",
  zip_code: "",
  country: "",
  contact_person: "",
  phone: "",
  email: "",
}

// ─── field helper ─────────────────────────────────────────────────────────────

interface FieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
}

function Field({ label, value, onChange, placeholder, required }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? label}
        className="h-8 text-sm"
      />
    </div>
  )
}

// ─── My Company Panel ─────────────────────────────────────────────────────────

function MyCompanyPanel() {
  const supabase = createClient()
  const [company, setCompany] = useState<MyCompany | null>(null)
  const [form, setForm] = useState<CompanyFormData>(BLANK_COMPANY)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchCompany = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from("my_company")
      .select("*")
      .maybeSingle()
    setCompany(data ?? null)
    if (data) {
      setForm({
        business_name: data.business_name ?? "",
        vat_number: data.vat_number ?? "",
        billing_address: data.billing_address ?? "",
        shipping_address: data.shipping_address ?? "",
        zip_code: data.zip_code ?? "",
        country: data.country ?? "",
        contact_person: data.contact_person ?? "",
        phone: data.phone ?? "",
        email: data.email ?? "",
      })
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchCompany() }, [fetchCompany])

  async function save() {
    setSaving(true)
    const payload = {
      business_name: form.business_name || null,
      vat_number: form.vat_number || null,
      billing_address: form.billing_address || null,
      shipping_address: form.shipping_address || null,
      zip_code: form.zip_code || null,
      country: form.country || null,
      contact_person: form.contact_person || null,
      phone: form.phone || null,
      email: form.email || null,
    }

    const { error } = company
      ? await supabase.from("my_company").update(payload).eq("id", company.id)
      : await supabase.from("my_company").insert(payload)

    if (error) {
      toast.error("Failed to save company info")
    } else {
      toast.success("Company info saved")
      setOpen(false)
      await fetchCompany()
    }
    setSaving(false)
  }

  async function handleCopy() {
    if (!company) return
    await copyText(formatCompanyForCopy(company))
    setCopied(true)
    toast.success("Company info copied")
    setTimeout(() => setCopied(false), 2000)
  }

  const f = (key: keyof CompanyFormData) => ({
    value: form[key],
    onChange: (v: string) => setForm(prev => ({ ...prev, [key]: v })),
  })

  const isEmpty = !company?.business_name

  return (
    <Card className="border-border/60">
      <CardHeader className="px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="size-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="size-3.5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-[13px] font-semibold">My Company</CardTitle>
              {!loading && company?.business_name && (
                <p className="text-[11px] text-muted-foreground leading-none mt-0.5">{company.business_name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isEmpty && (
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={handleCopy}>
                {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setOpen(v => !v)}
            >
              <Pencil className="size-3" />
              Edit
              {open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Summary when collapsed */}
      {!open && !isEmpty && (
        <CardContent className="px-5 pb-4 pt-0">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[12px]">
            {company?.vat_number && (
              <span className="text-muted-foreground">VAT: <span className="text-foreground">{company.vat_number}</span></span>
            )}
            {company?.country && (
              <span className="text-muted-foreground">Country: <span className="text-foreground">{company.country}</span></span>
            )}
            {company?.contact_person && (
              <span className="text-muted-foreground">Contact: <span className="text-foreground">{company.contact_person}</span></span>
            )}
            {company?.phone && (
              <span className="text-muted-foreground">Phone: <span className="text-foreground">{company.phone}</span></span>
            )}
            {company?.email && (
              <span className="text-muted-foreground">Email: <span className="text-foreground">{company.email}</span></span>
            )}
          </div>
        </CardContent>
      )}

      {!open && isEmpty && !loading && (
        <CardContent className="px-5 pb-4 pt-0">
          <p className="text-[12px] text-muted-foreground">No company info yet — click Edit to add your details.</p>
        </CardContent>
      )}

      {/* Edit form */}
      {open && (
        <CardContent className="px-5 pb-5 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Business Name" {...f("business_name")} />
            <Field label="Business ID / VAT Number" {...f("vat_number")} />
            <Field label="Billing Address" {...f("billing_address")} />
            <Field label="Shipping Address" {...f("shipping_address")} />
            <Field label="Zip Code" {...f("zip_code")} />
            <Field label="Country" {...f("country")} />
            <Field label="Person of Contact" {...f("contact_person")} />
            <Field label="Phone Number" {...f("phone")} />
            <Field label="Email" {...f("email")} />
          </div>
          <div className="flex justify-end mt-4">
            <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
              Save
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

// ─── Snippets Panel ───────────────────────────────────────────────────────────

function SnippetsPanel() {
  const supabase = createClient()
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Snippet | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Snippet | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [form, setForm] = useState({ title: "", content: "" })

  const fetchSnippets = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from("snippets").select("*").order("created_at", { ascending: true })
    setSnippets(data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchSnippets() }, [fetchSnippets])

  function openAdd() {
    setForm({ title: "", content: "" })
    setAddOpen(true)
  }

  function openEdit(s: Snippet) {
    setForm({ title: s.title, content: s.content })
    setEditTarget(s)
  }

  async function handleSave() {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("Title and content are required")
      return
    }
    setSaving(true)
    const { error } = editTarget
      ? await supabase.from("snippets").update({ title: form.title, content: form.content }).eq("id", editTarget.id)
      : await supabase.from("snippets").insert({ title: form.title, content: form.content })
    if (error) {
      toast.error("Failed to save snippet")
    } else {
      toast.success(editTarget ? "Snippet updated" : "Snippet added")
      setAddOpen(false)
      setEditTarget(null)
      await fetchSnippets()
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await supabase.from("snippets").delete().eq("id", deleteTarget.id)
    if (error) {
      toast.error("Failed to delete snippet")
    } else {
      toast.success("Snippet deleted")
      setDeleteTarget(null)
      await fetchSnippets()
    }
    setDeleting(false)
  }

  async function handleCopy(s: Snippet) {
    await navigator.clipboard.writeText(s.content)
    setCopiedId(s.id)
    toast.success(`"${s.title}" copied`)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const dialogOpen = addOpen || !!editTarget

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-semibold">Quick Copy</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Reusable snippets — invoicing instructions, shipping notes, etc.</p>
        </div>
        <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={openAdd}>
          <Plus className="size-3.5" />
          Add snippet
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="size-4 animate-spin mr-2" />
          <span className="text-sm">Loading…</span>
        </div>
      ) : snippets.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
            <Copy className="size-7 opacity-25" />
            <p className="text-sm">No snippets yet — add your first one</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {snippets.map(s => (
            <Card key={s.id} className="border-border/60 group">
              <CardContent className="px-4 py-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-semibold leading-snug">{s.title}</p>
                  <div className="flex items-center gap-1 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 sm:transition-opacity">
                    <Button variant="ghost" size="icon" className="size-6" onClick={() => openEdit(s)} title="Edit">
                      <Pencil className="size-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-6 hover:text-destructive" onClick={() => setDeleteTarget(s)} title="Delete">
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-[12px] text-muted-foreground leading-relaxed whitespace-pre-wrap line-clamp-4">{s.content}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs w-full mt-1"
                  onClick={() => handleCopy(s)}
                >
                  {copiedId === s.id ? <Check className="size-3 text-green-500" /> : <Copy className="size-3" />}
                  {copiedId === s.id ? "Copied!" : "Copy"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setAddOpen(false); setEditTarget(null) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit snippet" : "Add snippet"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Invoicing instructions"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Content</Label>
              <textarea
                value={form.content}
                onChange={(e) => setForm(p => ({ ...p, content: e.target.value }))}
                placeholder="Paste your invoicing instructions, shipping notes, etc."
                rows={6}
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-[13px] leading-relaxed transition-colors outline-none placeholder:text-muted-foreground/60 focus-visible:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring/25 resize-y"
              />
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setAddOpen(false); setEditTarget(null) }}>
              Cancel
            </Button>
            <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
              {editTarget ? "Save changes" : "Add snippet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete snippet?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">"{deleteTarget?.title}"</span>?
              {" "}This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Supplier Form ────────────────────────────────────────────────────────────

interface SupplierFormProps {
  initial?: Supplier | null
  onSave: (data: SupplierFormData) => Promise<void>
  onCancel: () => void
  saving: boolean
}

function SupplierForm({ initial, onSave, onCancel, saving }: SupplierFormProps) {
  const [form, setForm] = useState<SupplierFormData>(
    initial
      ? {
          business_name: initial.business_name,
          vat_number: initial.vat_number ?? "",
          address: initial.address ?? "",
          shipping_address: initial.shipping_address ?? "",
          zip_code: initial.zip_code ?? "",
          country: initial.country ?? "",
          contact_person: initial.contact_person ?? "",
          phone: initial.phone ?? "",
          notes: initial.notes ?? "",
          product_type: initial.product_type ?? "",
        }
      : { ...BLANK_SUPPLIER }
  )

  const f = (key: keyof SupplierFormData) => ({
    value: form[key],
    onChange: (v: string) => setForm(prev => ({ ...prev, [key]: v })),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.business_name.trim()) {
      toast.error("Business name is required")
      return
    }
    onSave(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Business Name" {...f("business_name")} required />
        <Field label="Product Type" {...f("product_type")} placeholder="e.g. Footwear, Packaging, Fabric" />
        <Field label="Business ID / VAT Number" {...f("vat_number")} />
        <Field label="Address" {...f("address")} />
        <Field label="Shipping Address" {...f("shipping_address")} />
        <Field label="Zip Code" {...f("zip_code")} />
        <Field label="Country" {...f("country")} />
        <Field label="Person of Contact" {...f("contact_person")} />
        <Field label="Phone Number" {...f("phone")} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Notes</Label>
        <Input
          value={form.notes}
          onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
          placeholder="Optional notes"
          className="h-8 text-sm"
        />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" className="gap-1.5 h-8 text-xs" disabled={saving}>
          {saving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
          {initial ? "Save changes" : "Add supplier"}
        </Button>
      </div>
    </form>
  )
}

// ─── Supplier Row ─────────────────────────────────────────────────────────────

interface SupplierRowProps {
  supplier: Supplier
  stats?: SupplierOrderStats
  onEdit: (s: Supplier) => void
  onDelete: (s: Supplier) => void
}

function SupplierRow({ supplier, stats, onEdit, onDelete }: SupplierRowProps) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await copyText(formatSupplierForCopy(supplier))
    setCopied(true)
    toast.success(`${supplier.business_name} copied to clipboard`)
    setTimeout(() => setCopied(false), 2000)
  }

  const activeCount = stats?.active_count ?? 0
  const hasStats = (stats?.delivered_count ?? 0) > 0
  const onTimePct = hasStats && stats!.delivered_count > 0
    ? Math.round((stats!.on_time_count / stats!.delivered_count) * 100)
    : null

  return (
    <div className="group flex items-center gap-3 px-4 py-3 border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors">
      <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <span className="text-[11px] font-bold text-primary">
          {supplier.business_name[0]?.toUpperCase() ?? "?"}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-medium truncate">{supplier.business_name}</p>
          {activeCount > 0 && (
            <button
              onClick={() => router.push(`/orders?supplier=${supplier.id}`)}
              className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors tabular-nums"
              title="View active orders"
            >
              {activeCount} active
            </button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground truncate">
          {[supplier.vat_number, supplier.country, supplier.contact_person].filter(Boolean).join(" · ")}
        </p>
        {hasStats && (
          <p className="text-[10px] text-muted-foreground/70 mt-0.5">
            Avg lead time: {stats!.avg_lead_days !== null ? `${Math.round(stats!.avg_lead_days)}d` : "—"}
            {onTimePct !== null && ` · On time: ${onTimePct}%`}
            {` · ${stats!.delivered_count} order${stats!.delivered_count !== 1 ? "s" : ""} delivered`}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 ml-auto shrink-0">
        {supplier.product_type && (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {supplier.product_type}
          </span>
        )}
        <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 sm:transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => router.push(`/orders?supplier=${supplier.id}&add=1`)}
          title="Add order for this supplier"
        >
          <Package className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={handleCopy}
          title="Copy billing info"
        >
          {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => onEdit(supplier)}
          title="Edit supplier"
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 hover:text-destructive"
          onClick={() => onDelete(supplier)}
          title="Delete supplier"
        >
          <Trash2 className="size-3.5" />
        </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SuppliersPage() {
  const supabase = createClient()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [orderStats, setOrderStats] = useState<Map<string, SupplierOrderStats>>(new Map())

  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Supplier | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchSuppliers = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .order("business_name", { ascending: true })
    if (!error) setSuppliers(data ?? [])
    setLoading(false)
  }, [supabase])

  const fetchOrderStats = useCallback(async () => {
    const { data } = await supabase
      .from("orders")
      .select("supplier_id, status, order_date, actual_date, expected_date")
    if (!data) return
    const map = new Map<string, SupplierOrderStats>()
    for (const row of data) {
      const s = map.get(row.supplier_id) ?? {
        supplier_id: row.supplier_id,
        active_count: 0,
        delivered_count: 0,
        avg_lead_days: null,
        on_time_count: 0,
      }
      const isActive = row.status !== "delivered" && row.status !== "cancelled"
      if (isActive) s.active_count++
      if (row.status === "delivered") {
        s.delivered_count++
        if (row.actual_date && row.order_date) {
          const leadDays = (new Date(row.actual_date).getTime() - new Date(row.order_date).getTime()) / 86400000
          s.avg_lead_days = s.avg_lead_days === null
            ? leadDays
            : (s.avg_lead_days * (s.delivered_count - 1) + leadDays) / s.delivered_count
        }
        if (row.actual_date && row.expected_date && row.actual_date <= row.expected_date) {
          s.on_time_count++
        }
      }
      map.set(row.supplier_id, s)
    }
    setOrderStats(map)
  }, [supabase])

  useEffect(() => {
    fetchSuppliers()
    fetchOrderStats()
  }, [fetchSuppliers, fetchOrderStats])

  const filtered = suppliers.filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      s.business_name.toLowerCase().includes(q) ||
      (s.vat_number ?? "").toLowerCase().includes(q) ||
      (s.contact_person ?? "").toLowerCase().includes(q) ||
      (s.country ?? "").toLowerCase().includes(q)
    )
  })

  async function handleAdd(data: SupplierFormData) {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from("suppliers").insert({
      created_by: user?.id ?? null,
      business_name: data.business_name,
      vat_number: data.vat_number || null,
      address: data.address || null,
      shipping_address: data.shipping_address || null,
      zip_code: data.zip_code || null,
      country: data.country || null,
      contact_person: data.contact_person || null,
      phone: data.phone || null,
      notes: data.notes || null,
      product_type: data.product_type || null,
    })
    if (error) {
      toast.error(`Failed to add supplier: ${error.message}`)
    } else {
      toast.success("Supplier added")
      setAddOpen(false)
      await fetchSuppliers()
    }
    setSaving(false)
  }

  async function handleEdit(data: SupplierFormData) {
    if (!editTarget) return
    setSaving(true)
    const { error } = await supabase.from("suppliers").update({
      business_name: data.business_name,
      vat_number: data.vat_number || null,
      address: data.address || null,
      shipping_address: data.shipping_address || null,
      zip_code: data.zip_code || null,
      country: data.country || null,
      contact_person: data.contact_person || null,
      phone: data.phone || null,
      notes: data.notes || null,
      product_type: data.product_type || null,
    }).eq("id", editTarget.id)
    if (error) {
      toast.error("Failed to update supplier")
    } else {
      toast.success("Supplier updated")
      setEditTarget(null)
      await fetchSuppliers()
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await supabase.from("suppliers").delete().eq("id", deleteTarget.id)
    if (error) {
      toast.error("Failed to delete supplier")
    } else {
      toast.success("Supplier deleted")
      setDeleteTarget(null)
      await fetchSuppliers()
    }
    setDeleting(false)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* My Company */}
      <MyCompanyPanel />

      {/* Quick Copy snippets */}
      <SnippetsPanel />

      {/* Suppliers list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[14px] font-semibold">Suppliers</h2>
          <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setAddOpen(true)}>
            <Plus className="size-3.5" />
            Add supplier
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search suppliers…"
            className="pl-8 h-8 text-sm"
          />
          {search && (
            <button
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearch("")}
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* List */}
        <Card className="border-border/60 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="size-4 animate-spin mr-2" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <Building2 className="size-8 opacity-30" />
              <p className="text-sm">
                {search ? "No suppliers match your search" : "No suppliers yet — add your first one"}
              </p>
            </div>
          ) : (
            <div>
              {filtered.map(s => (
                <SupplierRow
                  key={s.id}
                  supplier={s}
                  stats={orderStats.get(s.id)}
                  onEdit={(s) => setEditTarget(s)}
                  onDelete={(s) => setDeleteTarget(s)}
                />
              ))}
            </div>
          )}
        </Card>

        {!loading && filtered.length > 0 && (
          <p className="text-[11px] text-muted-foreground text-right">
            {filtered.length} supplier{filtered.length !== 1 ? "s" : ""}
            {search && ` matching "${search}"`}
          </p>
        )}
      </div>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add supplier</DialogTitle>
          </DialogHeader>
          <SupplierForm
            initial={null}
            onSave={handleAdd}
            onCancel={() => setAddOpen(false)}
            saving={saving}
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit supplier</DialogTitle>
          </DialogHeader>
          <SupplierForm
            initial={editTarget}
            onSave={handleEdit}
            onCancel={() => setEditTarget(null)}
            saving={saving}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete supplier?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">{deleteTarget?.business_name}</span>?
              {" "}This cannot be undone.
              {deleteTarget && (orderStats.get(deleteTarget.id)?.active_count ?? 0) > 0 && (
                <span className="block mt-2 text-amber-600 font-medium">
                  ⚠ This supplier has {orderStats.get(deleteTarget.id)!.active_count} active order{orderStats.get(deleteTarget.id)!.active_count !== 1 ? "s" : ""} that will also be deleted.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
