// ============================================================
// mise:// links from the sibling apps (style.md §14.1).
//   mise://open?id=<recipe id>   opens that recipe, if it is on the phone
//   mise://import?url=<page>     opens the import review for that page;
//                                the person still presses Save recipe
//   mise://open, and any action Mise doesn't know, just open the app.
// A link never saves anything itself. Android registers the scheme with a
// VIEW intent filter; links arrive through appUrlOpen.
// ============================================================

import { App } from '@capacitor/app';
import { parseLink } from './links';
import { isNative } from './output';

export type MiseLink = { kind: 'open'; id?: string } | { kind: 'import'; url: string };

/** What a mise:// link asks for, or null for anything that isn't one. */
export function readMiseLink(url: string): MiseLink | null {
  const link = parseLink(url, 'mise');
  if (!link) return null;
  if (link.action === 'import') {
    const page = webUrl(link.params.url);
    return page ? { kind: 'import', url: page } : { kind: 'open' };
  }
  const id = link.action === 'open' ? link.params.id : undefined;
  return id && /^[\w-]{1,64}$/.test(id) ? { kind: 'open', id } : { kind: 'open' };
}

/** An http(s) URL, normalised, or null. */
function webUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

/** Calls `onLink` for the link Mise was launched with, and for each one after. */
export async function listenForLinks(onLink: (link: MiseLink) => void): Promise<void> {
  if (!isNative) return;
  const handle = (url: string | undefined) => {
    const read = url ? readMiseLink(url) : null;
    if (read) onLink(read);
  };
  await App.addListener('appUrlOpen', (event) => handle(event.url));
  const launch = await App.getLaunchUrl().catch(() => undefined);
  handle(launch?.url);
}
