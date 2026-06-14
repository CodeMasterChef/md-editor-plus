import { Editor } from '@tiptap/core';

// Custom right-click menu for the block editor. The VS Code webview's native
// menu (Cut/Copy/Paste) can't be extended, so we render our own with a
// Comment action on top. Cut/Copy use execCommand; Paste reads the clipboard
// and replays it through ProseMirror's paste pipeline (markdown-aware), falling
// back to a plain insert.

const CHAT_SVG =
  '<svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor"><path d="M128,28A100,100,0,0,0,39.57,174.06l-11.54,34.6a12,12,0,0,0,15.18,15.18l34.6-11.54A100,100,0,1,0,128,28Zm0,176a76.18,76.18,0,0,1-39.4-11,12,12,0,0,0-9.78-1.24l-23.65,7.89,7.89-23.65a12,12,0,0,0-1.24-9.78A76,76,0,1,1,128,204Z"/></svg>';

export function createContextMenu(editor: Editor): void {
  const menu = document.createElement('div');
  menu.className = 'mdep-context-menu hidden';
  menu.innerHTML = `
    <button class="mdep-ctx-item" data-act="comment"><span class="mdep-ctx-ico">${CHAT_SVG}</span><span>Comment</span></button>
    <div class="mdep-ctx-sep"></div>
    <button class="mdep-ctx-item" data-act="cut"><span class="mdep-ctx-ico"></span><span>Cut</span></button>
    <button class="mdep-ctx-item" data-act="copy"><span class="mdep-ctx-ico"></span><span>Copy</span></button>
    <button class="mdep-ctx-item" data-act="paste"><span class="mdep-ctx-ico"></span><span>Paste</span></button>`;
  document.body.appendChild(menu);

  let clickX = 0;
  let clickY = 0;

  const hide = (): void => menu.classList.add('hidden');

  const showAt = (x: number, y: number): void => {
    menu.classList.remove('hidden');
    const rect = menu.getBoundingClientRect();
    const margin = 8;
    menu.style.left = `${Math.min(x, window.innerWidth - rect.width - margin)}px`;
    menu.style.top = `${Math.min(y, window.innerHeight - rect.height - margin)}px`;
  };

  // Resolve the range to comment: the current selection if any, otherwise the
  // whole block under the right-click point.
  const commentRange = (): { from: number; to: number } | null => {
    const sel = editor.state.selection;
    if (sel.from !== sel.to) return { from: sel.from, to: sel.to };
    const res = editor.view.posAtCoords({ left: clickX, top: clickY });
    if (!res) return null;
    try {
      const $pos = editor.state.doc.resolve(res.pos);
      if ($pos.depth < 1) return null;
      const blockPos = $pos.before(1);
      const node = editor.state.doc.nodeAt(blockPos);
      if (!node) return null;
      let from = blockPos + 1;
      let to = blockPos + node.nodeSize - 1;
      if (from >= to) { from = blockPos; to = blockPos + node.nodeSize; }
      return { from, to };
    } catch { return null; }
  };

  const doPaste = async (): Promise<void> => {
    editor.view.focus();
    let text = '';
    try { text = await navigator.clipboard.readText(); } catch { /* blocked */ }
    if (!text) { try { document.execCommand('paste'); } catch { /* ignore */ } return; }
    try {
      const dt = new DataTransfer();
      dt.setData('text/plain', text);
      const evt = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
      const notHandled = editor.view.dom.dispatchEvent(evt);
      // dispatchEvent returns false when a handler called preventDefault (i.e.
      // ProseMirror consumed it). If nothing consumed it, insert plainly.
      if (notHandled) editor.commands.insertContent(text);
    } catch {
      editor.commands.insertContent(text);
    }
  };

  editor.view.dom.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    clickX = e.clientX;
    clickY = e.clientY;
    showAt(e.clientX, e.clientY);
  });

  menu.addEventListener('mousedown', async (e) => {
    e.preventDefault();
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (!act) return;
    hide();
    if (act === 'comment') {
      const range = commentRange();
      if (range) document.dispatchEvent(new CustomEvent('mdep:comment-range', { detail: range }));
    } else if (act === 'cut') {
      editor.view.focus();
      try { document.execCommand('cut'); } catch { /* ignore */ }
    } else if (act === 'copy') {
      editor.view.focus();
      try { document.execCommand('copy'); } catch { /* ignore */ }
    } else if (act === 'paste') {
      await doPaste();
    }
  });

  document.addEventListener('mousedown', (e) => {
    if (!menu.contains(e.target as Node)) hide();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  window.addEventListener('scroll', hide, { capture: true, passive: true });
}
