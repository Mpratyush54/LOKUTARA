import { toPdfLatin, wrapPdfLine } from "../product/pdf";
import { skuCatalog, type InvoiceSku } from "./catalog";
import { formatInrFromPaise, resolveGstBreakdown, type Invoice, type InvoiceLine } from "./invoices";

export type InvoiceSeller = {
  legalName: string;
  gstin: string;
  address: string;
};

/** Indicative SAC codes for the catalogue (services). */
const SAC_BY_SKU: Record<string, string> = {
  workshop: "9992",
  virtual_session: "9992",
  full_day: "9992",
  custom_design: "9992",
  custom: "9997",
  counselling: "9993",
  app_access: "9984",
};

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;
}

function threeDigits(n: number): string {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  return `${hundred ? `${ONES[hundred]} Hundred${rest ? " " : ""}` : ""}${rest ? twoDigits(rest) : ""}`;
}

/** Indian numbering: crore, lakh, thousand. Input is whole rupees. */
export function inrAmountWords(rupees: number): string {
  const n = Math.max(0, Math.round(rupees));
  if (n === 0) return "Rupees Zero Only";
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1000);
  const rest = n % 1000;
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  return `Rupees ${parts.join(" ")} Only`;
}

function istDate(value: Date | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function sacFor(line: InvoiceLine): string {
  return SAC_BY_SKU[line.sku] ?? "9999";
}

function money(paise: number): string {
  return formatInrFromPaise(paise);
}

function pdfEscape(text: string): string {
  return toPdfLatin(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 44;
const CONTENT_W = PAGE_W - MARGIN * 2;

export function buildInvoicePdf(input: {
  invoice: Invoice;
  seller: InvoiceSeller;
}): Uint8Array {
  const { invoice, seller } = input;
  const complimentary = invoice.kind === "complimentary";
  const legalName = seller.legalName || "Lokutara";
  const docTitle = complimentary ? "BILL OF SUPPLY" : "TAX INVOICE";

  const breakdown = resolveGstBreakdown({
    gstRate: invoice.gstRate,
    gstPaise: invoice.gstPaise,
    customerGstin: invoice.customerGstin,
    supplyState: invoice.supplyState,
  });

  const isInterState = breakdown.type === "inter";
  const isPaid = invoice.status === "paid";
  const statusLabel = isPaid ? "PAID" : invoice.status.toUpperCase();
  const grossTaxable = invoice.subtotalPaise + invoice.discountPaise;
  const supplyStateText = invoice.supplyState || "Karnataka (29)";

  // Filter internal developer comments
  const isInternalNote =
    invoice.notes &&
    (invoice.notes.includes("Given by Admin") ||
      invoice.notes.includes("not counted as revenue") ||
      invoice.notes.includes("admin_grant"));

  const customerNote = isInternalNote
    ? "Complimentary Institutional Access - 100% Fee Waiver"
    : invoice.notes?.trim() || (complimentary ? "Complimentary Institutional Access - 100% Fee Waiver" : "Thank you for choosing Lokutara.");

  // Clean, high-readability business palette
  const CHARCOAL = "0.12 0.16 0.22";
  const SLATE = "0.40 0.45 0.52";
  const LIGHT_SLATE = "0.60 0.65 0.72";
  const BORDER_COLOR = "0.85 0.88 0.91";
  const HEADER_BG = "0.96 0.97 0.98";
  const FOREST = "0.06 0.24 0.20";
  const GREEN_BG = "0.88 0.96 0.90";
  const GREEN_TEXT = "0.10 0.45 0.20";

  let ops: string[] = ["BT", "/F1 10 Tf"];
  let currentFont = "F1";
  let currentSize = 10;

  function setFont(font: "F1" | "F2", size: number) {
    if (font !== currentFont || size !== currentSize) {
      ops.push(`/${font} ${size} Tf`);
      currentFont = font;
      currentSize = size;
    }
  }

  function textAt(
    str: string,
    x: number,
    y: number,
    opts?: { font?: "F1" | "F2"; size?: number; fill?: string; align?: "left" | "right" | "center" },
  ) {
    const font = opts?.font ?? "F1";
    const size = opts?.size ?? 9;
    setFont(font, size);

    let drawX = x;
    const latin = toPdfLatin(str);
    const estW = latin.length * size * (font === "F2" ? 0.55 : 0.5);

    if (opts?.align === "right") {
      drawX = x - estW;
    } else if (opts?.align === "center") {
      drawX = x - estW / 2;
    }

    if (opts?.fill) ops.push(`${opts.fill} rg`);
    ops.push(`1 0 0 1 ${drawX.toFixed(2)} ${y.toFixed(2)} Tm (${pdfEscape(str)}) Tj`);
    if (opts?.fill) ops.push(`${CHARCOAL} rg`);
  }

  function rect(
    x: number,
    y: number,
    w: number,
    h: number,
    opts?: { fill?: string; stroke?: string; strokeWidth?: number },
  ) {
    ops.push("ET");
    let cmd = "";
    if (opts?.fill) cmd += `${opts.fill} rg `;
    if (opts?.stroke) cmd += `${opts.stroke} RG ${opts.strokeWidth ?? 0.5} w `;
    cmd += `${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re `;
    if (opts?.fill && opts?.stroke) cmd += "B ";
    else if (opts?.fill) cmd += "f ";
    else if (opts?.stroke) cmd += "S ";
    cmd += `0 G ${CHARCOAL} rg BT`;
    ops.push(cmd);
    setFont(currentFont, currentSize);
  }

  function hLine(x1: number, x2: number, y: number, color = BORDER_COLOR, strokeWidth = 0.5) {
    ops.push("ET");
    ops.push(`${color} RG ${strokeWidth} w 1 J ${x1.toFixed(2)} ${y.toFixed(2)} m ${x2.toFixed(2)} ${y.toFixed(2)} l S 0 G ${CHARCOAL} rg BT`);
    setFont(currentFont, currentSize);
  }

  let y = PAGE_H - MARGIN;

  // ==========================================
  // 1. HEADER: Brand (Left) & Document Title (Right)
  // ==========================================
  textAt(legalName.toUpperCase(), MARGIN, y - 16, { font: "F2", size: 20, fill: FOREST });
  textAt("Psychology-led capacity building", MARGIN, y - 28, { font: "F1", size: 8.5, fill: SLATE });
  textAt(seller.address || "Bengaluru, Karnataka, India", MARGIN, y - 38, { font: "F1", size: 8.5, fill: SLATE });
  textAt(
    seller.gstin ? `GSTIN: ${seller.gstin} · State: Karnataka (29)` : "GSTIN: Unregistered · State: Karnataka (29)",
    MARGIN,
    y - 48,
    { font: "F1", size: 8.5, fill: SLATE },
  );

  const rightX = PAGE_W - MARGIN;
  textAt(docTitle, rightX, y - 16, { font: "F2", size: 18, fill: CHARCOAL, align: "right" });
  textAt("ORIGINAL FOR RECIPIENT", rightX, y - 28, { font: "F1", size: 7.5, fill: LIGHT_SLATE, align: "right" });

  const badgeText = statusLabel;
  const badgeW = badgeText.length * 6 + 18;
  const badgeH = 16;
  const badgeX = rightX - badgeW;
  const badgeY = y - 48;
  const badgeBg = isPaid ? GREEN_BG : "0.94 0.94 0.95";
  const badgeFg = isPaid ? GREEN_TEXT : "0.35 0.35 0.40";
  rect(badgeX, badgeY, badgeW, badgeH, { fill: badgeBg, stroke: isPaid ? "0.75 0.90 0.78" : "0.85 0.85 0.88" });
  textAt(badgeText, badgeX + badgeW / 2, badgeY + 4, { font: "F2", size: 8, fill: badgeFg, align: "center" });

  y -= 64;
  hLine(MARGIN, rightX, y, BORDER_COLOR, 0.75);
  y -= 14;

  // ==========================================
  // 2. BILLED TO & INVOICE METADATA (Clean 2 Columns)
  // ==========================================
  const colMid = MARGIN + CONTENT_W * 0.54;

  // Left: BILLED TO
  textAt("Bill to", MARGIN, y, { font: "F2", size: 8, fill: LIGHT_SLATE });
  y -= 12;
  textAt(invoice.customerName, MARGIN, y, { font: "F2", size: 10.5, fill: CHARCOAL });
  y -= 12;
  if (invoice.organisation) {
    textAt(invoice.organisation, MARGIN, y, { font: "F1", size: 8.5, fill: SLATE });
    y -= 11;
  }
  textAt(`Email: ${invoice.customerEmail}`, MARGIN, y, { font: "F1", size: 8.5, fill: SLATE });
  y -= 11;
  if (invoice.customerPhone) {
    textAt(`Phone: ${invoice.customerPhone}`, MARGIN, y, { font: "F1", size: 8.5, fill: SLATE });
    y -= 11;
  }
  textAt(
    invoice.customerGstin ? `GSTIN: ${invoice.customerGstin}` : "GSTIN: Consumer (Unregistered)",
    MARGIN,
    y,
    { font: "F1", size: 8.5, fill: SLATE },
  );
  y -= 11;
  textAt(`Place of Supply: ${supplyStateText}`, MARGIN, y, { font: "F1", size: 8.5, fill: SLATE });

  // Right: INVOICE DETAILS
  let rightY = y + (invoice.organisation ? 11 : 0) + (invoice.customerPhone ? 11 : 0) + 46;
  textAt("INVOICE DETAILS", colMid, rightY, { font: "F2", size: 8, fill: LIGHT_SLATE });
  rightY -= 12;

  const metaRows: [string, string][] = [
    ["Invoice Number:", invoice.number],
    ["Date of Issue:", istDate(invoice.issuedAt ?? invoice.createdAt)],
    ["Payment Due:", invoice.dueAt ? istDate(invoice.dueAt) : "Immediate"],
    ["Payment Status:", isPaid ? `PAID (${istDate(invoice.paidAt)})` : statusLabel],
    ["Payment Mode:", invoice.razorpayPaymentId ? `Online (${invoice.razorpayPaymentId})` : complimentary ? "Promotional Waiver" : "Online / Wire"],
    ["Reverse Charge:", "No"],
  ];

  metaRows.forEach(([lbl, val]) => {
    textAt(lbl, colMid, rightY, { font: "F1", size: 8.5, fill: SLATE });
    textAt(val, rightX, rightY, { font: "F2", size: 8.5, fill: CHARCOAL, align: "right" });
    rightY -= 11;
  });

  y = Math.min(y - 12, rightY - 6);
  hLine(MARGIN, rightX, y, BORDER_COLOR, 0.5);
  y -= 16;

  // ==========================================
  // 3. LINE ITEMS TABLE
  // ==========================================
  const cols = [
    { label: "#", x: MARGIN + 4, align: "left" as const },
    { label: "Description", x: MARGIN + 24, align: "left" as const },
    { label: "SAC", x: MARGIN + 235, align: "center" as const },
    { label: "Qty", x: MARGIN + 280, align: "right" as const },
    { label: "Unit Rate", x: MARGIN + 355, align: "right" as const },
    { label: "Taxable Value", x: MARGIN + 430, align: "right" as const },
    { label: "Total (INR)", x: rightX - 4, align: "right" as const },
  ];

  const tableH = 18;
  rect(MARGIN, y - tableH + 4, CONTENT_W, tableH, { fill: HEADER_BG, stroke: BORDER_COLOR, strokeWidth: 0.5 });
  cols.forEach((col) => {
    textAt(col.label, col.x, y - 8, { font: "F2", size: 8, fill: SLATE, align: col.align });
  });
  y -= tableH + 4;

  const rawInvoiceLines = Array.isArray(invoice.lines) ? invoice.lines.filter(Boolean) : [];
  const effectiveLines: InvoiceLine[] =
    rawInvoiceLines.length > 0
      ? rawInvoiceLines
      : [
          {
            sku: ((invoice as { sku?: InvoiceSku }).sku || "custom") as InvoiceSku,
            label:
              ((invoice as { label?: string }).label?.trim() ||
                "Capacity Building & Assessment Services"),
            qty: (invoice as { qty?: number }).qty || 1,
            unitAmountPaise: invoice.subtotalPaise || invoice.totalPaise,
            gstRate: invoice.gstRate || 18,
            subtotalPaise: invoice.subtotalPaise || invoice.totalPaise,
            gstPaise: invoice.gstPaise || 0,
            totalPaise: invoice.totalPaise,
          },
        ];

  effectiveLines.forEach((line, idx) => {
    let rawLabel = line.label?.trim();
    if (!rawLabel && line.sku) {
      try {
        rawLabel = skuCatalog(line.sku)?.label;
      } catch {
        rawLabel = "Capacity Building & Assessment Services";
      }
    }
    const cleanLabel = (rawLabel || "Capacity Building & Assessment Services")
      .replace(/\s*·\s*Given by Admin/gi, "")
      .trim() || "Capacity Building & Assessment Services";

    const wrappedDesc = wrapPdfLine(cleanLabel, 8.5, 195);
    const rowHeight = Math.max(20, wrappedDesc.length * 11 + 8);

    if (idx % 2 === 1) {
      rect(MARGIN, y - rowHeight + 4, CONTENT_W, rowHeight, { fill: "0.985 0.988 0.992" });
    }

    textAt(String(idx + 1), cols[0].x, y - 8, { font: "F1", size: 8.5, fill: SLATE });

    wrappedDesc.forEach((dLine, dIdx) => {
      textAt(dLine, cols[1].x, y - 8 - dIdx * 11, { font: "F2", size: 8.5, fill: CHARCOAL });
    });

    textAt(sacFor(line), cols[2].x, y - 8, { font: "F1", size: 8.5, fill: SLATE, align: "center" });
    textAt(String(line.qty), cols[3].x, y - 8, { font: "F1", size: 8.5, fill: CHARCOAL, align: "right" });
    textAt(money(line.unitAmountPaise), cols[4].x, y - 8, { font: "F1", size: 8.5, fill: CHARCOAL, align: "right" });
    textAt(money(line.subtotalPaise), cols[5].x, y - 8, { font: "F1", size: 8.5, fill: CHARCOAL, align: "right" });
    textAt(money(line.totalPaise), cols[6].x, y - 8, { font: "F2", size: 8.5, fill: CHARCOAL, align: "right" });

    y -= rowHeight;
    hLine(MARGIN, rightX, y + 4, BORDER_COLOR, 0.5);
  });

  y -= 14;

  // ==========================================
  // 4. SUMMARY & TOTALS
  // ==========================================
  const summaryLeftW = CONTENT_W * 0.52;
  const summaryRightX = rightX;
  const summaryStartY = y;

  // Left: Words & Notes
  let leftY = summaryStartY;
  textAt("Amount in words", MARGIN, leftY, { font: "F2", size: 7.5, fill: LIGHT_SLATE });
  leftY -= 11;
  const words = inrAmountWords(invoice.totalPaise / 100);
  const wrappedWords = wrapPdfLine(words, 8.5, summaryLeftW - 10);
  wrappedWords.forEach((wl) => {
    textAt(wl, MARGIN, leftY, { font: "F2", size: 8.5, fill: FOREST });
    leftY -= 10;
  });

  leftY -= 8;
  textAt("Terms & Notes", MARGIN, leftY, { font: "F2", size: 7.5, fill: LIGHT_SLATE });
  leftY -= 11;
  const wrappedNote = wrapPdfLine(customerNote, 8, summaryLeftW - 10);
  wrappedNote.forEach((nl) => {
    textAt(nl, MARGIN, leftY, { font: "F1", size: 8, fill: SLATE });
    leftY -= 10;
  });

  // Right: Calculation
  let totalsY = summaryStartY;
  const totalsLabelX = MARGIN + summaryLeftW + 20;

  const totalRows: [string, string][] = [
    ["Subtotal:", money(grossTaxable)],
    ...(invoice.discountPaise > 0
      ? [[`Discount${invoice.promoCode ? ` (${invoice.promoCode})` : ""}:`, `-${money(invoice.discountPaise)}`] as [string, string]]
      : []),
    ["Taxable Value:", money(invoice.subtotalPaise)],
    ...(isInterState
      ? [[`IGST (${breakdown.igstRate}%):`, money(breakdown.igstPaise)] as [string, string]]
      : [
          [`CGST (${breakdown.cgstRate}%):`, money(breakdown.cgstPaise)] as [string, string],
          [`SGST (${breakdown.sgstRate}%):`, money(breakdown.sgstPaise)] as [string, string],
        ]),
  ];

  totalRows.forEach(([lbl, val]) => {
    textAt(lbl, totalsLabelX, totalsY, { font: "F1", size: 8.5, fill: SLATE });
    textAt(val, summaryRightX, totalsY, { font: "F1", size: 8.5, fill: CHARCOAL, align: "right" });
    totalsY -= 13;
  });

  totalsY -= 2;
  hLine(totalsLabelX - 4, summaryRightX, totalsY + 3, BORDER_COLOR, 0.75);
  totalsY -= 10;
  rect(totalsLabelX - 4, totalsY - 6, summaryRightX - totalsLabelX + 4, 20, { fill: HEADER_BG, stroke: BORDER_COLOR, strokeWidth: 0.5 });
  textAt("Total Amount (INR):", totalsLabelX, totalsY, { font: "F2", size: 9.5, fill: CHARCOAL });
  textAt(money(invoice.totalPaise), summaryRightX - 4, totalsY, { font: "F2", size: 10.5, fill: FOREST, align: "right" });
  totalsY -= 20;

  textAt("Amount Paid:", totalsLabelX, totalsY, { font: "F1", size: 8.5, fill: SLATE });
  textAt(isPaid ? money(invoice.totalPaise) : "Rs 0.00", summaryRightX, totalsY, { font: "F1", size: 8.5, fill: CHARCOAL, align: "right" });
  totalsY -= 12;

  textAt("Balance Due:", totalsLabelX, totalsY, { font: "F2", size: 8.5, fill: isPaid ? SLATE : "0.75 0.20 0.15" });
  textAt(isPaid ? "Rs 0.00" : money(invoice.totalPaise), summaryRightX, totalsY, { font: "F2", size: 8.5, fill: isPaid ? CHARCOAL : "0.75 0.20 0.15", align: "right" });

  // ==========================================
  // 5. FOOTER
  // ==========================================
  const footerY = MARGIN + 24;
  hLine(MARGIN, rightX, footerY + 12, BORDER_COLOR, 0.5);
  textAt("Authorised signatory · This is a computer-generated tax invoice and requires no physical signature.", PAGE_W / 2, footerY, {
    font: "F1",
    size: 7.5,
    fill: LIGHT_SLATE,
    align: "center",
  });
  textAt(
    `${legalName} · support@lokutara.in · Bengaluru, Karnataka, India`,
    PAGE_W / 2,
    footerY - 10,
    { font: "F1", size: 7.5, fill: LIGHT_SLATE, align: "center" },
  );

  ops.push("ET");
  ops.push("1 1 1 rg 0 0 0 rg");
  const stream = ops.join("\n");

  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(""); // placeholder pages
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  const contentId = 5;
  const pageId = 6;
  objects.push(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
  objects.push(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`,
  );

  objects[1] = `<< /Type /Pages /Kids [${pageId} 0 R] /Count 1 >>`;

  let out = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n`;
  out += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i += 1) {
    out += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, "latin1");
}
