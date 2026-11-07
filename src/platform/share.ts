import { Share } from '@capacitor/share';
import { isNative } from './output';

/** Shares plain text through the share sheet; 'copied' when only the clipboard was available. */
export async function shareText(title: string, text: string): Promise<'shared' | 'copied' | 'cancelled'> {
  try {
    if (isNative) {
      await Share.share({ title, text, dialogTitle: title });
      return 'shared';
    }
    if (navigator.share) {
      await navigator.share({ title, text });
      return 'shared';
    }
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'cancelled';
  }
}
