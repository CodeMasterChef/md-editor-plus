// Floating action bar (bottom-right) for the annotation review layer.
// Replaces the old sidebar: shows the annotation count, "Copy all", and
// "Clear". Auto-shows when there is at least one annotation; the toolbar
// button toggles a manual hide. Per-annotation editing/deleting happens by
// clicking a badge in the document (handled in index.ts).

import type { Editor } from '@tiptap/core';
import type { AnnotationStore } from './annotationStore';
import { serializeAnnotations } from './annotationStore';
import { getDocumentPath, copyToClipboard } from './docContext';

export interface AnnotationBar {
  toggle(): void;
  setVisible(v: boolean): void;
  render(): void;
}

const TRASH_SVG =
  '<svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor"><path d="M216,48H180V36a28,28,0,0,0-28-28H104A28,28,0,0,0,76,36V48H40a12,12,0,0,0,0,24h4V208a20,20,0,0,0,20,20H192a20,20,0,0,0,20-20V72h4a12,12,0,0,0,0-24ZM100,36a4,4,0,0,1,4-4h48a4,4,0,0,1,4,4V48H100Zm88,168H68V72H188ZM116,104v64a12,12,0,0,1-24,0V104a12,12,0,0,1,24,0Zm48,0v64a12,12,0,0,1-24,0V104a12,12,0,0,1,24,0Z"/></svg>';

export function createAnnotationBar(opts: {
  editor: Editor;
  barEl: HTMLElement;
  store: AnnotationStore;
}): AnnotationBar {
  const { editor, barEl, store } = opts;
  let userHidden = false;

  const quoteAt = (from: number, to: number): string => {
    const size = editor.state.doc.content.size;
    const f = Math.max(0, Math.min(from, size));
    const t = Math.max(f, Math.min(to, size));
    return editor.state.doc.textBetween(f, t, '\n', ' ');
  };

  barEl.innerHTML = `
    <span class="mdep-bar-count" aria-live="polite"></span>
    <button class="mdep-bar-copy" data-act="copy">Copy all</button>
    <button class="mdep-bar-clear" data-act="clear" title="Clear all annotations">${TRASH_SVG}</button>`;

  const countEl = barEl.querySelector('.mdep-bar-count');

  function applyVisibility(): void {
    const show = store.list().length > 0 && !userHidden;
    barEl.classList.toggle('hidden', !show);
  }

  function render(): void {
    const n = store.list().length;
    if (countEl) countEl.textContent = `💬 ${n}`;
    applyVisibility();
  }

  barEl.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'copy') {
      const n = store.list().length;
      const text = serializeAnnotations(store.list(), { path: getDocumentPath(), quoteAt });
      if (!text) return;
      copyToClipboard(text, `Copied ${n} annotation${n === 1 ? '' : 's'}`);
    } else if (act === 'clear') {
      if (store.list().length && confirm('Clear all annotations?')) store.clear();
    }
  });

  store.subscribe(() => render());

  render();
  return {
    toggle: () => { userHidden = !userHidden; applyVisibility(); },
    setVisible: (v) => { userHidden = !v; applyVisibility(); },
    render,
  };
}
