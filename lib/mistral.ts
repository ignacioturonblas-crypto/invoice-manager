import { Mistral } from "@mistralai/mistralai";
import type { ExtractedBankStatementData, ExtractedInvoiceData } from "./types";

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! });

const EXTRACTION_PROMPT = `You are an invoice data extraction assistant. Analyze this invoice/receipt and extract the following information as JSON.

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

function parseJson(text: string): ExtractedInvoiceData {
  const json = text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  try {
    return JSON.parse(json) as ExtractedInvoiceData;
  } catch {
    return {
      vendor: null, date: null, amount: null, currency: null,
      invoice_number: null, tax_amount: null, type: "payment",
      line_items: [], raw: { raw_text: text },
    };
  }
}

async function extractFromImage(fileBase64: string, mimeType: string): Promise<ExtractedInvoiceData> {
  const response = await client.chat.complete({
    model: "pixtral-12b-2409",
    messages: [{
      role: "user",
      content: [
        { type: "text", text: EXTRACTION_PROMPT },
        { type: "image_url", imageUrl: { url: `data:${mimeType};base64,${fileBase64}` } },
      ],
    }],
  });

  const text = response.choices?.[0]?.message?.content;
  return parseJson(typeof text === "string" ? text : "");
}

async function extractFromPdf(fileBase64: string): Promise<ExtractedInvoiceData> {
  // Step 1: OCR the PDF
  const ocrResponse = await client.ocr.process({
    model: "mistral-ocr-latest",
    document: {
      type: "document_url",
      documentUrl: `data:application/pdf;base64,${fileBase64}`,
    },
  });

  const ocrText = ocrResponse.pages?.map((p: { markdown: string }) => p.markdown).join("\n\n") ?? "";

  // Step 2: Extract structured JSON from the OCR text
  const chatResponse = await client.chat.complete({
    model: "mistral-small-latest",
    messages: [{
      role: "user",
      content: `${EXTRACTION_PROMPT}\n\nInvoice text:\n${ocrText}`,
    }],
  });

  const text = chatResponse.choices?.[0]?.message?.content;
  return parseJson(typeof text === "string" ? text : "");
}

export async function extractInvoiceData(
  fileBase64: string,
  mimeType: string
): Promise<ExtractedInvoiceData> {
  if (mimeType === "application/pdf") {
    return extractFromPdf(fileBase64);
  }
  return extractFromImage(fileBase64, mimeType);
}

const BANK_STATEMENT_PROMPT = `You are a bank statement parser. Extract ALL transactions from this bank statement.

Return ONLY valid JSON with this exact structure:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD or null",
      "description": "merchant or transaction description",
      "amount": positive number without currency symbol,
      "direction": "debit" or "credit"
    }
  ],
  "raw": {}
}

Rules:
- Include every transaction row, no omissions
- Amounts are always positive numbers (e.g. 45.00, not -45.00)
- direction is "debit" when money leaves the account, "credit" when money arrives
- Dates must be YYYY-MM-DD
- Skip opening/closing balance rows and header rows
- If direction is ambiguous, default to "debit"
- Put any metadata (account number, statement period, bank name) in the "raw" object`;

function parseBankJson(text: string): ExtractedBankStatementData {
  const json = text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  try {
    return JSON.parse(json) as ExtractedBankStatementData;
  } catch {
    return { transactions: [], raw: { raw_text: text } };
  }
}

export async function extractBankStatement(
  fileBase64: string
): Promise<ExtractedBankStatementData> {
  // Step 1: OCR the PDF
  const ocrResponse = await client.ocr.process({
    model: "mistral-ocr-latest",
    document: {
      type: "document_url",
      documentUrl: `data:application/pdf;base64,${fileBase64}`,
    },
  });

  const ocrText = ocrResponse.pages?.map((p: { markdown: string }) => p.markdown).join("\n\n") ?? "";

  // Step 2: Extract structured transaction list
  const chatResponse = await client.chat.complete({
    model: "mistral-small-latest",
    messages: [{
      role: "user",
      content: `${BANK_STATEMENT_PROMPT}\n\nBank statement text:\n${ocrText}`,
    }],
  });

  const text = chatResponse.choices?.[0]?.message?.content;
  return parseBankJson(typeof text === "string" ? text : "");
}
