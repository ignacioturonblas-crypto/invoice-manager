import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ExtractedInvoiceData } from "./types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

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

export async function extractInvoiceData(
  fileBase64: string,
  mimeType: string
): Promise<ExtractedInvoiceData> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });

  const result = await model.generateContent([
    EXTRACTION_PROMPT,
    {
      inlineData: {
        mimeType,
        data: fileBase64,
      },
    },
  ]);

  const text = result.response.text().trim();

  // Strip markdown code fences if present
  const json = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

  try {
    return JSON.parse(json) as ExtractedInvoiceData;
  } catch {
    // Return minimal fallback if parsing fails
    return {
      vendor: null,
      date: null,
      amount: null,
      currency: null,
      invoice_number: null,
      tax_amount: null,
      type: "payment",
      line_items: [],
      raw: { raw_text: text },
    };
  }
}
