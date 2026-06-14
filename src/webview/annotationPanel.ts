// Right-side panel listing annotations. Mirrors the outlinePanel.ts pattern:
// a factory returning { toggle, render, focus }. Reads/writes the store, drives
// Copy all / Clear, and scroll-flashes the editor on row click.

import type { Editor } from '@tiptap/core';
import type { AnnotationStore } from './annotationStore';
import { serializeAnnotations } from './annotationStore';
import { truncateAnchor } from './aiSelection';
import { getDocumentPath, copyToClipboard } from './docContext';

export interface AnnotationPanel {
  toggle(): void;
  setVisible(v: boolean): void;
  render(): void;
  focus(id: string): void;
}

export function createAnnotationPanel(opts: {
  editor: Editor;
  panelEl: HTMLElement;
  toggleBtn: HTMLElement;
  store: AnnotationStore;
}): AnnotationPanel {
  const { editor, panelEl, toggleBtn, store } = opts;
  let visible = false;

  const esc = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const quoteAt = (from: number, to: number): string => {
    const size = editor.state.doc.content.size;
    const f = Math.max(0, Math.min(from, size));
    const t = Math.max(f, Math.min(to, size));
    return editor.state.doc.textBetween(f, t, '\n', ' ');
  };

  function render(): void {
    const items = store.list();
    const count = items.length;
    const countBadge = toggleBtn.querySelector('.mdep-ann-count');
    if (countBadge) {
      countBadge.textContent = count ? String(count) : '';
      countBadge.classList.toggle('hidden', count === 0);
    }
    if (count === 0) {
      panelEl.innerHTML = `
        <div class="mdep-ann-head">
          <span class="mdep-ann-title">Annotations</span>
        </div>
        <div class="mdep-ann-empty">Select text and add a comment to start.</div>`;
      return;
    }
    const rows = items.map((a, i) => `
      <div class="mdep-ann-row" data-id="${a.id}">
        <div class="mdep-ann-row-top">
          <span class="mdep-ann-badge-sm">${i + 1}</span>
          <span class="mdep-ann-quote">${esc(truncateAnchor(quoteAt(a.from, a.to), 90))}</span>
          <button class="mdep-ann-del" data-act="del" data-id="${a.id}" title="Delete">×</button>
        </div>
        <textarea class="mdep-ann-comment" data-id="${a.id}" rows="2">${esc(a.comment)}</textarea>
      </div>`).join('');
    panelEl.innerHTML = `
      <div class="mdep-ann-head">
        <span class="mdep-ann-title">Annotations (${count})</span>
        <span class="mdep-ann-head-actions">
          <button class="mdep-ann-copy" data-act="copy">Copy all</button>
          <button class="mdep-ann-clear" data-act="clear">Clear</button>
        </span>
      </div>
      <div class="mdep-ann-list">${rows}</div>`;
  }

  function flash(id: string): void {
    const a = store.list().find((x) => x.id === id);
    if (!a) return;
    try {
      const size = editor.state.doc.content.size;
      const pos = Math.max(0, Math.min(a.from, size));
      const dom = editor.view.domAtPos(pos);
      const node = (dom.node.nodeType === 1 ? dom.node : dom.node.parentElement) as HTMLElement | null;
      node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch { /* position may be stale; ignore */ }
    const hl = panelEl.ownerDocument.querySelector(`.mdep-annotation-hl[data-ann-id="${id}"]`);
    if (hl) {
      hl.classList.add('mdep-annotation-flash');
      setTimeout(() => hl.classList.remove('mdep-annotation-flash'), 800);
    }
  }

  // Event delegation for clicks.
  panelEl.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const act = t.closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'copy') {
      const text = serializeAnnotations(store.list(), { path: getDocumentPath(), quoteAt });
      const n = store.list().length;
      if (!text) return;
      copyToClipboard(text, `Copied ${n} annotation${n === 1 ? '' : 's'}`);
      return;
    }
    if (act === 'clear') {
      if (store.list().length && confirm('Clear all annotations?')) store.clear();
      return;
    }
    if (act === 'del') {
      const id = (t.closest<HTMLElement>('[data-id]'))?.dataset.id;
      if (id) store.remove(id);
      return;
    }
    const row = t.closest<HTMLElement>('.mdep-ann-row');
    if (row && t.tagName !== 'TEXTAREA') flash(row.dataset.id!);
  });

  // Debounced comment edits.
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  panelEl.addEventListener('input', (e) => {
    const ta = e.target as HTMLElement;
    if (!ta.classList.contains('mdep-ann-comment')) return;
    const id = ta.dataset.id!;
    const value = (ta as HTMLTextAreaElement).value;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => store.update(id, value), 250);
  });

  // Re-render whenever the store changes (but don't clobber a textarea the user
  // is actively editing — re-render only when focus isn't inside the panel).
  store.subscribe(() => {
    if (panelEl.contains(panelEl.ownerDocument.activeElement)) {
      const countBadge = toggleBtn.querySelector('.mdep-ann-count');
      if (countBadge) {
        const c = store.list().length;
        countBadge.textContent = c ? String(c) : '';
        countBadge.classList.toggle('hidden', c === 0);
      }
      return;
    }
    render();
  });

  function setVisible(v: boolean): void {
    visible = v;
    panelEl.classList.toggle('hidden', !visible);
    toggleBtn.classList.toggle('active', visible);
    if (visible) render();
  }

  render();
  return {
    toggle: () => setVisible(!visible),
    setVisible,
    render,
    focus: (id) => { setVisible(true); flash(id); },
  };
}
