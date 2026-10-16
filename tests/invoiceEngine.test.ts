import { describe, expect, it } from "vitest";
import {
  calculateInvoiceTotals, duplicateInvoiceAsDraft, invoicePaymentStatus,
  nextInvoiceNumber, validateInvoiceDraft,
  type InvoiceRecord,
} from "../src/lib/invoiceEngine";

function invoice(overrides: Partial<InvoiceRecord> = {}): InvoiceRecord {
  return {
    id: "draft-1", number: null, stage: "draft", createdAt: "2026-10-16T09:00:00.000Z",
    updatedAt: "2026-10-16T09:00:00.000Z", issueDate: "2026-10-16", operationDate: "2026-10-16", currency: "MAD",
    dueDate: "2026-11-15", subject: "Web design", reference: "",
    seller: { name: "Seller SARL", legalForm: "SARL", address: "Tangier", city: "Tangier", country: "Morocco", phone: "", email: "", ice: "", taxId: "", rc: "", rcCity: "", patente: "", cnss: "" },
    buyer: { name: "Client", legalForm: "", address: "Rabat", city: "Rabat", country: "Morocco", phone: "", email: "", ice: "", taxId: "", rc: "", rcCity: "", patente: "", cnss: "" },
    lines: [
      { id: "line-1", description: "Consulting", unit: "day", quantity: 2, unitPriceHT: 1000, vatRate: 20 },
      { id: "line-2", description: "Travel", unit: "trip", quantity: 1, unitPriceHT: 200, vatRate: 10 },
    ],
    taxNote: "", notes: "", paymentTerms: "30 days", paymentMethod: "transfer",
    paymentReference: "", amountPaid: 0, paidAt: "", theme: "classic",
    accentColor: "#2563eb", logoDataUrl: null, ...overrides,
  };
}

describe("Moroccan invoice calculation engine", () => {
  it("calculates HT, VAT by line rate, TTC and outstanding balance", () => {
    const totals = calculateInvoiceTotals(invoice().lines, 500);
    expect(totals.subtotalHT).toBe(2200);
    expect(totals.totalVAT).toBe(420);
    expect(totals.totalTTC).toBe(2620);
    expect(totals.balanceDue).toBe(2120);
    expect(totals.taxBreakdown).toEqual([
      { rate: 10, baseHT: 200, vat: 20 },
      { rate: 20, baseHT: 2000, vat: 400 },
    ]);
  });

  it("derives unpaid, partially paid and paid states", () => {
    expect(invoicePaymentStatus(0, 100)).toBe("unpaid");
    expect(invoicePaymentStatus(99, 100)).toBe("partial");
    expect(invoicePaymentStatus(100, 100)).toBe("paid");
  });

  it("assigns the next local sequence for the issue year only", () => {
    expect(nextInvoiceNumber([], "2026-10-16")).toBe("FAC-2026-0001");
    const prior = [
      { number: "FAC-2026-0002", stage: "issued" as const },
      { number: "FAC-2026-0009", stage: "issued" as const },
      { number: "FAC-2026-0010", stage: "draft" as const },
      { number: "FAC-2025-0099", stage: "issued" as const },
    ];
    expect(nextInvoiceNumber(prior, "2026-10-16")).toBe("FAC-2026-0010");
    expect(nextInvoiceNumber(prior, "2027-01-01")).toBe("FAC-2027-0001");
  });

  it("duplicates issued invoices as a new unissued draft with clean payment state", () => {
    const copy = duplicateInvoiceAsDraft(invoice({ stage: "issued", number: "FAC-2026-0001", amountPaid: 2620, paidAt: "2026-10-16" }));
    expect(copy.stage).toBe("draft");
    expect(copy.number).toBeNull();
    expect(copy.amountPaid).toBe(0);
    expect(copy.paidAt).toBe("");
    expect(copy.id).not.toBe("draft-1");
    expect(copy.lines[0].id).not.toBe("line-1");
  });

  it("requires the basic party data and rejects a due date before the issue date", () => {
    const bad = invoice({ buyer: { ...invoice().buyer, name: "" }, dueDate: "2026-10-01" });
    expect(validateInvoiceDraft(bad)).toContain("buyerName");
    expect(validateInvoiceDraft(bad)).toContain("dueDateBeforeIssue");
    expect(validateInvoiceDraft(invoice())).toEqual([]);
  });
});
