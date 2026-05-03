export type InvoiceType = "payment" | "income";
export type Quarter = "T1" | "T2" | "T3" | "T4";
export type InvoiceStatus = "processing" | "done" | "error";

export interface Invoice {
  id: string;
  uploaded_by: string | null;
  file_path: string;
  file_name: string;
  file_type: string | null;
  type: InvoiceType;
  vendor: string | null;
  date: string | null;
  amount: number | null;
  currency: string;
  invoice_number: string | null;
  tax_amount: number | null;
  quarter: Quarter | null;
  year: number | null;
  category: string | null;
  metadata: Record<string, unknown>;
  notes: string | null;
  status: InvoiceStatus;
  created_at: string;
  updated_at: string;
}

export interface ExtractedInvoiceData {
  vendor: string | null;
  date: string | null; // ISO format YYYY-MM-DD
  amount: number | null;
  currency: string | null;
  invoice_number: string | null;
  tax_amount: number | null;
  type: InvoiceType;
  line_items: Array<{ description: string; quantity?: number; unit_price?: number; total?: number }>;
  raw: Record<string, unknown>;
}

export interface Supplier {
  id: string;
  created_by: string | null;
  business_name: string;
  vat_number: string | null;
  address: string | null;
  shipping_address: string | null;
  zip_code: string | null;
  country: string | null;
  contact_person: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MyCompany {
  id: string;
  user_id: string;
  business_name: string | null;
  vat_number: string | null;
  billing_address: string | null;
  shipping_address: string | null;
  zip_code: string | null;
  country: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface Snippet {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export type BankStatementStatus = "processing" | "done" | "error";
export type MatchStatus = "matched" | "unmatched" | "dismissed";
export type TransactionDirection = "debit" | "credit";

export interface BankStatement {
  id: string;
  file_path: string;
  file_name: string;
  quarter: Quarter | null;
  year: number | null;
  status: BankStatementStatus;
  raw_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface BankTransaction {
  id: string;
  statement_id: string;
  date: string | null;
  description: string | null;
  amount: number | null;
  direction: TransactionDirection | null;
  match_status: MatchStatus;
  matched_invoice_id: string | null;
  manually_set: boolean;
  created_at: string;
  updated_at: string;
  matched_invoice?: Pick<Invoice, "id" | "vendor" | "invoice_number" | "date" | "amount">;
}

export interface ExtractedTransaction {
  date: string | null;
  description: string | null;
  amount: number | null;
  direction: TransactionDirection | null;
}

export interface ExtractedBankStatementData {
  transactions: ExtractedTransaction[];
  raw: Record<string, unknown>;
}

export type OrderType = "sampling" | "production";
export type OrderStatus = "draft" | "confirmed" | "in_production" | "quality_check" | "shipped" | "delivered" | "cancelled";

export interface Order {
  id: string;
  supplier_id: string;
  reference: string;
  type: OrderType;
  status: OrderStatus;
  quantity: number | null;
  unit_cost: number | null;
  currency: string;
  order_date: string;
  expected_date: string | null;
  actual_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  supplier?: Pick<Supplier, "id" | "business_name" | "country">;
}

export interface OrderEvent {
  id: string;
  order_id: string;
  status: OrderStatus;
  note: string | null;
  event_date: string;
  created_at: string;
}

export interface SupplierOrderStats {
  supplier_id: string;
  active_count: number;
  delivered_count: number;
  avg_lead_days: number | null;
  on_time_count: number;
}

export function getQuarterFromDate(dateStr: string): { quarter: Quarter; year: number } | null {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;

  const month = date.getMonth() + 1; // 1-12
  const year = date.getFullYear();
  const quarter: Quarter =
    month <= 3 ? "T1" : month <= 6 ? "T2" : month <= 9 ? "T3" : "T4";

  return { quarter, year };
}
