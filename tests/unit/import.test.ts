import { describe, expect, it } from 'vitest';
import { decodeEntities, jsonLd, mainText, meta } from '../../src/import/html';
import { captionFromEmbed, captionFromPage, instagramUrls, isInstagram } from '../../src/import/instagram';
import { orderBlocks, photosToText } from '../../src/import/photo';
import { draftFromSchema, findRecipe, isoMinutes } from '../../src/import/schema';
import { findUrl, importLink, isOnlyUrl, normaliseUrl, readPage } from '../../src/import/web';
import { readShare } from '../../src/platform/shared';

const recipePage = (ld: unknown) => `<!doctype html><html><head>
<meta property="og:site_name" content="Good Food">
<meta property="og:image" content="https://example.com/og.jpg">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head><body><nav>Home Recipes</nav><article><h1>Ignored</h1></article></body></html>`;

const schema = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'WebSite', name: 'Good Food' },
    {
      '@type': ['Recipe', 'NewsArticle'],
      name: 'Lemon pasta &amp; peas',
      author: [{ '@type': 'Person', name: 'Ana Ruiz' }],
      recipeYield: ['4', '4 servings'],
      prepTime: 'PT10M',
      cookTime: 'PT15M',
      totalTime: 'PT25M',
      recipeIngredient: ['200 g spaghetti', '1 lemon, zested', '<b>100 g</b> peas'],
      recipeInstructions: [
        { '@type': 'HowToSection', name: 'Pasta', itemListElement: [{ '@type': 'HowToStep', text: 'Boil the pasta for 10 minutes.' }] },
        { '@type': 'HowToStep', text: 'Stir in the lemon and peas.' },
      ],
      image: { '@type': 'ImageObject', url: 'https://example.com/pasta.jpg' },
      recipeCategory: 'Dinner',
      keywords: 'quick, Vegetarian',
      description: 'A weeknight <i>favourite</i>.',
    },
  ],
};

describe('html', () => {
  it('decodes entities', () => {
    expect(decodeEntities('Fish &amp; chips &#8211; &#x00BD; cup &nbsp;')).toBe('Fish & chips – ½ cup  ');
  });

  it('reads meta tags in either attribute order', () => {
    expect(meta('<meta content="Hi &quot;there&quot;" property="og:title">', 'og:title')).toBe('Hi "there"');
  });

  it('skips JSON-LD that does not parse', () => {
    expect(jsonLd('<script type="application/ld+json">{bad</script><script type="application/ld+json">{"a":1}</script>')).toEqual([{ a: 1 }]);
  });

  it('reads the article without the site around it', () => {
    const text = mainText('<body><nav>Menu</nav><main><h2>Soup</h2><ul><li>1 onion</li></ul><footer>©</footer></main></body>');
    expect(text).toBe('Soup\n1 onion');
  });
});

describe('schema.org', () => {
  it('finds a Recipe inside an @graph with an @type list', () => {
    expect(findRecipe([schema])?.name).toBe('Lemon pasta &amp; peas');
  });

  it('reads ISO 8601 durations', () => {
    expect(isoMinutes('PT1H30M')).toBe(90);
    expect(isoMinutes('P0DT0H45M')).toBe(45);
    expect(isoMinutes('PT0S')).toBeNull();
    expect(isoMinutes('20 minutes')).toBe(20);
  });

  it('maps every field to the draft', () => {
    const { draft, imageUrl } = draftFromSchema(findRecipe([schema])!, 'https://example.com/pasta', 'Good Food');
    expect(draft.title).toBe('Lemon pasta & peas');
    expect(draft.servings).toBe('4');
    expect([draft.prepMinutes, draft.cookMinutes, draft.totalMinutes]).toEqual(['10', '15', '']);
    expect(draft.ingredients).toBe('200 g spaghetti\n1 lemon, zested\n100 g peas');
    expect(draft.steps).toBe('Boil the pasta for 10 minutes.\nStir in the lemon and peas.');
    expect(draft.notes).toBe('A weeknight favourite.');
    expect(draft.tags).toBe('dinner, quick, vegetarian');
    expect(draft.source).toMatchObject({ kind: 'url', url: 'https://example.com/pasta', author: 'Ana Ruiz' });
    expect(imageUrl).toBe('https://example.com/pasta.jpg');
  });

  it('splits instructions given as one block of text', () => {
    const { draft } = draftFromSchema({ '@type': 'Recipe', name: 'Toast', recipeInstructions: '<p>Toast the bread.</p><p>Butter it.</p>' }, 'https://x.test', null);
    expect(draft.steps).toBe('Toast the bread.\nButter it.');
  });
});

describe('reading a page', () => {
  it('prefers schema.org', () => {
    const result = readPage(recipePage(schema), 'https://example.com/pasta');
    expect(result).toMatchObject({ ok: true, how: 'schema', imageUrl: 'https://example.com/pasta.jpg' });
  });

  it('falls back to the page text', () => {
    const html = `<html><head><title>Garlic bread | Blog</title></head><body><article>
      <h2>Ingredients</h2><ul><li>1 baguette</li><li>3 cloves garlic</li></ul>
      <h2>Method</h2><ol><li>Mix the garlic with butter.</li><li>Bake for 10 minutes.</li></ol></article></body></html>`;
    const result = readPage(html, 'https://www.blog.test/garlic');
    expect(result.ok && result.how).toBe('text');
    if (!result.ok) return;
    expect(result.draft.ingredients).toBe('1 baguette\n3 cloves garlic');
    expect(result.draft.steps).toContain('Bake for 10 minutes.');
    expect(result.draft.source).toMatchObject({ kind: 'url', author: 'blog.test' });
  });

  it('says when a page holds no recipe', () => {
    expect(readPage('<html><body><p>About us</p></body></html>', 'https://x.test')).toMatchObject({ ok: false, reason: 'nothing' });
  });

  it('says when the page could not be fetched', async () => {
    expect(await importLink('https://x.test/a', async () => null)).toMatchObject({ ok: false, reason: 'offline' });
  });
});

describe('Instagram', () => {
  const post = 'https://www.instagram.com/reel/C9xYz_1-ab/?igsh=abc123';

  it('recognises posts and reels, not profiles', () => {
    expect(isInstagram(post)).toBe(true);
    expect(isInstagram('https://instagram.com/p/ABC/')).toBe(true);
    expect(isInstagram('https://www.instagram.com/someone/')).toBe(false);
    expect(instagramUrls(post)).toEqual({ page: 'https://www.instagram.com/reel/C9xYz_1-ab/', embed: 'https://www.instagram.com/p/C9xYz_1-ab/embed/captioned/' });
  });

  it('reads the caption from the page description', () => {
    const html = '<meta property="og:description" content="1,204 likes, 33 comments - cook.with.ana on March 3, 2026: &quot;Miso soup\nIngredients\n2 tbsp miso&quot;. ">';
    expect(captionFromPage(html)).toEqual({ caption: 'Miso soup\nIngredients\n2 tbsp miso', author: '@cook.with.ana' });
  });

  it('reads the caption from the embed page', () => {
    const html = '<div class="Caption"><a class="CaptionUsername" href="#">cook.with.ana</a><br>Miso soup<br><br>2 tbsp miso<div class="CaptionComments">View</div></div>';
    expect(captionFromEmbed(html)).toEqual({ caption: 'Miso soup\n2 tbsp miso', author: '@cook.with.ana' });
  });

  it('imports the caption, or asks for it to be pasted', async () => {
    const page = '<meta property="og:description" content="5 likes, 0 comments - ana on May 1, 2026: &quot;Pancakes\nIngredients\n1 egg\nMethod\nWhisk and fry.&quot;">';
    const ok = await importLink(post, async (u) => (u.endsWith('/embed/captioned/') ? null : page));
    expect(ok).toMatchObject({ ok: true, how: 'caption' });
    if (ok.ok) expect(ok.draft.source).toMatchObject({ kind: 'instagram', url: 'https://www.instagram.com/reel/C9xYz_1-ab/', author: '@ana' });
    expect(await importLink(post, async () => '<html>Login</html>')).toEqual({ ok: false, reason: 'instagram', url: 'https://www.instagram.com/reel/C9xYz_1-ab/' });
  });
});

describe('links', () => {
  it('finds the link in shared text', () => {
    expect(findUrl('Try this! https://example.com/soup?x=1).')).toBe('https://example.com/soup?x=1');
    expect(isOnlyUrl(' https://example.com/soup ')).toBe(true);
    expect(isOnlyUrl('Soup https://example.com/soup')).toBe(false);
  });

  it('compares links without tracking or www', () => {
    expect(normaliseUrl('https://www.Example.com/soup/?utm_source=x&id=2#top')).toBe(normaliseUrl('https://example.com/soup?id=2'));
    expect(normaliseUrl('https://example.com/soup?id=2')).not.toBe(normaliseUrl('https://example.com/soup?id=3'));
  });
});

describe('shares', () => {
  it('reads a short message with a link as that link', () => {
    expect(readShare({ text: 'Look https://example.com/cake' })).toEqual({ kind: 'link', url: 'https://example.com/cake' });
  });

  it('reads a long caption as text', () => {
    const text = `Cake\n${'1 cup flour\n'.repeat(20)}https://example.com`;
    expect(readShare({ text })).toEqual({ kind: 'text', text: text.trim() });
  });

  it('reads photos before any text', () => {
    const share = readShare({ text: 'caption', images: [btoa('jpeg')] });
    expect(share?.kind).toBe('photos');
  });

  it('ignores an empty share', () => {
    expect(readShare({})).toBeNull();
  });
});

describe('photos', () => {
  it('reads two columns left to right under a title', () => {
    const blocks = [
      { lines: ['Method'], x: 520, y: 120, w: 300, h: 30 },
      { lines: ['Ingredients'], x: 20, y: 120, w: 300, h: 30 },
      { lines: ['Tomato soup'], x: 20, y: 10, w: 900, h: 60 },
      { lines: ['1 onion', '2 tomatoes'], x: 20, y: 160, w: 280, h: 60 },
      { lines: ['Fry the onion until', 'soft.', 'Add the tomatoes.'], x: 520, y: 160, w: 320, h: 90 },
    ];
    expect(orderBlocks(blocks, 1000).map((b) => b.lines[0])).toEqual(['Tomato soup', 'Ingredients', '1 onion', 'Method', 'Fry the onion until']);
    expect(photosToText([{ blocks, width: 1000 }])).toBe('Tomato soup\nIngredients\n1 onion\n2 tomatoes\nMethod\nFry the onion until soft.\nAdd the tomatoes.');
  });

  it('joins several photos in order', () => {
    expect(photosToText([{ blocks: [{ lines: ['Page one'] }] }, { blocks: [] }, { blocks: [{ lines: ['Page two'] }] }])).toBe('Page one\nPage two');
  });
});
