// Packages the currently-running site's own built files (index.html, JS/CSS
// bundles, favicon, etc.) into a downloadable .zip, so the ESP32
// Self-Hosted Web App sketch's setup doesn't require cloning the repo and
// running `npm run build` locally -- whatever page served this code IS
// already the production build, so we can just re-fetch and re-package it.
import JSZip from 'jszip';

// Strips a URL down to the relative path a file should occupy inside the
// zip (and therefore inside the ESP32's data/ folder), e.g.
// "https://example.com/assets/index-abc123.js?x=1" -> "assets/index-abc123.js"
// Pure function, kept separate from the fetch/DOM side effects so it's
// easy to unit test.
export function assetPathFromUrl(url, origin) {
  if (!url) return '';
  let path;
  try {
    const u = new URL(url, origin || 'http://localhost/');
    path = u.pathname;
  } catch (e) {
    path = url.split('?')[0].split('#')[0];
  }
  return path.replace(/^\/+/, '');
}

// Scans the live document for the asset URLs it actually loaded (script
// bundles, stylesheets, icons, manifest) -- this naturally stays in sync
// with whatever the current Vite build produced, without needing to know
// hashed filenames ahead of time.
export function collectAssetUrls(doc) {
  const urls = new Set();
  const selectors = [
    'script[src]',
    'link[rel="stylesheet"]',
    'link[rel="icon"]',
    'link[rel="shortcut icon"]',
    'link[rel="manifest"]',
    'link[rel="apple-touch-icon"]',
  ];
  selectors.forEach((sel) => {
    doc.querySelectorAll(sel).forEach((el) => {
      const attr = el.hasAttribute('src') ? 'src' : 'href';
      const val = el.getAttribute(attr);
      if (val) urls.add(val);
    });
  });
  return Array.from(urls);
}

// Fetches index.html plus every discovered asset, zips them with the same
// relative folder layout Vite built them with, and triggers a browser
// download. Intended to be dropped straight into the ESP32 data/ folder.
export async function downloadSiteZip({
  doc = typeof document !== 'undefined' ? document : null,
  win = typeof window !== 'undefined' ? window : null,
  filename = 'ledcube-webapp-data.zip',
} = {}) {
  if (!doc || !win) {
    throw new Error('downloadSiteZip requires a browser environment');
  }

  const origin = win.location.origin;
  const zip = new JSZip();

  const indexRes = await win.fetch(`${origin}/index.html`);
  if (!indexRes.ok) {
    throw new Error(
      `Could not fetch index.html (HTTP ${indexRes.status}) -- are you running this from the live site?`,
    );
  }
  zip.file('index.html', await indexRes.text());

  const assetUrls = collectAssetUrls(doc);
  for (const url of assetUrls) {
    const absUrl = new URL(url, origin).toString();
    const res = await win.fetch(absUrl);
    if (!res.ok) continue; // skip anything that 404s rather than aborting the whole zip
    const blob = await res.blob();
    const path = assetPathFromUrl(url, origin);
    if (path) zip.file(path, blob);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const a = doc.createElement('a');
  const blobUrl = win.URL.createObjectURL(content);
  a.href = blobUrl;
  a.download = filename;
  doc.body.appendChild(a);
  a.click();
  a.remove();
  win.URL.revokeObjectURL(blobUrl);
}
