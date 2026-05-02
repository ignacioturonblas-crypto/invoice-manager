import type { ExtractedTransaction, Invoice, MatchStatus } from "./types";

export interface MatchedTransaction extends ExtractedTransaction {
  matchedInvoiceId: string | null;
}

function daysBetween(a: string, b: string): number {
  return (Date.parse(a) - Date.parse(b)) / 86_400_000;
}

/**
 * Cross-references extracted bank transactions against existing invoices.
 * Match criteria: |amount diff| < 0.01 AND |days diff| <= 3.
 * Closest date wins; tie-break by direction vs invoice type.
 *
 * @param transactions - Extracted transactions from bank statement
 * @param invoices     - Existing invoices from DB (status = "done")
 * @param existing     - Optionally pass existing DB rows to skip manually_set ones on re-process
 */
export function matchTransactions(
  transactions: ExtractedTransaction[],
  invoices: Pick<Invoice, "id" | "amount" | "date" | "type">[],
  existing: { id?: string; manually_set?: boolean; match_status?: string }[] = []
): MatchedTransaction[] {
  // Build a set of transaction indices that were manually set (skip re-matching those)
  const manuallySetIds = new Set(
    existing.filter((e) => e.manually_set).map((e) => e.id)
  );

  return transactions.map((tx, idx) => {
    // Skip manually set rows (only relevant when re-processing)
    if (existing[idx]?.manually_set && manuallySetIds.has(existing[idx]?.id)) {
      return {
        ...tx,
        matchedInvoiceId: existing[idx]?.match_status === "matched"
          ? (existing[idx] as Record<string, string>).matched_invoice_id ?? null
          : null,
      };
    }

    if (tx.amount == null || tx.date == null) {
      return { ...tx, matchedInvoiceId: null };
    }

    // Filter by amount (exact, float-tolerant)
    const amountMatches = invoices.filter(
      (inv) => inv.amount != null && Math.abs(inv.amount - tx.amount!) < 0.01
    );

    if (amountMatches.length === 0) {
      return { ...tx, matchedInvoiceId: null };
    }

    // Filter by date ±3 days
    const dateMatches = amountMatches.filter(
      (inv) => inv.date != null && Math.abs(daysBetween(inv.date!, tx.date!)) <= 3
    );

    if (dateMatches.length === 0) {
      return { ...tx, matchedInvoiceId: null };
    }

    // Sort: closest date first, then by type alignment (debit→payment, credit→income)
    dateMatches.sort((a, b) => {
      const aDays = Math.abs(daysBetween(a.date!, tx.date!));
      const bDays = Math.abs(daysBetween(b.date!, tx.date!));
      if (aDays !== bDays) return aDays - bDays;

      // Tie-break: prefer type that matches direction
      const aTypeMatch =
        (tx.direction === "debit" && a.type === "payment") ||
        (tx.direction === "credit" && a.type === "income");
      const bTypeMatch =
        (tx.direction === "debit" && b.type === "payment") ||
        (tx.direction === "credit" && b.type === "income");

      if (aTypeMatch && !bTypeMatch) return -1;
      if (!aTypeMatch && bTypeMatch) return 1;
      return 0;
    });

    return { ...tx, matchedInvoiceId: dateMatches[0].id };
  });
}
