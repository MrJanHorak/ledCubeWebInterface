import { describe, it, expect } from 'vitest';
import { assetPathFromUrl, collectAssetUrls } from './siteBundle';

describe('assetPathFromUrl', () => {
  it('strips origin and leading slash from an absolute URL', () => {
    expect(
      assetPathFromUrl('https://example.com/assets/index-abc123.js'),
    ).toBe('assets/index-abc123.js');
  });

  it('resolves a root-relative URL against the given origin', () => {
    expect(assetPathFromUrl('/assets/style-xyz.css', 'https://example.com')).toBe(
      'assets/style-xyz.css',
    );
  });

  it('drops query strings and hash fragments', () => {
    expect(
      assetPathFromUrl('/assets/index-abc123.js?v=2#chunk', 'https://example.com'),
    ).toBe('assets/index-abc123.js');
  });

  it('returns an empty string for a falsy input', () => {
    expect(assetPathFromUrl('')).toBe('');
    expect(assetPathFromUrl(null)).toBe('');
  });

  it('handles inputs the URL parser accepts leniently without throwing', () => {
    // Node/browser URL parsing is lenient about relative-looking strings;
    // this just confirms the function never throws and always returns a
    // string, regardless of how odd the input is.
    expect(typeof assetPathFromUrl('not a valid url??but/has/path?q=1')).toBe(
      'string',
    );
  });
});

// Minimal fake Document-like object: querySelectorAll(sel) returns a plain
// array of elements exposing hasAttribute/getAttribute, enough to exercise
// collectAssetUrls without needing a real DOM (jsdom isn't configured for
// this project's test environment).
function makeFakeElement(attrs) {
  return {
    hasAttribute: (name) => name in attrs,
    getAttribute: (name) => attrs[name],
  };
}

function makeFakeDoc(bySelector) {
  return {
    querySelectorAll: (sel) => bySelector[sel] || [],
  };
}

describe('collectAssetUrls', () => {
  it('collects script src and stylesheet href values', () => {
    const doc = makeFakeDoc({
      'script[src]': [makeFakeElement({ src: '/assets/index-abc.js' })],
      'link[rel="stylesheet"]': [
        makeFakeElement({ rel: 'stylesheet', href: '/assets/index-abc.css' }),
      ],
    });
    const urls = collectAssetUrls(doc);
    expect(urls).toContain('/assets/index-abc.js');
    expect(urls).toContain('/assets/index-abc.css');
  });

  it('deduplicates repeated URLs across selectors', () => {
    const doc = makeFakeDoc({
      'script[src]': [makeFakeElement({ src: '/shared.js' })],
      'link[rel="icon"]': [makeFakeElement({ rel: 'icon', href: '/shared.js' })],
    });
    const urls = collectAssetUrls(doc);
    expect(urls.filter((u) => u === '/shared.js').length).toBe(1);
  });

  it('returns an empty array when nothing matches', () => {
    const doc = makeFakeDoc({});
    expect(collectAssetUrls(doc)).toEqual([]);
  });

  it('excludes cross-origin URLs like Google Fonts / Google Analytics', () => {
    const doc = makeFakeDoc({
      'script[src]': [
        makeFakeElement({ src: '/assets/index-abc.js' }),
        makeFakeElement({
          src: 'https://www.googletagmanager.com/gtag/js?id=G-XXXX',
        }),
      ],
      'link[rel="stylesheet"]': [
        makeFakeElement({ rel: 'stylesheet', href: '/assets/index-abc.css' }),
        makeFakeElement({
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter',
        }),
      ],
    });
    const urls = collectAssetUrls(doc, 'https://example.com');
    expect(urls).toContain('/assets/index-abc.js');
    expect(urls).toContain('/assets/index-abc.css');
    expect(urls).not.toContain('https://www.googletagmanager.com/gtag/js?id=G-XXXX');
    expect(urls).not.toContain('https://fonts.googleapis.com/css2?family=Inter');
  });
});
