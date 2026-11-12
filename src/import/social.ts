// ============================================================
// Recipes that live in a post's caption or a video's description
// rather than on a recipe page: TikTok, YouTube (and Shorts), and
// anything else that puts its text in a link preview (Facebook,
// Threads, Pinterest, X). Each reader returns the caption; web.ts
// reads it like pasted text.
// ============================================================

import { decodeEntities, meta, pageTitle } from './html';

export interface SocialCaption {
  caption: string;
  author?: string;
  imageUrl?: string | null;
}

function host(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^(?:www|m|vm|vt|mobile)\./, '');
  } catch {
    return '';
  }
}

export function isTikTok(url: string): boolean {
  return /(^|\.)tiktok\.com$/.test(host(url));
}

export function isYouTube(url: string): boolean {
  return /(^|\.)(youtube\.com|youtu\.be)$/.test(host(url));
}

/** A video id from any YouTube link: watch?v=, youtu.be/, /shorts/, /live/. */
export function youTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (/youtu\.be$/i.test(u.hostname)) return u.pathname.slice(1).split('/')[0] || null;
    return u.searchParams.get('v') ?? /\/(?:shorts|live|embed)\/([\w-]{6,})/.exec(u.pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}

/** The address of TikTok's public oEmbed for a video, which carries its caption as `title`. */
export function tikTokOembed(url: string): string {
  return `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
}

export function captionFromTikTokOembed(json: string): SocialCaption | null {
  try {
    const data = JSON.parse(json) as { title?: unknown; author_name?: unknown; author_unique_id?: unknown; thumbnail_url?: unknown };
    const caption = typeof data.title === 'string' ? data.title.trim() : '';
    if (!caption) return null;
    const handle = typeof data.author_unique_id === 'string' && data.author_unique_id ? `@${data.author_unique_id}` : typeof data.author_name === 'string' ? data.author_name : undefined;
    return { caption, author: handle, imageUrl: typeof data.thumbnail_url === 'string' ? data.thumbnail_url : null };
  } catch {
    return null;
  }
}

/** A TikTok page's own data: the "desc" of the video. */
export function captionFromTikTokPage(html: string): SocialCaption | null {
  const desc = /"desc"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(html);
  const caption = desc ? jsonString(desc[1]!) : (meta(html, 'og:description') ?? '');
  if (!caption.trim()) return null;
  const author = /"uniqueId"\s*:\s*"([\w.]+)"/.exec(html)?.[1];
  return { caption: caption.trim(), author: author ? `@${author}` : undefined, imageUrl: meta(html, 'og:image') };
}

/** A YouTube watch page: the full description (with the recipe in it), under the title. */
export function captionFromYouTube(html: string): SocialCaption | null {
  const desc = /"shortDescription"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(html);
  const text = desc ? jsonString(desc[1]!) : (meta(html, 'og:description') ?? '');
  if (!text.trim()) return null;
  const title = (pageTitle(html) ?? '').replace(/\s*-\s*YouTube$/i, '').trim();
  const author = /"ownerChannelName"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(html)?.[1];
  return {
    caption: [title, text.trim()].filter(Boolean).join('\n'),
    author: author ? jsonString(author) : undefined,
    imageUrl: meta(html, 'og:image'),
  };
}

/**
 * Any page's link-preview text, when it is long enough to hold a recipe. Many apps
 * (Facebook, Threads, Pinterest) put the whole post there and little else on the page.
 */
export function captionFromPreview(html: string): SocialCaption | null {
  const text = meta(html, 'og:description') ?? meta(html, 'description') ?? meta(html, 'twitter:description');
  if (!text || text.length < 40) return null;
  const title = pageTitle(html);
  return { caption: [title, decodeEntities(text)].filter(Boolean).join('\n'), imageUrl: meta(html, 'og:image') };
}

function jsonString(body: string): string {
  try {
    return JSON.parse(`"${body}"`) as string;
  } catch {
    return body.replace(/\\n/g, '\n');
  }
}
