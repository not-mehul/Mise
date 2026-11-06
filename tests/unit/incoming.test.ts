import { describe, expect, it } from 'vitest';
import { readMiseLink } from '../../src/platform/incoming';
import { buildLink } from '../../src/platform/links';

describe('mise:// links', () => {
  it('opens a recipe by id', () => {
    expect(readMiseLink(buildLink('mise', 'open', { id: 'r-123' }, 'waymark'))).toEqual({ kind: 'open', id: 'r-123' });
  });

  it('starts an import for a web page', () => {
    const url = buildLink('mise', 'import', { url: 'https://example.com/pasta?x=1' }, 'rosetta');
    expect(readMiseLink(url)).toEqual({ kind: 'import', url: 'https://example.com/pasta?x=1' });
  });

  it('falls back to open for anything it cannot use', () => {
    expect(readMiseLink('mise://')).toEqual({ kind: 'open' });
    expect(readMiseLink('mise://import?url=javascript:alert(1)')).toEqual({ kind: 'open' });
    expect(readMiseLink('mise://import')).toEqual({ kind: 'open' });
    expect(readMiseLink('mise://open?id=../../etc')).toEqual({ kind: 'open' });
    expect(readMiseLink('mise://cook?id=abc')).toEqual({ kind: 'open' });
  });

  it('ignores links to other apps', () => {
    expect(readMiseLink('ledger://add?city=Lisbon')).toBeNull();
    expect(readMiseLink('https://example.com')).toBeNull();
  });
});
