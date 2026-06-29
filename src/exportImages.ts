import * as path from 'path';
import * as fs from 'fs';

const IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
};

// Exported HTML carries `<img>` src values that the webview resolved against
// its `vscode-resource` base URI (see editor.ts/ResolvedImage). Those URIs only
// load inside the VS Code webview sandbox — headless Chrome and external
// browsers can't fetch them, so images vanish from exported PDF/HTML. Rewrite
// any image pointing at the document's webview base into a self-contained
// data: URI so the export no longer depends on the webview protocol.
function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export function inlineImages(html: string, webviewBase: string, docDirFsPath: string): string {
  // Compare in decoded space: asWebviewUri().toString() percent-encodes the
  // literal `+` in the webview host (`file%2B…`), but the browser's new URL()
  // decodes it back to `file+…` when the webview resolves the image. A raw
  // string compare misses, so decode both sides before matching.
  const base = safeDecode(webviewBase).replace(/\/?$/, '/');
  return html.replace(/(<img\b[^>]*?\bsrc=)(["'])(.*?)\2/gi, (full, pre: string, quote: string, url: string) => {
    const decodedUrl = safeDecode(url);
    if (!decodedUrl.startsWith(base)) return full;
    const rel = decodedUrl.slice(base.length).split(/[?#]/)[0];
    if (!rel) return full;
    const filePath = path.join(docDirFsPath, rel);
    try {
      const data = fs.readFileSync(filePath);
      const mime = IMAGE_MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
      return `${pre}${quote}data:${mime};base64,${data.toString('base64')}${quote}`;
    } catch {
      return full;
    }
  });
}
