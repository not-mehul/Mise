// ============================================================
// Instagram: the caption of a public post or reel, read from the
// page Instagram serves to link previews. Instagram changes these
// pages and blocks automated readers, so when nothing comes back
// Mise asks for the caption to be pasted instead.
// ============================================================

import { htmlToText, meta } from './html';

export function isInstagram(url: string): boolean {
  try {
    const u = new URL(url);
    return /(^|\.)instagram\.com$/i.test(u.hostname) && /^\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/[\w-]+/i.test(u.pathname);
  } catch {
    return false;
  }
}

/** The post's page without tracking parameters, and its captioned embed. */
export function instagramUrls(url: string): { page: string; embed: string } {
  const u = new URL(url);
  const m = /\/(p|reel|reels|tv)\/([\w-]+)/i.exec(u.pathname)!;
  const kind = m[1]!.toLowerCase() === 'reels' ? 'reel' : m[1]!.toLowerCase();
  const page = `https://www.instagram.com/${kind}/${m[2]}/`;
  return { page, embed: `https://www.instagram.com/p/${m[2]}/embed/captioned/` };
}

export interface Caption {
  caption: string;
  author?: string;
}

/** "@handle" for a handle; a display name ("Jamie Oliver") is kept as written, never made into a handle. */
function authorFrom(text: string): string | undefined {
  const name = text.trim().replace(/^@/, '');
  if (!name) return undefined;
  return /^[\w.]+$/.test(name) ? `@${name}` : name;
}

/**
 * The caption from the post page. Its og:description reads
 * `12 likes, 3 comments - handle on March 1, 2026: "caption"`; og:title
 * reads `Name on Instagram: "caption"`.
 */
export function captionFromPage(html: string): Caption | null {
  for (const key of ['og:description', 'description', 'og:title', 'twitter:title']) {
    const v = meta(html, key);
    if (!v) continue;
    const m = /^(?:[\d.,\s]*[kKmM]?\s*\S+,\s*[\d.,\s]*[kKmM]?\s*\S+\s*-\s*)?(.+?)\s+(?:on|en|sur|auf)\s+(?:Instagram|[^:]{3,40}?)\s*:\s*["“](.+)["”]\s*\.?$/s.exec(v);
    if (m) return { caption: m[2]!.trim(), author: authorFrom(m[1]!) };
  }
  return null;
}

/** The caption from the embed page, which renders it as HTML. */
export function captionFromEmbed(html: string): Caption | null {
  const block = /<div\b[^>]*class\s*=\s*["'][^"']*\bCaption\b[^"']*["'][^>]*>([\s\S]*?)<div\b[^>]*class\s*=\s*["'][^"']*\bCaptionComments\b/i.exec(html);
  if (!block) return null;
  const username = /<a\b[^>]*class\s*=\s*["'][^"']*\bCaptionUsername\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/i.exec(block[1]!);
  const body = block[1]!.replace(/<a\b[^>]*class\s*=\s*["'][^"']*\bCaptionUsername\b[^"']*["'][^>]*>[\s\S]*?<\/a>/i, '');
  const caption = htmlToText(body).trim();
  if (!caption) return null;
  const handle = username ? htmlToText(username[1]!).trim() : '';
  return { caption, author: handle ? `@${handle.replace(/^@/, '')}` : undefined };
}
