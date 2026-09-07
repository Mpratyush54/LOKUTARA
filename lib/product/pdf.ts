const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 54;
const CONTENT_W = PAGE_W - MARGIN * 2;

export function toPdfLatin(text: string): string {
  return text
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/·/g, "-")
    .replace(/₹/g, "Rs ")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "");
}

function pdfEscape(text: string): string {
  return toPdfLatin(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function wrapPdfLine(text: string, size: number, width = CONTENT_W): string[] {
  const max = Math.max(18, Math.floor(width / (size * 0.5)));
  const words = toPdfLatin(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

type PdfRun = { text: string; size: number; gap: number };

export type LabScorecard = {
  score: number;
  max?: number;
  title: string;
  subtitle?: string;
  badge?: string;
};

export type LabMeter = {
  label: string;
  score: number;
  max?: number;
  level: string;
  copy?: string;
};

export type LabCard = {
  title?: string;
  lines: string[];
  bg?: "sand" | "gray" | "surface";
  accent?: boolean;
};

export type LabSection = {
  heading?: string;
  subheading?: string;
  lines?: string[];
  cols?: { left: string[]; right: string[] };
  tableWidths?: number[];
  scorecard?: LabScorecard;
  card?: LabCard;
  meters?: LabMeter[];
};

type LabTable = { head: string[]; rows: string[][]; widths?: number[] };
type LabBlock =
  | { type: "text"; size: number; gap: number; text: string; font?: string; fill?: string }
  | { type: "heading"; text: string; subheading?: string }
  | { type: "table"; table: LabTable }
  | { type: "cols"; left: string[]; right: string[] }
  | { type: "right"; text: string; size: number; gap: number }
  | { type: "scorecard"; scorecard: LabScorecard }
  | { type: "card"; card: LabCard }
  | { type: "meters"; meters: LabMeter[] }
  | { type: "space"; gap: number };

const TABLE_COLS = [0.34, 0.1, 0.14, 0.42];

function wrapCell(text: string, maxChars: number): string[] {
  const latin = toPdfLatin(text);
  // Keep short currency / numeric cells on one line so totals do not shatter.
  if (latin.length <= maxChars || !/\s/.test(latin)) return [latin || ""];
  const words = latin.split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function parseTable(lines: string[], widths?: number[]): LabTable {
  const rows = lines.map((line) => line.slice(2).split(" | ").map((cell) => cell.trim()));
  return { head: rows[0] ?? [], rows: rows.slice(1), widths };
}

/**
 * Professional lab & commercial PDF engine:
 * Letterhead, brand header band with status badges, scorecards with progress bars,
 * trait meters, styled cards, ruled tables with alternating zebra rows, and page footers.
 */
export function buildLabPdf(input: {
  letterhead: string[];
  title: string;
  meta: string[];
  sections: LabSection[];
  footer: string[];
  band?: { title: string; sub: string; badge?: string };
}): Uint8Array {
  const blocks: LabBlock[] = [];
  for (const meta of input.meta) {
    for (const part of meta.split("\n")) {
      for (const wrapped of wrapPdfLine(part, 10)) blocks.push({ type: "text", size: 10, gap: 13, text: wrapped });
    }
  }
  blocks.push({ type: "space", gap: 10 });
  for (const section of input.sections) {
    if (section.heading) blocks.push({ type: "heading", text: section.heading, subheading: section.subheading });
    if (section.scorecard) blocks.push({ type: "scorecard", scorecard: section.scorecard });
    if (section.card) blocks.push({ type: "card", card: section.card });
    if (section.meters?.length) blocks.push({ type: "meters", meters: section.meters });
    if (section.cols) blocks.push({ type: "cols", left: section.cols.left, right: section.cols.right });
    let pendingTable: string[] = [];
    const flushTable = () => {
      if (pendingTable.length) blocks.push({ type: "table", table: parseTable(pendingTable, section.tableWidths) });
      pendingTable = [];
    };
    if (section.lines) {
      for (const raw of section.lines) {
        for (const line of raw.split("\n")) {
          if (!line.trim()) {
            flushTable();
            blocks.push({ type: "space", gap: 8 });
            continue;
          }
          if (line.startsWith("| ")) {
            pendingTable.push(line);
            continue;
          }
          flushTable();
          if (line.startsWith(">> ")) {
            for (const wrapped of wrapPdfLine(line.slice(3), 10)) blocks.push({ type: "right", text: wrapped, size: 10, gap: 13 });
            continue;
          }
          const text = line.startsWith("- ") ? `\u2022 ${line.slice(2)}` : line;
          for (const wrapped of wrapPdfLine(text, 10)) blocks.push({ type: "text", size: 10, gap: 13, text: wrapped });
        }
      }
    }
    flushTable();
    blocks.push({ type: "space", gap: 10 });
  }

  const headerRuns = input.letterhead.map((text) => ({ text, size: 10, gap: 12 }));
  const footerRuns = input.footer;

  const pageStreams: string[] = [];
  let pageNo = 0;
  let y = PAGE_H - MARGIN;
  let ops: string[] = [`BT`, `/F1 10 Tf`];
  let currentSize = 10;
  let currentFont = "F1";

  const FOREST_FILL = "0.094 0.235 0.208";
  const ACCENT_FILL = "0.722 0.435 0.361";
  const SAGE_FILL = "0.486 0.604 0.537";

  function setFont(font: string, size: number) {
    if (font !== currentFont || size !== currentSize) {
      ops.push(`/${font} ${size} Tf`);
      currentFont = font;
      currentSize = size;
    }
  }

  function textAt(text: string, x: number, yy: number, size: number, opts?: { font?: string; fill?: string }) {
    setFont(opts?.font ?? "F1", size);
    const fill = opts?.fill ? `${opts.fill} rg ` : "";
    ops.push(`${fill}1 0 0 1 ${x.toFixed(2)} ${yy.toFixed(2)} Tm (${pdfEscape(text)}) Tj`);
    if (opts?.fill) ops.push(`0 0 0 rg`);
  }

  /** Right-aligned text. Width estimated for Helvetica at the given size. */
  function textRight(text: string, yy: number, size: number, opts?: { font?: string }) {
    const est = toPdfLatin(text).length * size * (opts?.font === "F2" ? 0.58 : 0.5);
    textAt(text, PAGE_W - MARGIN - est, yy, size, opts);
  }

  function paintChrome() {
    let hy = PAGE_H - 30;
    for (const run of headerRuns) {
      textAt(run.text, MARGIN, hy, run.size);
      hy -= run.gap;
    }
    let fy = MARGIN - 26;
    for (const line of footerRuns) {
      textAt(line, MARGIN, fy, 8);
      fy -= 10;
    }
    textAt(`Page ${pageNo + 1}`, PAGE_W - MARGIN - 48, MARGIN - 26, 8);
  }

  function endPage() {
    paintChrome();
    ops.push("ET");
    pageStreams.push(ops.join("\n"));
    pageNo += 1;
    setFont("F1", currentSize);
    ops = [`BT`, `/${currentFont} ${currentSize} Tf`];
    y = PAGE_H - MARGIN - 28;
  }

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN) endPage();
  }

  function rule(atY: number, color = "0.75 G") {
    ops.push("ET");
    ops.push(`${color} 0.75 w 1 J ${MARGIN.toFixed(2)} ${atY.toFixed(2)} m ${(PAGE_W - MARGIN).toFixed(2)} ${atY.toFixed(2)} l S 0 G BT`);
    setFont(currentFont, currentSize);
  }

  function renderTable(table: LabTable) {
    const fracs = table.widths ?? TABLE_COLS;
    const colW = fracs.map((frac) => Math.floor(CONTENT_W * frac));
    const renderRow = (cells: string[], size: number, gap: number, head = false, isEven = false) => {
      const maxChars = colW.map((w) => Math.max(10, Math.floor(w / (size * 0.48))));
      const padded = [...cells];
      while (padded.length < colW.length) padded.push("");
      const wrapped = padded.map((cell, i) => wrapCell(cell, maxChars[Math.min(i, maxChars.length - 1)]));
      const height = Math.max(...wrapped.map((lines) => lines.length));
      ensureSpace(height * gap + 6);
      const top = y + 4;
      const rowH = height * gap + 4;

      if (head) {
        // Forest header background, white bold text.
        ops.push("ET");
        ops.push(
          `${FOREST_FILL} rg ${MARGIN.toFixed(2)} ${(top - rowH).toFixed(2)} ${CONTENT_W.toFixed(2)} ${rowH.toFixed(2)} re f 0 G BT`,
        );
        setFont("F2", size);
      } else if (isEven) {
        // Subtle zebra striping for even data rows.
        ops.push("ET");
        ops.push(
          `0.975 0.975 0.975 rg ${MARGIN.toFixed(2)} ${(top - rowH).toFixed(2)} ${CONTENT_W.toFixed(2)} ${rowH.toFixed(2)} re f 0 G BT`,
        );
        setFont("F1", size);
      }

      for (let r = 0; r < height; r += 1) {
        let x = MARGIN + 6;
        wrapped.forEach((lines, i) => {
          textAt(lines[r] ?? "", x, y, size, head ? { font: "F2", fill: "1 1 1" } : undefined);
          x += colW[Math.min(i, colW.length - 1)];
        });
        y -= gap;
      }
      if (head) {
        ops.push("ET");
        ops.push(`0 G BT`);
        setFont("F1", currentSize);
      }
      // Row bottom border
      ops.push("ET");
      ops.push(`0.88 0.88 0.88 RG 0.5 w ${MARGIN.toFixed(2)} ${(top - rowH).toFixed(2)} m ${(PAGE_W - MARGIN).toFixed(2)} ${(top - rowH).toFixed(2)} l S 0 G BT`);
      setFont(currentFont, currentSize);
      y -= 2;
    };

    ensureSpace(22);
    renderRow(table.head, 9.5, 12, true);
    table.rows.forEach((row, idx) => {
      renderRow(row, 9, 12, false, idx % 2 === 1);
    });
    y -= 4;
  }

  function renderCols(left: string[], right: string[]) {
    const halfW = CONTENT_W / 2 - 6;
    const midX = MARGIN + CONTENT_W / 2 + 6;
    const leftLines = left.flatMap((line) => wrapPdfLine(line, 9, halfW - 16));
    const rightLines = right.flatMap((line) => wrapPdfLine(line, 9, halfW - 16));
    const height = Math.max(leftLines.length, rightLines.length);
    const cardH = height * 12 + 16;
    ensureSpace(cardH + 8);
    const top = y;

    // Draw left card box
    ops.push("ET");
    ops.push(`0.98 0.98 0.98 rg 0.88 0.88 0.88 RG 0.75 w ${MARGIN.toFixed(2)} ${(top - cardH).toFixed(2)} ${halfW.toFixed(2)} ${cardH.toFixed(2)} re B 0 G BT`);
    setFont("F1", currentSize);
    leftLines.forEach((line, i) => {
      const isFirst = i === 0;
      textAt(line, MARGIN + 8, top - 12 - i * 12, isFirst ? 9.5 : 8.5, isFirst ? { font: "F2", fill: FOREST_FILL } : undefined);
    });

    // Draw right card box
    ops.push("ET");
    ops.push(`0.98 0.98 0.98 rg 0.88 0.88 0.88 RG 0.75 w ${midX.toFixed(2)} ${(top - cardH).toFixed(2)} ${halfW.toFixed(2)} ${cardH.toFixed(2)} re B 0 G BT`);
    setFont("F1", currentSize);
    rightLines.forEach((line, i) => {
      const isFirst = i === 0;
      textAt(line, midX + 8, top - 12 - i * 12, isFirst ? 9.5 : 8.5, isFirst ? { font: "F2", fill: FOREST_FILL } : undefined);
    });

    y = top - cardH - 10;
  }

  function renderCard(card: LabCard) {
    const wrapped = card.lines.flatMap((l) => wrapPdfLine(l, 9, CONTENT_W - 24));
    const cardH = (card.title ? 16 : 0) + wrapped.length * 12 + 16;
    ensureSpace(cardH + 6);
    const top = y;

    const bgFill = card.bg === "sand" ? "0.965 0.95 0.92" : card.bg === "gray" ? "0.96 0.96 0.96" : "1 1 1";
    ops.push("ET");
    ops.push(`${bgFill} rg 0.85 0.85 0.85 RG 0.75 w ${MARGIN.toFixed(2)} ${(top - cardH).toFixed(2)} ${CONTENT_W.toFixed(2)} ${cardH.toFixed(2)} re B `);
    if (card.accent) {
      // Left accent stripe
      ops.push(`${ACCENT_FILL} rg ${MARGIN.toFixed(2)} ${(top - cardH).toFixed(2)} 3.5 ${cardH.toFixed(2)} re f `);
    }
    ops.push("0 G BT");
    setFont("F1", currentSize);

    let curY = top - 12;
    if (card.title) {
      textAt(card.title, MARGIN + 12, curY, 10, { font: "F2", fill: FOREST_FILL });
      curY -= 14;
    }
    wrapped.forEach((line) => {
      textAt(line, MARGIN + 12, curY, 8.5);
      curY -= 12;
    });

    y = top - cardH - 8;
  }

  function renderScorecard(sc: LabScorecard) {
    const cardH = 64;
    ensureSpace(cardH + 10);
    const top = y;
    const maxVal = sc.max ?? 100;
    const pct = Math.max(0, Math.min(1, sc.score / maxVal));

    // Card background & subtle border
    ops.push("ET");
    ops.push(`0.97 0.96 0.935 rg 0.86 0.83 0.78 RG 0.75 w ${MARGIN.toFixed(2)} ${(top - cardH).toFixed(2)} ${CONTENT_W.toFixed(2)} ${cardH.toFixed(2)} re B `);
    // Accent edge
    ops.push(`${FOREST_FILL} rg ${MARGIN.toFixed(2)} ${(top - cardH).toFixed(2)} 4 ${cardH.toFixed(2)} re f 0 G BT`);
    setFont("F1", currentSize);

    // Big Score
    textAt(String(sc.score), MARGIN + 16, top - 32, 26, { font: "F2", fill: FOREST_FILL });
    const scoreNumWidth = String(sc.score).length * 16;
    textAt(` / ${maxVal}`, MARGIN + 16 + scoreNumWidth, top - 24, 11, { font: "F1", fill: "0.45 0.45 0.45" });

    // Progress bar under score
    const barW = 110;
    const barH = 5;
    const barY = top - 48;
    ops.push("ET");
    ops.push(`0.84 0.84 0.84 rg ${(MARGIN + 16).toFixed(2)} ${barY.toFixed(2)} ${barW.toFixed(2)} ${barH.toFixed(2)} re f `);
    ops.push(`${FOREST_FILL} rg ${(MARGIN + 16).toFixed(2)} ${barY.toFixed(2)} ${(barW * pct).toFixed(2)} ${barH.toFixed(2)} re f 0 G BT`);
    setFont("F1", currentSize);

    // Right details
    const textX = MARGIN + 148;
    textAt(sc.title, textX, top - 22, 12, { font: "F2", fill: FOREST_FILL });
    if (sc.subtitle) {
      const subLines = wrapPdfLine(sc.subtitle, 9, CONTENT_W - 160);
      subLines.slice(0, 2).forEach((l, i) => textAt(l, textX, top - 36 - i * 11, 8.5, { fill: "0.35 0.35 0.35" }));
    }
    if (sc.badge) {
      const badgeW = sc.badge.length * 6 + 14;
      const badgeX = PAGE_W - MARGIN - badgeW - 10;
      ops.push("ET");
      ops.push(`${SAGE_FILL} rg ${badgeX.toFixed(2)} ${(top - 24).toFixed(2)} ${badgeW.toFixed(2)} 16 re f 0 G BT`);
      textAt(sc.badge, badgeX + 7, top - 20, 8, { font: "F2", fill: "1 1 1" });
    }

    y = top - cardH - 12;
  }

  function renderMeters(meters: LabMeter[]) {
    meters.forEach((meter) => {
      ensureSpace(42);
      const top = y;
      const max = meter.max ?? 100;
      const pct = Math.max(0, Math.min(1, meter.score / max));

      // Trait label
      textAt(meter.label, MARGIN, top, 10, { font: "F2", fill: FOREST_FILL });
      // Score and Level
      const levelText = `${meter.score} / ${max} · ${meter.level}`;
      textRight(levelText, top, 9, { font: "F2" });

      // Visual meter track
      const barTop = top - 8;
      const barH = 5;
      ops.push("ET");
      ops.push(`0.90 0.90 0.90 rg ${MARGIN.toFixed(2)} ${barTop.toFixed(2)} ${CONTENT_W.toFixed(2)} ${barH.toFixed(2)} re f `);
      const fillCol = meter.level.toLowerCase().includes("lower") ? ACCENT_FILL : FOREST_FILL;
      ops.push(`${fillCol} rg ${MARGIN.toFixed(2)} ${barTop.toFixed(2)} ${(CONTENT_W * pct).toFixed(2)} ${barH.toFixed(2)} re f 0 G BT`);
      setFont("F1", currentSize);

      // Description text
      if (meter.copy) {
        const lines = wrapPdfLine(meter.copy, 8.5, CONTENT_W);
        lines.slice(0, 2).forEach((l, i) => textAt(l, MARGIN, barTop - 9 - i * 10, 8, { fill: "0.4 0.4 0.4" }));
        y = barTop - 12 - lines.slice(0, 2).length * 10;
      } else {
        y = barTop - 10;
      }
    });
    y -= 4;
  }

  /** Forest header band with the wordmark — the PDF "logo". */
  function renderBand(title: string, sub: string, badge?: string) {
    const bandH = 58;
    ensureSpace(bandH + 10);
    const bandTop = y + 18;
    ops.push("ET");
    ops.push(`${FOREST_FILL} rg ${MARGIN.toFixed(2)} ${(bandTop - bandH).toFixed(2)} ${CONTENT_W.toFixed(2)} ${bandH.toFixed(2)} re f 0 G BT`);
    setFont("F1", currentSize);
    ops.push("ET");
    ops.push(`1 1 1 rg BT`);
    setFont("F2", 20);
    ops.push(`1 0 0 1 ${(MARGIN + 14).toFixed(2)} ${(bandTop - 28).toFixed(2)} Tm (${pdfEscape(title)}) Tj ET`);
    ops.push(`BT`);
    setFont("F1", 9);
    ops.push(`1 0 0 1 ${(MARGIN + 14).toFixed(2)} ${(bandTop - 42).toFixed(2)} Tm (${pdfEscape(sub)}) Tj ET`);

    if (badge) {
      const badgeW = toPdfLatin(badge).length * 6 + 18;
      const badgeH = 20;
      const badgeX = PAGE_W - MARGIN - badgeW - 14;
      const badgeY = bandTop - 34;
      ops.push("ET");
      ops.push(`${ACCENT_FILL} rg ${badgeX.toFixed(2)} ${badgeY.toFixed(2)} ${badgeW.toFixed(2)} ${badgeH.toFixed(2)} re f 0 G BT`);
      textAt(badge, badgeX + 9, badgeY + 6, 9, { font: "F2", fill: "1 1 1" });
    }

    // Accent keyline under the band, then reset to black body text.
    ops.push(`${ACCENT_FILL} RG 2 w 1 J ${MARGIN.toFixed(2)} ${(bandTop - bandH).toFixed(2)} m ${(PAGE_W - MARGIN).toFixed(2)} ${(bandTop - bandH).toFixed(2)} l S 0 G`);
    ops.push(`0 0 0 rg BT`);
    setFont("F1", 10);
    currentSize = 10;
    y = bandTop - bandH - 14;
  }

  if (input.band) {
    renderBand(input.band.title, input.band.sub, input.band.badge);
  } else {
    textAt(input.title, MARGIN, PAGE_H - MARGIN - 28, 18, { font: "F2", fill: FOREST_FILL });
    rule(PAGE_H - MARGIN - 34, `${ACCENT_FILL} RG`);
    y = PAGE_H - MARGIN - 48;
  }
  for (const block of blocks) {
    if (block.type === "space") {
      y -= block.gap;
      continue;
    }
    if (block.type === "heading") {
      ensureSpace(24);
      textAt(block.text, MARGIN, y, 12, { font: "F2", fill: FOREST_FILL });
      if (block.subheading) {
        textRight(block.subheading, y, 8.5, { font: "F1" });
      }
      rule(y - 4, `${ACCENT_FILL} RG`);
      y -= 14;
      continue;
    }
    if (block.type === "scorecard") {
      renderScorecard(block.scorecard);
      continue;
    }
    if (block.type === "meters") {
      renderMeters(block.meters);
      continue;
    }
    if (block.type === "card") {
      renderCard(block.card);
      continue;
    }
    if (block.type === "right") {
      ensureSpace(block.gap);
      textRight(block.text, y, block.size, { font: block.size > 9 ? "F2" : "F1" });
      y -= block.gap;
      continue;
    }
    if (block.type === "table") {
      renderTable(block.table);
      continue;
    }
    if (block.type === "cols") {
      renderCols(block.left, block.right);
      continue;
    }
    ensureSpace(block.gap);
    textAt(block.text, MARGIN, y, block.size, block.font ? { font: block.font, fill: block.fill } : undefined);
    y -= block.gap;
  }
  endPage();

  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  const pageIds: number[] = [];
  const fontId = 3;
  const fontBoldId = 4;
  objects.push(""); // placeholder pages
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  const contentIds: number[] = [];
  for (const stream of pageStreams) {
    const contentId = objects.length + 1;
    contentIds.push(contentId);
    objects.push(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
    const pageId = objects.length + 1;
    pageIds.push(pageId);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
  }

  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

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

export function buildSimplePdf(title: string, blocks: string[]): Uint8Array {
  const runs: PdfRun[] = [{ text: title, size: 18, gap: 16 }];
  for (const block of blocks) {
    const lines = block.split("\n");
    for (const line of lines) {
      if (!line.trim()) {
        runs.push({ text: " ", size: 10, gap: 8 });
        continue;
      }
      const size = line.startsWith("# ") ? 13 : 10;
      const text = line.startsWith("# ") ? line.slice(2) : line;
      for (const wrapped of wrapPdfLine(text, size)) {
        runs.push({ text: wrapped, size, gap: size === 13 ? 14 : 13 });
      }
    }
    runs.push({ text: " ", size: 10, gap: 10 });
  }

  const pageStreams: string[] = [];
  let y = PAGE_H - MARGIN;
  let ops: string[] = [`BT`, `/F1 10 Tf`];
  let currentSize = 10;

  function flushPage() {
    ops.push("ET");
    pageStreams.push(ops.join("\n"));
    ops = [`BT`, `/F1 ${currentSize} Tf`];
    y = PAGE_H - MARGIN;
  }

  for (const run of runs) {
    if (y - run.gap < MARGIN) flushPage();
    if (run.size !== currentSize) {
      ops.push(`/F1 ${run.size} Tf`);
      currentSize = run.size;
    }
    ops.push(`1 0 0 1 ${MARGIN.toFixed(2)} ${y.toFixed(2)} Tm (${pdfEscape(run.text)}) Tj`);
    y -= run.gap;
  }
  flushPage();

  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  const pageIds: number[] = [];
  const fontId = 3;
  objects.push(""); // placeholder pages
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  const contentIds: number[] = [];
  for (const stream of pageStreams) {
    const contentId = objects.length + 1;
    contentIds.push(contentId);
    objects.push(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
    const pageId = objects.length + 1;
    pageIds.push(pageId);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
  }

  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

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
