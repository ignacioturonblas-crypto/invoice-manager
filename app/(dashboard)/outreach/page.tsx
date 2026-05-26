"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Contact,
  ContactCategory,
  ContactStatus,
  Campaign,
  CampaignStatus,
  OutreachSearch,
} from "@/lib/types";
import { toast } from "sonner";
import {
  Search,
  Globe,
  Phone,
  Mail,
  Plus,
  Send,
  X,
  ChevronRight,
  MapPin,
  Star,
  ExternalLink,
  Check,
  AlertCircle,
  Building2,
  Store,
  Palette,
  HardHat,
  Hotel,
  Home,
  MoreHorizontal,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
} from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<ContactCategory | string, string> = {
  interior_studio: "Interior Studio",
  retailer: "Retailer",
  wholesale: "Wholesale",
  gallery: "Gallery",
  architect: "Architect",
  hospitality: "Hospitality",
  staging: "Staging",
  other: "Other",
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  interior_studio: <Palette size={13} />,
  retailer: <Store size={13} />,
  wholesale: <Store size={13} />,
  gallery: <Building2 size={13} />,
  architect: <HardHat size={13} />,
  hospitality: <Hotel size={13} />,
  staging: <Home size={13} />,
  other: <MoreHorizontal size={13} />,
};

const STATUS_STYLES: Record<ContactStatus | string, string> = {
  new: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  contacted: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  replied: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  client: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  rejected: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
  unsubscribed: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
};

const ALL_STATUSES: ContactStatus[] = ["new", "contacted", "replied", "client", "rejected", "unsubscribed"];
const ALL_CATEGORIES: ContactCategory[] = [
  "interior_studio", "retailer", "wholesale", "gallery", "architect", "hospitality", "staging", "other",
];

const BLANK_CAMPAIGN: Omit<Campaign, "id" | "created_at" | "sent_count"> = {
  name: "",
  subject: "",
  body: "",
  category: null,
  wholesale_link: null,
  calendly_link: null,
  status: "draft",
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OutreachPage() {
  const [tab, setTab] = useState<"contacts" | "campaigns" | "searches">("contacts");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border px-6 pt-6 pb-0">
        <h1 className="text-xl font-semibold mb-4">Outreach</h1>
        <div className="flex gap-1">
          {(["contacts", "campaigns", "searches"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors capitalize ${
                tab === t
                  ? "bg-background text-foreground border border-border border-b-background -mb-px"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {tab === "contacts" && <ContactsTab onSwitchToSearch={() => setTab("searches")} />}
        {tab === "campaigns" && <CampaignsTab />}
        {tab === "searches" && <SearchesTab onImported={() => setTab("contacts")} />}
      </div>
    </div>
  );
}

// ─── Contacts Tab ─────────────────────────────────────────────────────────────

function ContactsTab({ onSwitchToSearch }: { onSwitchToSearch: () => void }) {
  const supabase = createClient();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCity, setFilterCity] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailContact, setDetailContact] = useState<Contact | null>(null);
  const [showCampaignPicker, setShowCampaignPicker] = useState(false);
  const [scraping, setScraping] = useState(false);

  const scrapeEmails = async () => {
    setScraping(true);
    try {
      const res = await fetch("/api/scrape-emails", { method: "POST" });
      const data = await res.json();
      toast.success(`Found ${data.summary.found} emails out of ${data.summary.total} contacts without email`);
      fetchContacts();
    } finally {
      setScraping(false);
    }
  };

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("contacts").select("*").order("created_at", { ascending: false });
    const { data, error } = await query;
    if (!error) setContacts(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const cities = Array.from(new Set(contacts.map((c) => c.city).filter(Boolean) as string[])).sort();

  const filtered = contacts.filter((c) => {
    if (filterCategory !== "all" && c.category !== filterCategory) return false;
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    if (filterCity !== "all" && c.city !== filterCity) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.website ?? "").toLowerCase().includes(q) ||
      (c.city ?? "").toLowerCase().includes(q)
    );
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c) => c.id)));
    }
  };

  const updateStatus = async (id: string, status: ContactStatus) => {
    const { error } = await supabase.from("contacts").update({ status }).eq("id", id);
    if (error) { toast.error("Failed to update status"); return; }
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    if (detailContact?.id === id) setDetailContact((prev) => prev ? { ...prev, status } : null);
    toast.success("Status updated");
  };

  const updateNotes = async (id: string, notes: string) => {
    const { error } = await supabase.from("contacts").update({ notes }).eq("id", id);
    if (error) { toast.error("Failed to save notes"); return; }
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, notes } : c)));
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap gap-2 px-6 py-3 border-b border-border items-center">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts..."
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="text-sm border border-border rounded-md px-2 py-1.5 bg-background focus:outline-none"
          >
            <option value="all">All categories</option>
            {ALL_CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-sm border border-border rounded-md px-2 py-1.5 bg-background focus:outline-none"
          >
            <option value="all">All statuses</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>

          {cities.length > 0 && (
            <select
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              className="text-sm border border-border rounded-md px-2 py-1.5 bg-background focus:outline-none"
            >
              <option value="all">All cities</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}

          <div className="ml-auto flex gap-2">
            {selected.size > 0 && (
              <button
                onClick={() => setShowCampaignPicker(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                <Send size={13} />
                Add to campaign ({selected.size})
              </button>
            )}
            <button
              onClick={onSwitchToSearch}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted"
            >
              <Plus size={13} />
              Import
            </button>
            <button
              onClick={scrapeEmails}
              disabled={scraping}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted disabled:opacity-50"
              title="Find emails for contacts that have a website but no email"
            >
              {scraping ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
              {scraping ? "Scraping..." : "Find emails"}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <Loader2 size={20} className="animate-spin mr-2" /> Loading contacts...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <Building2 size={40} strokeWidth={1} />
              <p className="text-sm">No contacts found.</p>
              <button onClick={onSwitchToSearch} className="text-sm text-primary hover:underline">
                Import from Google Places →
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/50 backdrop-blur border-b border-border">
                <tr>
                  <th className="w-10 px-4 py-2">
                    <input
                      type="checkbox"
                      checked={selected.size === filtered.length && filtered.length > 0}
                      onChange={toggleAll}
                      className="rounded"
                    />
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden md:table-cell">Category</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden lg:table-cell">City</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden lg:table-cell">Phone</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Email</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
                  <th className="w-8 px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((contact) => (
                  <tr
                    key={contact.id}
                    className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => setDetailContact(contact)}
                  >
                    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(contact.id)}
                        onChange={() => toggleSelect(contact.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium leading-tight">{contact.name}</div>
                      {contact.website && (
                        <a
                          href={contact.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-0.5 mt-0.5 w-fit"
                        >
                          <Globe size={10} />
                          {contact.website.replace(/https?:\/\/(www\.)?/, "").split("/")[0]}
                        </a>
                      )}
                    </td>
                    <td className="px-3 py-2.5 hidden md:table-cell">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        {CATEGORY_ICONS[contact.category]}
                        {CATEGORY_LABELS[contact.category] ?? contact.category}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground hidden lg:table-cell">
                      {contact.city ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground hidden lg:table-cell">
                      {contact.phone ?? "—"}
                    </td>
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      {contact.email ? (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Check size={11} className="text-emerald-500" />
                          {contact.email.length > 22 ? contact.email.slice(0, 22) + "…" : contact.email}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground/50">
                          <AlertCircle size={11} />
                          Missing
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <StatusPill
                        status={contact.status}
                        onChange={(s) => updateStatus(contact.id, s)}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <ChevronRight size={14} className="text-muted-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer count */}
        {!loading && (
          <div className="px-6 py-2 border-t border-border text-xs text-muted-foreground">
            {filtered.length} contact{filtered.length !== 1 ? "s" : ""}
            {selected.size > 0 && ` · ${selected.size} selected`}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {detailContact && (
        <ContactDetail
          contact={detailContact}
          onClose={() => setDetailContact(null)}
          onStatusChange={(s) => updateStatus(detailContact.id, s)}
          onNotesChange={(n) => updateNotes(detailContact.id, n)}
        />
      )}

      {/* Campaign picker modal */}
      {showCampaignPicker && (
        <CampaignPickerModal
          contactIds={Array.from(selected)}
          onClose={() => setShowCampaignPicker(false)}
          onSent={() => { setShowCampaignPicker(false); setSelected(new Set()); fetchContacts(); }}
        />
      )}
    </div>
  );
}

// ─── Status pill (clickable dropdown) ─────────────────────────────────────────

function StatusPill({ status, onChange }: { status: ContactStatus; onChange: (s: ContactStatus) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status]} hover:opacity-80`}
      >
        {status}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 bg-popover border border-border rounded-md shadow-md py-1 min-w-32">
            {ALL_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => { onChange(s); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex items-center gap-2 ${s === status ? "font-medium" : ""}`}
              >
                {s === status && <Check size={10} />}
                {s !== status && <span className="w-2.5" />}
                {s}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Contact detail side panel ────────────────────────────────────────────────

function ContactDetail({
  contact,
  onClose,
  onStatusChange,
  onNotesChange,
}: {
  contact: Contact;
  onClose: () => void;
  onStatusChange: (s: ContactStatus) => void;
  onNotesChange: (n: string) => void;
}) {
  const [notes, setNotes] = useState(contact.notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => { setNotes(contact.notes ?? ""); }, [contact.id, contact.notes]);

  const saveNotes = async () => {
    setSavingNotes(true);
    await onNotesChange(notes);
    setSavingNotes(false);
  };

  return (
    <div className="w-80 border-l border-border flex flex-col bg-background overflow-hidden flex-shrink-0">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-border">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold leading-tight truncate">{contact.name}</h3>
          <span className="text-xs text-muted-foreground">
            {CATEGORY_LABELS[contact.category] ?? contact.category}
          </span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground ml-2 flex-shrink-0">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Status */}
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
            Status
          </label>
          <StatusPill status={contact.status} onChange={onStatusChange} />
        </div>

        {/* Contact info */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block">
            Contact
          </label>
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-sm hover:text-primary">
              <Mail size={13} className="text-muted-foreground flex-shrink-0" />
              <span className="truncate">{contact.email}</span>
            </a>
          )}
          {!contact.email && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground/60">
              <AlertCircle size={13} />
              No email — add manually
            </p>
          )}
          {contact.phone && (
            <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-sm hover:text-primary">
              <Phone size={13} className="text-muted-foreground flex-shrink-0" />
              {contact.phone}
            </a>
          )}
          {contact.website && (
            <a href={contact.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm hover:text-primary">
              <ExternalLink size={13} className="text-muted-foreground flex-shrink-0" />
              <span className="truncate">{contact.website.replace(/https?:\/\/(www\.)?/, "")}</span>
            </a>
          )}
        </div>

        {/* Location */}
        {(contact.city || contact.address) && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block">
              Location
            </label>
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin size={13} className="flex-shrink-0 mt-0.5" />
              <span>{contact.address ?? contact.city}</span>
            </p>
          </div>
        )}

        {/* Rating */}
        {contact.rating && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Star size={13} className="text-amber-400 fill-amber-400" />
            {contact.rating} ({contact.reviews_count ?? 0} reviews)
          </div>
        )}

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            rows={4}
            placeholder="Add notes, aesthetic fit, follow-up context..."
            className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {savingNotes && <p className="text-xs text-muted-foreground">Saving...</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Campaign picker modal ────────────────────────────────────────────────────

function CampaignPickerModal({
  contactIds,
  onClose,
  onSent,
}: {
  contactIds: string[];
  onClose: () => void;
  onSent: () => void;
}) {
  const supabase = createClient();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState<{ sent: number; skipped: number } | null>(null);

  useEffect(() => {
    supabase.from("campaigns").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      setCampaigns(data ?? []);
    });
  }, [supabase]);

  const send = async () => {
    if (!selected) return;
    setSending(true);
    try {
      const res = await fetch("/api/send-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id: selected, contact_ids: contactIds }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Send failed"); return; }
      setPreview({ sent: data.summary.sent, skipped: data.summary.skipped });
      toast.success(`Sent to ${data.summary.sent} contact${data.summary.sent !== 1 ? "s" : ""}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold">Send to campaign</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground">
            {contactIds.length} contact{contactIds.length !== 1 ? "s" : ""} selected. Choose a campaign to send.
          </p>

          {preview ? (
            <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={16} /> {preview.sent} emails sent successfully
              </div>
              {preview.skipped > 0 && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <AlertCircle size={16} /> {preview.skipped} skipped (no email address)
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {campaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No campaigns yet. Create one first.</p>
              ) : (
                campaigns.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelected(c.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selected === c.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-border/80 hover:bg-muted/50"
                    }`}
                  >
                    <div className="font-medium text-sm">{c.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">{c.subject}</div>
                    <div className="text-xs text-muted-foreground mt-1">{c.sent_count} sent · {c.status}</div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          {preview ? (
            <button onClick={onSent} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
              Done
            </button>
          ) : (
            <>
              <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted">Cancel</button>
              <button
                onClick={send}
                disabled={!selected || sending}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                Send
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Campaigns Tab ────────────────────────────────────────────────────────────

function CampaignsTab() {
  const supabase = createClient();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [detail, setDetail] = useState<Campaign | null>(null);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
    setCampaigns(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border">
          <span className="text-sm text-muted-foreground">{campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}</span>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            <Plus size={13} /> New campaign
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-auto p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              <Loader2 size={18} className="animate-spin mr-2" /> Loading...
            </div>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
              <MessageSquare size={36} strokeWidth={1} />
              <p className="text-sm">No campaigns yet.</p>
              <button onClick={() => setShowNew(true)} className="text-sm text-primary hover:underline">Create your first campaign →</button>
            </div>
          ) : (
            campaigns.map((c) => (
              <div
                key={c.id}
                onClick={() => setDetail(c)}
                className="p-4 border border-border rounded-lg hover:border-border/60 hover:bg-muted/30 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-sm text-muted-foreground truncate mt-0.5">{c.subject}</div>
                    {c.category && (
                      <span className="text-xs text-muted-foreground mt-1 inline-block">
                        {CATEGORY_LABELS[c.category] ?? c.category}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <CampaignStatusBadge status={c.status} />
                    <span className="text-xs text-muted-foreground">{c.sent_count} sent</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Campaign detail panel */}
      {detail && (
        <CampaignDetail
          campaign={detail}
          onClose={() => setDetail(null)}
          onUpdated={() => { fetchCampaigns(); }}
        />
      )}

      {/* New campaign modal */}
      {showNew && (
        <CampaignFormModal
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); fetchCampaigns(); }}
        />
      )}
    </div>
  );
}

function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const styles: Record<CampaignStatus, string> = {
    draft: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    paused: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>{status}</span>
  );
}

function CampaignDetail({
  campaign,
  onClose,
  onUpdated,
}: {
  campaign: Campaign;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const supabase = createClient();
  const [form, setForm] = useState(campaign);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("campaigns").update({
      name: form.name,
      subject: form.subject,
      body: form.body,
      category: form.category,
      wholesale_link: form.wholesale_link,
      calendly_link: form.calendly_link,
      status: form.status,
    }).eq("id", campaign.id);
    setSaving(false);
    if (error) { toast.error("Failed to save"); return; }
    toast.success("Campaign saved");
    onUpdated();
  };

  return (
    <div className="w-96 border-l border-border flex flex-col bg-background overflow-hidden flex-shrink-0">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold truncate">{campaign.name}</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground ml-2"><X size={16} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Field label="Name">
          <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            className="w-full text-sm border border-border rounded-md px-3 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
        </Field>
        <Field label="Subject">
          <input value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
            className="w-full text-sm border border-border rounded-md px-3 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
        </Field>
        <Field label="Body" hint="Use {{name}}, {{wholesale_link}}, {{calendly_link}}">
          <textarea value={form.body} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
            rows={10}
            className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring font-mono" />
        </Field>
        <Field label="Wholesale link">
          <input value={form.wholesale_link ?? ""} onChange={(e) => setForm((p) => ({ ...p, wholesale_link: e.target.value || null }))}
            placeholder="https://..."
            className="w-full text-sm border border-border rounded-md px-3 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
        </Field>
        <Field label="Calendly link">
          <input value={form.calendly_link ?? ""} onChange={(e) => setForm((p) => ({ ...p, calendly_link: e.target.value || null }))}
            placeholder="https://calendly.com/..."
            className="w-full text-sm border border-border rounded-md px-3 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
        </Field>
        <Field label="Status">
          <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as CampaignStatus }))}
            className="text-sm border border-border rounded-md px-2 py-1.5 bg-background focus:outline-none">
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>
        </Field>
      </div>
      <div className="p-4 border-t border-border">
        <button onClick={save} disabled={saving}
          className="w-full py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          Save changes
        </button>
      </div>
    </div>
  );
}

function CampaignFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const supabase = createClient();
  const [form, setForm] = useState(BLANK_CAMPAIGN);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name || !form.subject || !form.body) { toast.error("Name, subject and body are required"); return; }
    setSaving(true);
    const { error } = await supabase.from("campaigns").insert(form);
    setSaving(false);
    if (error) { toast.error("Failed to create campaign"); return; }
    toast.success("Campaign created");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold">New campaign</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <Field label="Campaign name">
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Cold Outreach — Interiorismo Barcelona"
              className="w-full text-sm border border-border rounded-md px-3 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
          </Field>
          <Field label="Email subject">
            <input value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
              placeholder="e.g. Colaboración — productos de decoración y arte..."
              className="w-full text-sm border border-border rounded-md px-3 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
          </Field>
          <Field label="Email body" hint="Variables: {{name}}, {{wholesale_link}}, {{calendly_link}}">
            <textarea value={form.body} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
              rows={8}
              placeholder="Hola {{name}},..."
              className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring font-mono" />
          </Field>
          <Field label="Wholesale link">
            <input value={form.wholesale_link ?? ""} onChange={(e) => setForm((p) => ({ ...p, wholesale_link: e.target.value || null }))}
              placeholder="https://..."
              className="w-full text-sm border border-border rounded-md px-3 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
          </Field>
          <Field label="Calendly link">
            <input value={form.calendly_link ?? ""} onChange={(e) => setForm((p) => ({ ...p, calendly_link: e.target.value || null }))}
              placeholder="https://calendly.com/..."
              className="w-full text-sm border border-border rounded-md px-3 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
          </Field>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Searches Tab ─────────────────────────────────────────────────────────────

function SearchesTab({ onImported }: { onImported: () => void }) {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("Barcelona");
  const [country, setCountry] = useState("ES");
  const [category, setCategory] = useState<ContactCategory>("interior_studio");
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [searchId, setSearchId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportSummary | null>(null);
  const [history, setHistory] = useState<OutreachSearch[]>([]);
  const supabase = createClient();

  const fetchHistory = useCallback(async () => {
    const { data } = await supabase.from("searches").select("*").order("created_at", { ascending: false }).limit(20);
    setHistory(data ?? []);
  }, [supabase]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const runSearch = async () => {
    if (!query) { toast.error("Enter a search query"); return; }
    setSearching(true);
    setCandidates([]);
    setSelectedIds(new Set());
    setImportResult(null);

    try {
      const res = await fetch("/api/search-places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, city, country, category }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Search failed"); return; }
      setCandidates(data.candidates ?? []);
      setSearchId(data.search_id);
      // Select all by default
      setSelectedIds(new Set(data.candidates.map((c: Candidate) => c.place_id)));
      fetchHistory();
    } finally {
      setSearching(false);
    }
  };

  const runImport = async () => {
    if (!selectedIds.size) { toast.error("Select at least one contact"); return; }
    setImporting(true);

    try {
      const res = await fetch("/api/import-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          place_ids: Array.from(selectedIds),
          search_id: searchId,
          category,
          city: city || null,
          country: country || "ES",
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Import failed"); return; }
      setImportResult(data.summary);
      toast.success(`Imported ${data.summary.imported} contacts`);
      fetchHistory();
    } finally {
      setImporting(false);
    }
  };

  const toggleCandidate = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: search form */}
      <div className="w-80 border-r border-border flex flex-col overflow-hidden flex-shrink-0">
        <div className="p-4 border-b border-border">
          <h3 className="font-medium mb-3">New search</h3>
          <div className="space-y-2.5">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Search query</label>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                placeholder="e.g. estudio interiorismo"
                className="w-full text-sm border border-border rounded-md px-3 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">City</label>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Barcelona"
                  className="w-full text-sm border border-border rounded-md px-3 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Country</label>
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="ES"
                  className="w-full text-sm border border-border rounded-md px-3 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ContactCategory)}
                className="w-full text-sm border border-border rounded-md px-2 py-1.5 bg-background focus:outline-none"
              >
                {ALL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <button
              onClick={runSearch}
              disabled={searching || !query}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {searching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
              {searching ? "Searching..." : "Search Google Places"}
            </button>
          </div>
        </div>

        {/* Search history */}
        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">History</p>
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No searches yet</p>
          ) : (
            history.map((s) => (
              <div key={s.id} className="py-2 border-b border-border/50 last:border-0">
                <div className="text-xs font-medium">{s.query}{s.city ? ` · ${s.city}` : ""}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {s.total_found} found · {s.imported_count} imported ·{" "}
                  {new Date(s.created_at).toLocaleDateString("es-ES")}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right: results */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {candidates.length === 0 && !searching ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <Search size={40} strokeWidth={1} />
            <p className="text-sm">Run a search to see results here.</p>
          </div>
        ) : (
          <>
            {/* Results toolbar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedIds.size === candidates.length && candidates.length > 0}
                  onChange={() => {
                    if (selectedIds.size === candidates.length) setSelectedIds(new Set());
                    else setSelectedIds(new Set(candidates.map((c) => c.place_id)));
                  }}
                  className="rounded"
                />
                <span className="text-sm text-muted-foreground">
                  {candidates.length} results · {selectedIds.size} selected
                </span>
              </div>
              {importResult ? (
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={14} /> {importResult.imported} imported
                  </span>
                  {importResult.skipped > 0 && (
                    <span className="text-muted-foreground flex items-center gap-1">
                      <XCircle size={14} /> {importResult.skipped} already exist
                    </span>
                  )}
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Mail size={14} /> {importResult.emails_found} emails found
                  </span>
                  <button onClick={onImported} className="text-primary hover:underline text-sm">View contacts →</button>
                </div>
              ) : (
                <button
                  onClick={runImport}
                  disabled={importing || selectedIds.size === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                >
                  {importing ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  {importing ? "Importing..." : `Import ${selectedIds.size}`}
                </button>
              )}
            </div>

            {/* Results table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/50 backdrop-blur border-b border-border">
                  <tr>
                    <th className="w-10 px-4 py-2"></th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden md:table-cell">Address</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c) => (
                    <tr key={c.place_id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="px-4 py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(c.place_id)}
                          onChange={() => toggleCandidate(c.place_id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-3 py-2.5 font-medium">{c.name}</td>
                      <td className="px-3 py-2.5 text-muted-foreground text-xs hidden md:table-cell">{c.address}</td>
                      <td className="px-3 py-2.5">
                        {c.rating ? (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Star size={11} className="text-amber-400 fill-amber-400" />
                            {c.rating} ({c.reviews_count})
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground block mb-1">
        {label}
        {hint && <span className="font-normal ml-1 text-muted-foreground/70">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}

// ─── Types (local) ────────────────────────────────────────────────────────────

interface Candidate {
  place_id: string;
  name: string;
  address: string;
  rating: number | null;
  reviews_count: number | null;
}

interface ImportSummary {
  total: number;
  imported: number;
  skipped: number;
  emails_found: number;
}
