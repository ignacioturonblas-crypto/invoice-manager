import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ExtractedInvoiceData } from "./types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Try models in order — fall back if one is unavailable
const MODELS = ["gemini-2.5-flash", "gemini-1.5-flash"];

const EXTRACTION_PROMPT = `You are an invoice data extraction assistant. Analyze this invoice/receipt image or PDF and extract the following information as JSON.

Return ONLY valid JSON with this exact structure:
{
  "vendor": "company or person name",
  "date": "YYYY-MM-DD format, or null if not found",
  "amount": total amount as number (without currency symbol), or null,
  "currency": "EUR, USD, GBP, etc., or null",
  "invoice_number": "invoice/receipt number as string, or null",
  "tax_amount": tax amount as number, or null,
  "type": "payment" or "income" (payment = you paid someone, income = someone paid you),
  "line_items": [
    { "description": "item description", "quantity": number or null, "unit_price": number or null, "total": number or null }
  ],
  "raw": {}
}

Rules:
- Dates must be in YYYY-MM-DD format
- Amounts are numbers only (no symbols)
- If unsure between payment/income, default to "payment"
- line_items can be empty array if no line items visible
- Put any extra extracted data in the "raw" object`;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function extractInvoiceData(
  fileBase64: string,
  mimeType: string
): Promise<ExtractedInvoiceData> {
  let lastError: unknown;

  for (const modelName of MODELS) {
    // Retry each model up to 3 times on 503
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });

        const result = await model.generateContent([
          EXTRACTION_PROMPT,
          { inlineData: { mimeType, data: fileBase64 } },
        ]);

        const text = result.response.text().trim();
        const json = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

        try {
          return JSON.parse(json) as ExtractedInvoiceData;
        } catch {
          return {
            vendor: null, date: null, amount: null, currency: null,
            invoice_number: null, tax_amount: null, type: "payment",
            line_items: [], raw: { raw_text: text },
          };
        }
      } catch (err) {
        lastError = err;
        const message = String(err);
        const is503 = message.includes("503") || message.includes("Service Unavailable");
        const is404 = message.includes("404") || message.includes("no longer available");

        if (is404) break; // This model is gone — try next model immediately
        if (is503 && attempt < 3) {
          await sleep(attempt * 3000); // Wait 3s, then 6s before retrying
          continue;
        }
        break; // Any other error — try next model
      }
    }
  }

  throw lastError;
}
