// ============================================================
// A link → a recipe draft. The phone fetches the page itself (no
// server between): schema.org first, which most recipe sites publish,
// then Instagram's caption, then the page's main text through the same
// parser as pasted text. Nothing is saved here; the draft goes to the
// review screen.
// ============================================================

import { CapacitorHttp } from '@capacitor/core';
import { isNative } from '../platform/output';
import { jsonLd, mainText, meta, pageTitle } from './html';
import { captionFromEmbed, captionFromPage, instagramUrls, isInstagram } from './instagram';
import { draftFromSchema, findRecipe, microdataRecipe } from './schema';
import { parseRecipeText } from './text';
import type { RecipeDraft, SourceKind } from '../domain/recipe';
import { captionFromPreview, captionFromTikTokOembed, captionFromTikTokPage, captionFromYouTube, isTikTok, isYouTube, tikTokOembed, youTubeId, type SocialCaption } from './social';

export type LinkResult =
  | { ok: true; draft: RecipeDraft; imageUrl: string | null; how: 'schema' | 'caption' | 'text' }
  /** Instagram gave nothing back: ask for the caption to be pasted. */
  | { ok: false; reason: 'instagram' | 'offline' | 'nothing'; url: string };

const UA = 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';
const TIMEOUT_MS = 15000;

/** A page's HTML, or null. Native requests skip CORS; the web build can only read pages that allow it. */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    if (isNative) {
      const res = await CapacitorHttp.get({ url, headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/json' }, responseType: 'text', connectTimeout: TIMEOUT_MS, readTimeout: TIMEOUT_MS });
      return res.status >= 200 && res.status < 300 && typeof res.data === 'string' ? res.data : null;
    }
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

/** The site's own name, or its host without www. */
function siteName(html: string, url: string): string | null {
  const name = meta(html, 'og:site_name');
  if (name) return name;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** A recipe draft from a page that was already fetched. */
export function readPage(html: string, url: string): LinkResult {
  const site = siteName(html, url);
  const schema = findRecipe(jsonLd(html)) ?? microdataRecipe(html);
  if (schema) {
    const { draft, imageUrl } = draftFromSchema(schema, url, site);
    if (draft.ingredients || draft.steps) return { ok: true, draft, imageUrl: imageUrl ?? meta(html, 'og:image'), how: 'schema' };
  }
  // A post rather than a recipe page: its caption, from the link preview.
  const preview = captionFromPreview(html);
  if (preview) {
    const result = readCaption(preview.caption, url, site ?? undefined, 'url');
    if (result.ok && (result.draft.ingredients || result.draft.steps)) {
      result.imageUrl = preview.imageUrl ?? null;
      return result;
    }
  }
  const text = mainText(html);
  const title = pageTitle(html);
  const { draft } = parseRecipeText([title, text].filter(Boolean).join('\n'), 'url', { url, author: site ?? undefined });
  if (title && !draft.title) draft.title = title;
  if (!draft.ingredients && !draft.steps) return { ok: false, reason: 'nothing', url };
  return { ok: true, draft, imageUrl: meta(html, 'og:image'), how: 'text' };
}

/** The caption of an Instagram post, read like pasted text. */
export function readCaption(caption: string, url: string, author?: string, kind: SourceKind = 'instagram'): LinkResult {
  const { draft } = parseRecipeText(caption, kind, { url, author });
  return { ok: true, draft, imageUrl: null, how: 'caption' };
}

/** A caption read like pasted text, with its picture; null when it holds no recipe. */
function fromCaption(found: SocialCaption | null, url: string): LinkResult | null {
  if (!found) return null;
  const result = readCaption(found.caption, url, found.author, 'url');
  if (!result.ok || (!result.draft.ingredients && !result.draft.steps)) return null;
  result.imageUrl = found.imageUrl ?? null;
  return result;
}

export async function importLink(url: string, fetcher: (url: string) => Promise<string | null> = fetchPage): Promise<LinkResult> {
  if (isTikTok(url)) {
    const viaOembed = fromCaption(captionFromTikTokOembed((await fetcher(tikTokOembed(url))) ?? ''), url);
    if (viaOembed) return viaOembed;
    const html = await fetcher(url);
    if (html === null) return { ok: false, reason: 'offline', url };
    return fromCaption(captionFromTikTokPage(html), url) ?? readPage(html, url);
  }
  if (isYouTube(url)) {
    const id = youTubeId(url);
    const page = id ? `https://www.youtube.com/watch?v=${id}` : url;
    const html = await fetcher(page);
    if (html === null) return { ok: false, reason: 'offline', url };
    return fromCaption(captionFromYouTube(html), page) ?? readPage(html, page);
  }
  if (isInstagram(url)) {
    const { page, embed } = instagramUrls(url);
    const html = await fetcher(page);
    const found = (html && captionFromPage(html)) || captionFromEmbed((await fetcher(embed)) ?? '');
    if (found) {
      const result = readCaption(found.caption, page, found.author);
      if (result.ok && html) result.imageUrl = meta(html, 'og:image');
      return result;
    }
    return { ok: false, reason: 'instagram', url: page };
  }
  const html = await fetcher(url);
  if (html === null) return { ok: false, reason: 'offline', url };
  return readPage(html, url);
}

/** The first http(s) link in some text, for a share that carries "Look at this! https://…". */
export function findUrl(text: string): string | null {
  const m = /https?:\/\/[^\s<>"'“”]+/i.exec(text);
  if (!m) return null;
  const url = m[0].replace(/[.,;:!?)\]]+$/, '');
  try {
    return new URL(url).href;
  } catch {
    return null;
  }
}

/** True when the text is nothing but a link. */
export function isOnlyUrl(text: string): boolean {
  const url = findUrl(text);
  return !!url && text.trim().replace(/[.,;:!?)\]]+$/, '').length <= url.length + 1 && /^https?:/i.test(text.trim());
}

const TRACKING = /^(?:utm_\w+|fbclid|gclid|igsh|igshid|si|mc_\w+|ref|ref_src)$/i;

/** A link as Mise compares it: no fragment, tracking parameters, "www." or trailing slash. */
export function normaliseUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) if (TRACKING.test(key)) u.searchParams.delete(key);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    return `${host}${u.pathname.replace(/\/+$/, '')}${u.search}`;
  } catch {
    return url.trim();
  }
}
