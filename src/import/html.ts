// ============================================================
// Just enough HTML reading for imports, without a DOM: meta tags,
// JSON-LD blocks and the readable text of a page.
// ============================================================

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', frac12: '½', frac14: '¼', frac34: '¾', deg: '°', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', uuml: 'ü', ouml: 'ö', auml: 'ä', szlig: 'ß', ntilde: 'ñ' };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]\w*);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  return m ? decodeEntities(m[1] ?? m[2] ?? m[3] ?? '') : null;
}

/** The content of <meta property|name="key">. */
export function meta(html: string, key: string): string | null {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    if ((attr(tag, 'property') ?? attr(tag, 'name'))?.toLowerCase() === key.toLowerCase()) {
      const content = attr(tag, 'content');
      if (content) return content.trim();
    }
  }
  return null;
}

export function pageTitle(html: string): string | null {
  const og = meta(html, 'og:title');
  if (og) return og;
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return m ? decodeEntities(m[1]!).trim() || null : null;
}

/** Every JSON-LD block that parses. */
export function jsonLd(html: string): unknown[] {
  const out: unknown[] = [];
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    const body = m[1]!.trim().replace(/^<!\[CDATA\[|\]\]>$/g, '');
    try {
      out.push(JSON.parse(body));
    } catch {
      // Some sites put stray control characters in their JSON.
      try {
        out.push(JSON.parse(body.replace(/\p{Cc}+/gu, ' ')));
      } catch {
        // Not usable.
      }
    }
  }
  return out;
}

/** HTML to text: block elements become line breaks, everything else goes. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|template|iframe)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?(?:p|div|li|ul|ol|h[1-6]|tr|section|article|header|footer|blockquote|figure|figcaption|dd|dt)\b[^>]*>/gi, '\n')
      .replace(/<\/?(?:a|b|i|em|strong|span|small|sup|sub|u|mark|abbr|time)\b[^>]*>/gi, '')
      .replace(/<[^>]+>/g, ' '),
  )
    .split('\n')
    .map((l) => l.replace(/[ \t\u00a0]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

/** The readable part of a page: its <article> or <main> when it has one, without the site's furniture. */
export function mainText(html: string): string {
  const pick = (tag: string) => {
    const m = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*)<\\/${tag}>`, 'i').exec(html);
    return m ? m[1]! : null;
  };
  const body = pick('article') ?? pick('main') ?? pick('body') ?? html;
  return htmlToText(body.replace(/<(nav|header|footer|aside|form)\b[\s\S]*?<\/\1>/gi, '\n'));
}
