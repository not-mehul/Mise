// ============================================================
// Recognised text blocks → text in reading order. Recipe cards and
// cookbook pages often run in two columns (ingredients beside the
// method), so blocks are read column by column, left to right, with
// anything that spans the page (a title) breaking the page into bands.
// ============================================================

export interface TextBlock {
  lines: string[];
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

type Boxed = TextBlock & { x: number; y: number; w: number; h: number };

const hasBox = (b: TextBlock): b is Boxed => [b.x, b.y, b.w, b.h].every((n) => typeof n === 'number' && Number.isFinite(n));

/** How much of the narrower block's width the two share. */
function overlap(a: { x: number; w: number }, b: { x: number; w: number }): number {
  const shared = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  return shared / Math.max(1, Math.min(a.w, b.w));
}

function columns(blocks: Boxed[]): Boxed[] {
  const cols: { x: number; w: number; blocks: Boxed[] }[] = [];
  for (const b of [...blocks].sort((p, q) => p.x - q.x)) {
    const col = cols.find((c) => overlap(c, b) > 0.4);
    if (col) {
      const right = Math.max(col.x + col.w, b.x + b.w);
      col.x = Math.min(col.x, b.x);
      col.w = right - col.x;
      col.blocks.push(b);
    } else cols.push({ x: b.x, w: b.w, blocks: [b] });
  }
  return cols.sort((a, b) => a.x - b.x).flatMap((c) => c.blocks.sort((p, q) => p.y - q.y));
}

/** The blocks in reading order. Blocks without a box keep the order they came in, after the rest. */
export function orderBlocks(blocks: TextBlock[], pageWidth?: number): TextBlock[] {
  const boxed = blocks.filter(hasBox);
  const loose = blocks.filter((b) => !hasBox(b));
  if (boxed.length < 2) return [...boxed, ...loose];
  const width = pageWidth ?? Math.max(...boxed.map((b) => b.x + b.w)) - Math.min(...boxed.map((b) => b.x));
  const out: TextBlock[] = [];
  let band: Boxed[] = [];
  for (const b of [...boxed].sort((p, q) => p.y - q.y)) {
    if (b.w >= width * 0.6) {
      out.push(...columns(band), b);
      band = [];
    } else band.push(b);
  }
  out.push(...columns(band));
  return [...out, ...loose];
}

/**
 * One block's lines as text. A line that runs on (no closing punctuation,
 * next line starting in lower case) is joined to the next, so wrapped
 * steps come back as one step.
 */
function blockText(lines: string[]): string {
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const prev = out[out.length - 1];
    if (prev !== undefined && !/[.:!?;)]$/.test(prev) && /^\p{Ll}/u.test(line)) out[out.length - 1] = `${prev} ${line}`;
    else out.push(line);
  }
  return out.join('\n');
}

/** The text of one or more photos, each in reading order, one after another. */
export function photosToText(pages: { blocks: TextBlock[]; width?: number }[]): string {
  return pages
    .map((page) => orderBlocks(page.blocks, page.width).map((b) => blockText(b.lines)).filter(Boolean).join('\n'))
    .filter(Boolean)
    .join('\n');
}
