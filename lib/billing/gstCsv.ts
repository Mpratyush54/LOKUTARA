import { formatInrFromPaise, resolveGstBreakdown, type Invoice } from "./invoices";

function csvCell(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function istDate(value: Date | null): string {
  if (!value) return "";
  return value.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Kolkata" });
}

/**
 * GST-filing friendly sales register: one row per invoice line with taxable
 * value, IGST or CGST/SGST split, and totals. Complimentary records
 * export at zero so the register reconciles with the dashboard.
 */
export function invoicesToGstCsv(invoices: Invoice[]): string {
  const head = [
    "Bill number",
    "Date (IST)",
    "Customer",
    "Email",
    "GSTIN (customer)",
    "Place of supply",
    "Tax type",
    "Item",
    "SKU",
    "Qty",
    "Taxable value (INR)",
    "GST rate %",
    "IGST (INR)",
    "CGST (INR)",
    "SGST (INR)",
    "Total (INR)",
    "Status",
    "Kind",
    "Promo",
  ];
  const lines = [head.join(",")];
  for (const invoice of invoices) {
    for (const line of invoice.lines) {
      const taxable = line.subtotalPaise / 100;
      const breakdown = resolveGstBreakdown({
        gstRate: line.gstRate,
        gstPaise: line.gstPaise,
        customerGstin: invoice.customerGstin,
        supplyState: invoice.supplyState,
      });
      const igst = breakdown.igstPaise / 100;
      const cgst = breakdown.cgstPaise / 100;
      const sgst = breakdown.sgstPaise / 100;
      lines.push(
        [
          csvCell(invoice.number),
          csvCell(istDate(invoice.issuedAt ?? invoice.createdAt)),
          csvCell(invoice.customerName),
          csvCell(invoice.customerEmail),
          csvCell(invoice.customerGstin),
          csvCell(invoice.supplyState || "Karnataka (29)"),
          csvCell(breakdown.type === "inter" ? "Inter-state" : "Intra-state"),
          csvCell(line.label),
          csvCell(line.sku),
          csvCell(line.qty),
          csvCell(taxable.toFixed(2)),
          csvCell(line.gstRate),
          csvCell(igst.toFixed(2)),
          csvCell(cgst.toFixed(2)),
          csvCell(sgst.toFixed(2)),
          csvCell((line.totalPaise / 100).toFixed(2)),
          csvCell(invoice.status),
          csvCell(invoice.kind),
          csvCell(invoice.promoCode),
        ].join(","),
      );
    }
  }
  return lines.join("\n");
}

export function invoicesToGstSummary(invoices: Invoice[]): string {
  const taxable = invoices.reduce((sum, invoice) => sum + invoice.subtotalPaise, 0);
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  for (const invoice of invoices) {
    for (const line of invoice.lines) {
      const b = resolveGstBreakdown({
        gstRate: line.gstRate,
        gstPaise: line.gstPaise,
        customerGstin: invoice.customerGstin,
        supplyState: invoice.supplyState,
      });
      totalCgst += b.cgstPaise;
      totalSgst += b.sgstPaise;
      totalIgst += b.igstPaise;
    }
  }
  const gst = totalCgst + totalSgst + totalIgst;
  return [
    `Invoices: ${invoices.length}`,
    `Taxable value: ${formatInrFromPaise(taxable)}`,
    `GST: ${formatInrFromPaise(gst)} (IGST ${formatInrFromPaise(totalIgst)} · CGST ${formatInrFromPaise(totalCgst)} · SGST ${formatInrFromPaise(totalSgst)})`,
    `Total: ${formatInrFromPaise(taxable + gst)}`,
  ].join(" · ");
}
