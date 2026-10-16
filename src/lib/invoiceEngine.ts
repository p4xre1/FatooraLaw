export type InvoiceStage = "draft" | "issued";
export type InvoiceTheme = "classic" | "modern" | "friendly";
export type InvoicePaymentMethod = "transfer" | "cash" | "check" | "card" | "other";

export type InvoiceParty = {
  name: string;
  legalForm: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  ice: string;
  taxId: string;
  rc: string;
  rcCity: string;
  patente: string;
  cnss: string;
};

export type InvoiceLine = {
  id: string;
  description: string;
  unit: string;
  quantity: number;
  unitPriceHT: number;
  vatRate: number;
};

export type InvoiceRecord = {
  id: string;
  number: string | null;
  stage: InvoiceStage;
  createdAt: string;
  updatedAt: string;
  issueDate: string;
  currency: "MAD" | "EUR" | "USD";
  dueDate: string;
  subject: string;
  reference: string;
  seller: InvoiceParty;
  buyer: InvoiceParty;
  lines: InvoiceLine[];
  taxNote: string;
  notes: string;
  paymentTerms: string;
  paymentMethod: InvoicePaymentMethod;
  paymentReference: string;
  amountPaid: number;
  paidAt: string;
  theme: InvoiceTheme;
  accentColor: string;
  logoDataUrl: string | null;
};

export type InvoiceTemplate = {
  id: string;
  name: string;
  theme: InvoiceTheme;
  accentColor: string;
  defaultVatRate: number;
  notes: string;
  paymentTerms: string;
  logoDataUrl: string | null;
  createdAt: string;
};

export type InvoiceTotals = {
  subtotalHT: number;
  totalVAT: number;
  totalTTC: number;
  balanceDue: number;
  taxBreakdown: { rate: number; baseHT: number; vat: number }[];
};

export type InvoiceContactPrefill = {
  name: string;
  ice?: string;
  phone?: string;
  email?: string;
  city?: string;
};

export const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateInvoiceTotals(lines: InvoiceLine[], amountPaid = 0): InvoiceTotals {
  const byRate = new Map<number, { baseHT: number; vat: number }>();
  let subtotalHT = 0;
  let totalVAT = 0;

  for (const line of lines) {
    const quantity = Number.isFinite(line.quantity) && line.quantity > 0 ? line.quantity : 0;
    const unitPrice = Number.isFinite(line.unitPriceHT) && line.unitPriceHT >= 0 ? line.unitPriceHT : 0;
    const rate = Number.isFinite(line.vatRate) && line.vatRate >= 0 && line.vatRate <= 100 ? line.vatRate : 0;
    const baseHT = roundMoney(quantity * unitPrice);
    const vat = roundMoney(baseHT * rate / 100);
    subtotalHT = roundMoney(subtotalHT + baseHT);
    totalVAT = roundMoney(totalVAT + vat);
    const group = byRate.get(rate) ?? { baseHT: 0, vat: 0 };
    group.baseHT = roundMoney(group.baseHT + baseHT);
    group.vat = roundMoney(group.vat + vat);
    byRate.set(rate, group);
  }

  const totalTTC = roundMoney(subtotalHT + totalVAT);
  return {
    subtotalHT,
    totalVAT,
    totalTTC,
    balanceDue: roundMoney(Math.max(0, totalTTC - (Number.isFinite(amountPaid) ? amountPaid : 0))),
    taxBreakdown: [...byRate.entries()]
      .sort(([a], [b]) => a - b)
      .map(([rate, value]) => ({ rate, baseHT: value.baseHT, vat: value.vat })),
  };
}

export function invoicePaymentStatus(amountPaid: number, totalTTC: number): "unpaid" | "partial" | "paid" {
  const paid = Number.isFinite(amountPaid) ? Math.max(0, amountPaid) : 0;
  if (paid <= 0) return "unpaid";
  if (paid + 0.005 >= totalTTC) return "paid";
  return "partial";
}

export function nextInvoiceNumber(invoices: Pick<InvoiceRecord, "number" | "stage">[], issueDate: string): string {
  const year = /^\d{4}-/.test(issueDate) ? issueDate.slice(0, 4) : String(new Date().getFullYear());
  const pattern = new RegExp("^FAC-" + year + "-(\\d+)$");
  const greatest = invoices.reduce((max, invoice) => {
    if (invoice.stage !== "issued" || !invoice.number) return max;
    const match = pattern.exec(invoice.number);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return "FAC-" + year + "-" + String(greatest + 1).padStart(4, "0");
}

export function validateInvoiceDraft(invoice: InvoiceRecord): string[] {
  const errors: string[] = [];
  if (!invoice.seller.name.trim()) errors.push("sellerName");
  if (!invoice.seller.address.trim()) errors.push("sellerAddress");
  if (!invoice.issueDate || !/^\d{4}-\d{2}-\d{2}$/.test(invoice.issueDate)) errors.push("issueDate");
  if (!invoice.buyer.name.trim()) errors.push("buyerName");
  if (!invoice.lines.length) errors.push("lines");
  invoice.lines.forEach((line, index) => {
    if (!line.description.trim()) errors.push("lineDescription:" + index);
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) errors.push("lineQuantity:" + index);
    if (!Number.isFinite(line.unitPriceHT) || line.unitPriceHT < 0) errors.push("linePrice:" + index);
    if (!Number.isFinite(line.vatRate) || line.vatRate < 0 || line.vatRate > 100) errors.push("lineVat:" + index);
  });
  if (!Number.isFinite(invoice.amountPaid) || invoice.amountPaid < 0) errors.push("amountPaid");
  if (!invoice.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(invoice.dueDate)) errors.push("dueDate");
  return errors;
}

export function duplicateInvoiceAsDraft(invoice: InvoiceRecord, now = new Date().toISOString()): InvoiceRecord {
  return {
    ...invoice,
    id: createInvoiceId(),
    number: null,
    stage: "draft",
    createdAt: now,
    updatedAt: now,
    amountPaid: 0,
    paidAt: "",
    paymentReference: "",
    lines: invoice.lines.map((line) => ({ ...line, id: createInvoiceId() })),
  };
}

export function createInvoiceId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "inv-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}
