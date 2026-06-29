import { inlineImages } from '../src/exportImages';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

const BASE = 'https://file+.vscode-resource.vscode-cdn.net/docs/huong-dan';

describe('inlineImages', () => {
  let dir: string;
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdep-export-'));
    fs.mkdirSync(path.join(dir, 'img'), { recursive: true });
    // 1x1 transparent PNG
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );
    fs.writeFileSync(path.join(dir, 'img', '06-login.png'), png);
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('inlines a webview-resolved image into a data URI', () => {
    const html = `<p><img src="${BASE}/img/06-login.png" alt="x"></p>`;
    const out = inlineImages(html, BASE, dir);
    expect(out).toContain('data:image/png;base64,');
    expect(out).not.toContain('vscode-resource');
    expect(out).toContain('alt="x"'); // other attributes preserved
  });

  it('handles a webview base that already ends in a slash', () => {
    const html = `<img src="${BASE}/img/06-login.png">`;
    const out = inlineImages(html, BASE + '/', dir);
    expect(out).toContain('data:image/png;base64,');
  });

  it('URL-decodes paths with spaces', () => {
    fs.writeFileSync(path.join(dir, 'img', 'a b.png'), Buffer.from(''));
    const html = `<img src="${BASE}/img/a%20b.png">`;
    const out = inlineImages(html, BASE, dir);
    expect(out).toContain('data:image/png;base64,');
  });

  it('leaves images outside the webview base untouched', () => {
    const html = '<img src="https://example.com/x.png"><img src="data:image/gif;base64,AA">';
    expect(inlineImages(html, BASE, dir)).toBe(html);
  });

  it('leaves the src untouched when the file is missing', () => {
    const html = `<img src="${BASE}/img/missing.png">`;
    expect(inlineImages(html, BASE, dir)).toBe(html);
  });

  it('strips query/hash before resolving the file path', () => {
    const html = `<img src="${BASE}/img/06-login.png?v=2">`;
    expect(inlineImages(html, BASE, dir)).toContain('data:image/png;base64,');
  });

  // Regression: asWebviewUri().toString() percent-encodes the literal `+` in the
  // webview host as `%2B`, but the browser's new URL() decodes it back to `+`
  // when the webview resolves the image. So the host-recomputed base (`file%2B`)
  // never string-matched the DOM src (`file+`) and no image was inlined.
  it('matches when the webview base is percent-encoded but the DOM src is not', () => {
    const encodedBase = 'https://file%2B.vscode-resource.vscode-cdn.net/docs/huong-dan';
    const domSrc = 'https://file+.vscode-resource.vscode-cdn.net/docs/huong-dan/img/06-login.png';
    const html = `<img src="${domSrc}" alt="x">`;
    const out = inlineImages(html, encodedBase, dir);
    expect(out).toContain('data:image/png;base64,');
    expect(out).not.toContain('vscode-resource');
  });
});
