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

export function wrapPdfLine(text: string, size: number): string[] {
  const max = Math.max(18, Math.floor(CONTENT_W / (size * 0.5)));
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
