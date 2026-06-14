// Renders annotations as ProseMirror decorations (overlay only — never part of
// the document, so auto-save never writes them to the .md). Maps positions
// through edits and drops annotations whose range was deleted.

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { AnnotationStore } from './annotationStore';

export const annotationPluginKey = new PluginKey('mdepAnnotations');
// Set this meta on a no-op transaction to force a decoration rebuild after a
// store mutation that did not change the document.
export const ANNOTATION_REFRESH = 'mdep-annotation-refresh';

function makeBadge(num: number, id: string, onClick: (id: string, rect: DOMRect) => void): HTMLElement {
  const el = document.createElement('span');
  el.className = 'mdep-annotation-badge';
  el.textContent = String(num);
  el.setAttribute('data-ann-id', id);
  el.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick(id, el.getBoundingClientRect());
  });
  return el;
}

function build(doc: PMNode, store: AnnotationStore, onBadgeClick: (id: string, rect: DOMRect) => void): DecorationSet {
  const size = doc.content.size;
  const decos: Decoration[] = [];
  store.list().forEach((a, i) => {
    const from = Math.max(1, Math.min(a.from, size));
    const to = Math.max(from, Math.min(a.to, size));
    if (to <= from) return;
    decos.push(Decoration.inline(from, to, { class: 'mdep-annotation-hl', 'data-ann-id': a.id }));
    decos.push(Decoration.widget(from, () => makeBadge(i + 1, a.id, onBadgeClick), {
      side: -1,
      key: `mdep-badge-${a.id}`,
    }));
  });
  return DecorationSet.create(doc, decos);
}

export function createAnnotationExtension(opts: {
  store: AnnotationStore;
  onBadgeClick: (id: string, rect: DOMRect) => void;
}): Extension {
  const { store, onBadgeClick } = opts;
  return Extension.create({
    name: 'mdepAnnotations',
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: annotationPluginKey,
          state: {
            init: (_config, state: EditorState) => build(state.doc, store, onBadgeClick),
            apply: (tr: Transaction) => {
              if (tr.docChanged) {
                store.map((pos, assoc) => tr.mapping.map(pos, assoc ?? 1));
              }
              // Rebuild on every transaction: cheap (few annotations) and keeps
              // the badge numbering + positions in sync with both edits and
              // store mutations (which dispatch a REFRESH meta no-op tr).
              return build(tr.doc, store, onBadgeClick);
            },
          },
          props: {
            decorations(state) {
              return annotationPluginKey.getState(state) as DecorationSet;
            },
          },
        }),
      ];
    },
  });
}
