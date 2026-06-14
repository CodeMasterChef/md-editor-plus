# Paragraph Annotations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an ephemeral "annotate a passage → comment → Copy all to AI" review layer to the Block view, modeled on agentation.com.

**Architecture:** Annotations live in a standalone in-memory store and are rendered as ProseMirror **decorations** (an overlay, never part of the document) so the 1s auto-save never writes them to the `.md`. A TipTap extension maps decoration positions through edits; a side panel lists them; a bubble-menu button + `⌘⌥M` create them; "Copy all" serializes them to numbered Markdown.

**Tech Stack:** TypeScript, TipTap v2 (`@tiptap/core`), ProseMirror (`@tiptap/pm/state`, `@tiptap/pm/view`), esbuild webview bundle, Jest + ts-jest for the pure store.

Reference spec: `docs/superpowers/specs/2026-06-14-paragraph-annotations-design.md`

**Build/verify commands:**
- Typecheck + bundle: `npm run compile` (expect `Webview built.`)
- Unit tests: `npm test`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/webview/annotationStore.ts` (new) | In-memory CRUD store + position remap + pure `serializeAnnotations` |
| `tests/annotationStore.test.ts` (new) | Unit tests for store + serializer |
| `src/webview/annotationInput.ts` (new) | Floating comment text input (`promptComment`) |
| `src/webview/annotationExtension.ts` (new) | TipTap extension: decorations (highlight + numbered badge), position mapping |
| `src/webview/annotationPanel.ts` (new) | Right-side panel: list, edit, delete, Copy all, Clear |
| `src/webview/editor.ts` (modify) | Create store, register extension, pass store to bubble menu, export `getAnnotationStore` |
| `src/webview/bubbleMenu.ts` (modify) | Add 💬 Comment button → `promptComment` → `store.add` |
| `src/webview/index.ts` (modify) | Instantiate panel, wire toolbar toggle + `⌘⌥M`, badge-focus event |
| `src/mdEditorPlusProvider.ts` (modify) | Toolbar toggle button + panel container HTML; optional `label` on `copyText` toast |
| `src/webview/styles/editor.css` (modify) | Highlight, badge, flash, panel styles |

---

## Task 1: Annotation store + serializer (TDD)

**Files:**
- Create: `src/webview/annotationStore.ts`
- Test: `tests/annotationStore.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/annotationStore.test.ts`:

```ts
import { createAnnotationStore, serializeAnnotations, Annotation } from '../src/webview/annotationStore';

describe('AnnotationStore', () => {
  test('add assigns incremental deterministic ids and stores fields', () => {
    const s = createAnnotationStore();
    const a = s.add(5, 10, 'first');
    const b = s.add(20, 25, 'second');
    expect(a).toEqual({ id: 'a1', from: 5, to: 10, comment: 'first' });
    expect(b.id).toBe('a2');
    expect(s.list().map(x => x.id)).toEqual(['a1', 'a2']);
  });

  test('list() returns annotations sorted by document position', () => {
    const s = createAnnotationStore();
    s.add(50, 60, 'late');
    s.add(5, 9, 'early');
    expect(s.list().map(x => x.from)).toEqual([5, 50]);
  });

  test('update changes only the comment', () => {
    const s = createAnnotationStore();
    const a = s.add(1, 4, 'old');
    s.update(a.id, 'new');
    expect(s.list()[0].comment).toBe('new');
  });

  test('remove deletes by id; clear empties', () => {
    const s = createAnnotationStore();
    const a = s.add(1, 4, 'x');
    s.add(8, 12, 'y');
    s.remove(a.id);
    expect(s.list().map(x => x.comment)).toEqual(['y']);
    s.clear();
    expect(s.list()).toEqual([]);
  });

  test('map remaps positions and drops a collapsed (deleted) range', () => {
    const s = createAnnotationStore();
    s.add(10, 20, 'shift');   // shift right by 3
    s.add(40, 50, 'deleted'); // collapse -> dropped
    const changed = s.map((pos) => {
      if (pos <= 20) return pos + 3;
      return 45; // forces 40->45 and 50->45 => from>=to
    });
    expect(changed).toBe(true);
    expect(s.list()).toEqual([{ id: 'a1', from: 13, to: 23, comment: 'shift' }]);
  });

  test('subscribe fires on every state-changing mutation; unsubscribe stops it', () => {
    const s = createAnnotationStore();
    const fn = jest.fn();
    const off = s.subscribe(fn);
    s.add(1, 2, 'a');     // emit 1
    s.add(3, 4, 'b');     // emit 2
    s.update('a1', 'x');  // emit 3
    s.clear();            // emit 4 (store was non-empty)
    expect(fn).toHaveBeenCalledTimes(4);
    s.clear();            // no-op on empty store -> no emit (guarded)
    expect(fn).toHaveBeenCalledTimes(4);
    off();
    s.add(5, 6, 'c');     // unsubscribed -> no emit
    expect(fn).toHaveBeenCalledTimes(4);
  });
});

describe('serializeAnnotations', () => {
  const quoteAt = (from: number, to: number) => `Q${from}-${to}`;

  test('empty list returns empty string', () => {
    expect(serializeAnnotations([], { path: 'x.md', quoteAt })).toBe('');
  });

  test('numbered markdown with path header, doc order, blockquote', () => {
    const anns: Annotation[] = [
      { id: 'a2', from: 40, to: 50, comment: 'second' },
      { id: 'a1', from: 5, to: 10, comment: 'first' },
    ];
    const out = serializeAnnotations(anns, { path: 'docs/plan.md', quoteAt });
    expect(out).toBe(
      'Re: docs/plan.md\n\n' +
      '1. > Q5-10\n' +
      '   comment: first\n\n' +
      '2. > Q40-50\n' +
      '   comment: second'
    );
  });

  test('multi-line excerpt prefixes every line with "> "', () => {
    const anns: Annotation[] = [{ id: 'a1', from: 0, to: 1, comment: 'c' }];
    const out = serializeAnnotations(anns, { path: 'f.md', quoteAt: () => 'line one\nline two' });
    expect(out).toBe(
      'Re: f.md\n\n' +
      '1. > line one\n' +
      '   > line two\n' +
      '   comment: c'
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- annotationStore`
Expected: FAIL — `Cannot find module '../src/webview/annotationStore'`.

- [ ] **Step 3: Write the implementation**

Create `src/webview/annotationStore.ts`:

```ts
// Ephemeral, in-memory annotation state for the review-and-copy-to-AI layer.
// No DOM/editor imports — unit-tested in isolation. Annotations are never part
// of the document; they live here and are rendered as ProseMirror decorations.

export interface Annotation {
  id: string;
  from: number;
  to: number;
  comment: string;
}

export interface AnnotationStore {
  list(): Annotation[];
  add(from: number, to: number, comment: string): Annotation;
  update(id: string, comment: string): void;
  remove(id: string): void;
  clear(): void;
  /**
   * Remap every annotation's positions through `mapPos`. Annotations whose
   * range collapses (from >= to) are dropped. Returns true if anything changed.
   */
  map(mapPos: (pos: number, assoc?: number) => number): boolean;
  subscribe(fn: () => void): () => void;
}

export function createAnnotationStore(): AnnotationStore {
  let counter = 0;
  let items: Annotation[] = [];
  const subs = new Set<() => void>();

  const emit = (): void => { subs.forEach((fn) => fn()); };
  const sorted = (): Annotation[] => [...items].sort((a, b) => a.from - b.from);

  return {
    list: sorted,
    add(from, to, comment) {
      const ann: Annotation = { id: `a${++counter}`, from, to, comment };
      items.push(ann);
      emit();
      return ann;
    },
    update(id, comment) {
      const ann = items.find((x) => x.id === id);
      if (ann) { ann.comment = comment; emit(); }
    },
    remove(id) {
      const next = items.filter((x) => x.id !== id);
      if (next.length !== items.length) { items = next; emit(); }
    },
    clear() {
      if (items.length) { items = []; emit(); }
    },
    map(mapPos) {
      let changed = false;
      const next: Annotation[] = [];
      for (const a of items) {
        const from = mapPos(a.from, 1);
        const to = mapPos(a.to, -1);
        if (from >= to) { changed = true; continue; }
        if (from !== a.from || to !== a.to) changed = true;
        next.push({ ...a, from, to });
      }
      if (changed) { items = next; emit(); }
      return changed;
    },
    subscribe(fn) {
      subs.add(fn);
      return () => { subs.delete(fn); };
    },
  };
}

/**
 * Serialize annotations to the clipboard payload pasted into an AI agent.
 * Excerpts are produced on demand by `quoteAt` (re-read from the live doc so
 * post-annotation edits are reflected).
 */
export function serializeAnnotations(
  anns: Annotation[],
  opts: { path: string; quoteAt: (from: number, to: number) => string },
): string {
  if (anns.length === 0) return '';
  const ordered = [...anns].sort((a, b) => a.from - b.from);
  const blocks = ordered.map((a, i) => {
    const lines = opts.quoteAt(a.from, a.to).split('\n');
    const quoted = lines
      .map((line, idx) => (idx === 0 ? `${i + 1}. > ${line}` : `   > ${line}`))
      .join('\n');
    return `${quoted}\n   comment: ${a.comment}`;
  });
  return `Re: ${opts.path}\n\n${blocks.join('\n\n')}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- annotationStore`
Expected: PASS (all 9 tests green).

- [ ] **Step 5: Commit**

```bash
git add src/webview/annotationStore.ts tests/annotationStore.test.ts
git commit -m "feat(annotations): in-memory store + clipboard serializer with tests"
```

---

## Task 2: Host `copyText` optional toast label

**Files:**
- Modify: `src/mdEditorPlusProvider.ts:372-378`

- [ ] **Step 1: Update the `copyText` handler**

Replace the existing block (around line 372):

```ts
      if (msg.type === 'copyText') {
        const text = (msg as unknown as { text?: unknown }).text;
        if (typeof text !== 'string') return;
        await vscode.env.clipboard.writeText(text);
        await vscode.window.showInformationMessage('AI prompt copied to clipboard');
        return;
      }
```

with:

```ts
      if (msg.type === 'copyText') {
        const m = msg as unknown as { text?: unknown; label?: unknown };
        if (typeof m.text !== 'string') return;
        await vscode.env.clipboard.writeText(m.text);
        const label = typeof m.label === 'string' && m.label ? m.label : 'AI prompt copied to clipboard';
        await vscode.window.showInformationMessage(label);
        return;
      }
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run compile`
Expected: `Webview built.` with no TS errors.

- [ ] **Step 3: Commit**

```bash
git add src/mdEditorPlusProvider.ts
git commit -m "feat(annotations): allow custom toast label on copyText message"
```

---

## Task 3: Floating comment input (`annotationInput.ts`)

**Files:**
- Create: `src/webview/annotationInput.ts`

- [ ] **Step 1: Write the module**

Create `src/webview/annotationInput.ts`:

```ts
// A small floating textarea for typing/editing an annotation comment.
// Resolves with the trimmed comment, or null if cancelled (Esc / click-away /
// empty submit). Positioned near a viewport anchor point.

let activeCleanup: (() => void) | null = null;

export function promptComment(opts: { x: number; y: number; initial?: string }): Promise<string | null> {
  activeCleanup?.();

  return new Promise((resolve) => {
    const pop = document.createElement('div');
    pop.className = 'mdep-annotation-input';
    const ta = document.createElement('textarea');
    ta.className = 'mdep-annotation-input-field';
    ta.placeholder = 'Add a comment…  (Enter to save, Esc to cancel)';
    ta.value = opts.initial ?? '';
    pop.appendChild(ta);
    document.body.appendChild(pop);

    // Clamp within the viewport.
    const margin = 8;
    const rect = pop.getBoundingClientRect();
    const left = Math.max(margin, Math.min(opts.x, window.innerWidth - rect.width - margin));
    const top = Math.max(margin, Math.min(opts.y, window.innerHeight - rect.height - margin));
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;

    let done = false;
    const finish = (value: string | null): void => {
      if (done) return;
      done = true;
      cleanup();
      resolve(value);
    };
    const cleanup = (): void => {
      document.removeEventListener('mousedown', onDocMouseDown, true);
      pop.remove();
      if (activeCleanup === cleanup) activeCleanup = null;
    };
    activeCleanup = cleanup;

    const onDocMouseDown = (e: MouseEvent): void => {
      if (!pop.contains(e.target as Node)) finish(null);
    };

    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const v = ta.value.trim();
        finish(v ? v : null);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finish(null);
      }
    });

    document.addEventListener('mousedown', onDocMouseDown, true);
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run compile`
Expected: `Webview built.`

- [ ] **Step 3: Commit**

```bash
git add src/webview/annotationInput.ts
git commit -m "feat(annotations): floating comment input popover"
```

---

## Task 4: Annotation extension (decorations) + editor registration

**Files:**
- Create: `src/webview/annotationExtension.ts`
- Modify: `src/webview/editor.ts` (imports, store, extension, bubble-menu call, export)

- [ ] **Step 1: Write the extension**

Create `src/webview/annotationExtension.ts`:

```ts
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

function makeBadge(num: number, id: string, onClick: (id: string) => void): HTMLElement {
  const el = document.createElement('span');
  el.className = 'mdep-annotation-badge';
  el.textContent = String(num);
  el.setAttribute('data-ann-id', id);
  el.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick(id);
  });
  return el;
}

function build(doc: PMNode, store: AnnotationStore, onBadgeClick: (id: string) => void): DecorationSet {
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
  onBadgeClick: (id: string) => void;
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
```

- [ ] **Step 2: Register in `editor.ts`**

Add imports near the other extension imports (after line 26, `import BlockOutline from './extensions/outline';`):

```ts
import { createAnnotationStore, AnnotationStore } from './annotationStore';
import { createAnnotationExtension } from './annotationExtension';
```

Add a module-level store. Put it near the other module-level `_editor`/`_frontmatter` declarations at the top of the file:

```ts
const _annotationStore: AnnotationStore = createAnnotationStore();

export function getAnnotationStore(): AnnotationStore {
  return _annotationStore;
}
```

In the `_editor = new Editor({ extensions: [ ... ] })` array, add this entry immediately after `SearchExtension,` (line 128):

```ts
      createAnnotationExtension({
        store: _annotationStore,
        onBadgeClick: (id) => {
          document.dispatchEvent(new CustomEvent('mdep:focus-annotation', { detail: { id } }));
        },
      }),
```

Change the bubble-menu call (line ~157) from:

```ts
  createBubbleMenu(_editor);
```

to:

```ts
  createBubbleMenu(_editor, _annotationStore);
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run compile`
Expected: `Webview built.` (NOTE: `createBubbleMenu` signature changes in Task 5; if compiling before Task 5, temporarily expect a TS arity error on that line — finish Task 5 before the final compile. If running tasks in order, do Step 3 verification after Task 5.)

- [ ] **Step 4: Commit**

```bash
git add src/webview/annotationExtension.ts src/webview/editor.ts
git commit -m "feat(annotations): decoration extension + store wired into editor"
```

---

## Task 5: Bubble-menu Comment button

**Files:**
- Modify: `src/webview/bubbleMenu.ts` (icon, signature, button, action handler, import)

- [ ] **Step 1: Add imports + icon**

At the top of `bubbleMenu.ts` add:

```ts
import { promptComment } from './annotationInput';
import type { AnnotationStore } from './annotationStore';
```

Add a chat-bubble glyph to the `P` icon map (Phosphor `chat-circle`, bold):

```ts
  chatBubble: 'M128,28A100,100,0,0,0,39.57,174.06l-11.54,34.6a12,12,0,0,0,15.18,15.18l34.6-11.54A100,100,0,1,0,128,28Zm0,176a76.18,76.18,0,0,1-39.4-11,12,12,0,0,0-9.78-1.24l-23.65,7.89,7.89-23.65a12,12,0,0,0-1.24-9.78A76,76,0,1,1,128,204Z',
```

- [ ] **Step 2: Change the factory signature**

Change:

```ts
export function createBubbleMenu(editor: Editor) {
```

to:

```ts
export function createBubbleMenu(editor: Editor, annotationStore: AnnotationStore) {
```

(If the current signature differs, add `annotationStore: AnnotationStore` as the second parameter.)

- [ ] **Step 3: Add the button to the toolbar markup**

In the bubble-menu HTML template, immediately after the AI button line (line 205, `data-action="ai"`), add:

```ts
      <button class="bm-btn" data-action="comment" data-tip-html="Comment<kbd>⌘⌥M</kbd>">${svg(P.chatBubble)}</button>
```

- [ ] **Step 4: Handle the `comment` action**

In the action `switch`/`if` chain (where `data-action` is dispatched, around line 556), add a `comment` branch that captures the selection, anchors the input below it, and stores the result:

```ts
    if (action === 'comment') {
      const { from, to } = editor.state.selection;
      if (from === to) return;
      const sel = window.getSelection();
      let x = window.innerWidth / 2;
      let y = window.innerHeight / 2;
      if (sel && sel.rangeCount > 0) {
        const r = sel.getRangeAt(0).getBoundingClientRect();
        x = r.left;
        y = r.bottom + 8;
      }
      const comment = await promptComment({ x, y });
      if (comment) {
        annotationStore.add(from, to, comment);
        // Force a decoration rebuild and open the panel.
        editor.view.dispatch(editor.state.tr.setMeta('mdep-annotation-refresh', true));
        document.dispatchEvent(new CustomEvent('mdep:open-annotations'));
      }
      return;
    }
```

NOTE: if the enclosing handler is not already `async`, make it `async` (the click listener registered around line 553). Example: `el.addEventListener('click', async (e) => { ... })`.

- [ ] **Step 5: Verify compile + tests**

Run: `npm run compile`
Expected: `Webview built.` (Task 4's editor.ts call now matches the new signature.)

Run: `npm test`
Expected: existing suites + `annotationStore` all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/webview/bubbleMenu.ts
git commit -m "feat(annotations): bubble-menu Comment button creates annotations"
```

---

## Task 6: Annotation panel (`annotationPanel.ts`)

**Files:**
- Create: `src/webview/annotationPanel.ts`

- [ ] **Step 1: Write the panel module**

Create `src/webview/annotationPanel.ts`:

```ts
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
      editor.commands.setTextSelection({ from: a.from, to: a.to });
      const dom = editor.view.domAtPos(a.from);
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
      if (!text) { copyToClipboard(''); return; }
      const n = store.list().length;
      copyToClipboard(text);
      // copyToClipboard posts {type:'copyText'}; piggyback a label via a second field.
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
```

NOTE on the Copy toast label: `copyToClipboard` in `docContext.ts` posts `{ type: 'copyText', text }`. To get the "Copied N annotations" toast added in Task 2, extend `copyToClipboard` to accept an optional label. In Task 7 Step 2 we update `docContext.ts`; until then the default toast shows.

- [ ] **Step 2: Verify it compiles**

Run: `npm run compile`
Expected: `Webview built.`

- [ ] **Step 3: Commit**

```bash
git add src/webview/annotationPanel.ts
git commit -m "feat(annotations): side panel (list, edit, delete, copy-all, clear)"
```

---

## Task 7: Wire toolbar button, panel, shortcut, label, CSS

**Files:**
- Modify: `src/webview/docContext.ts` (copy label)
- Modify: `src/mdEditorPlusProvider.ts` (toolbar button + panel container)
- Modify: `src/webview/index.ts` (instantiate panel + events + shortcut)
- Modify: `src/webview/styles/editor.css` (styles)

- [ ] **Step 1: Add a copy label to `docContext.ts`**

Replace `copyToClipboard` in `src/webview/docContext.ts` with:

```ts
export function copyToClipboard(text: string, label?: string): void {
  const vs = (window as unknown as {
    __mdViewerVscode?: { postMessage: (m: unknown) => void };
  }).__mdViewerVscode;
  vs?.postMessage({ type: 'copyText', text, label });
}
```

Then in `annotationPanel.ts`, update the `copy` branch to pass the label:

```ts
    if (act === 'copy') {
      const text = serializeAnnotations(store.list(), { path: getDocumentPath(), quoteAt });
      const n = store.list().length;
      if (!text) return;
      copyToClipboard(text, `Copied ${n} annotation${n === 1 ? '' : 's'}`);
      return;
    }
```

- [ ] **Step 2: Add the toolbar toggle button + panel container (provider HTML)**

In `src/mdEditorPlusProvider.ts`, after the outline button (line 673):

```ts
    <button class="toolbar-icon" id="outline-btn" data-tip="Outline (⌘⇧O)">${iOutline}</button>
```

add:

```ts
    <button class="toolbar-icon" id="annotation-btn" data-tip="Annotations (⌘⌥M)"><svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor"><path d="M128,28A100,100,0,0,0,39.57,174.06l-11.54,34.6a12,12,0,0,0,15.18,15.18l34.6-11.54A100,100,0,1,0,128,28Z"/></svg><span class="mdep-ann-count hidden"></span></button>
```

After the outline panel container (line 814, `<div class="outline-panel hidden" id="outline-panel"></div>`) add:

```ts
  <aside class="annotation-panel hidden" id="annotation-panel"></aside>
```

- [ ] **Step 3: Instantiate the panel + wire events + shortcut (index.ts)**

Add the import near the other panel import (line 13):

```ts
import { createAnnotationPanel, AnnotationPanel } from './annotationPanel';
import { getAnnotationStore } from './editor';
import { promptComment } from './annotationInput';
```

(If `getEditor` etc. are already imported from `./editor`, add `getAnnotationStore` to that existing import instead of a new line.)

Immediately after the outline `try { ... } catch` block (ends line ~1021), add:

```ts
      try {
        const annBtn = document.getElementById('annotation-btn') as HTMLElement | null;
        const annPanel = document.getElementById('annotation-panel') as HTMLElement | null;
        if (annBtn && annPanel) {
          const store = getAnnotationStore();
          const panel: AnnotationPanel = createAnnotationPanel({
            editor: editorInstance,
            panelEl: annPanel,
            toggleBtn: annBtn,
            store,
          });
          annBtn.addEventListener('click', () => panel.toggle());
          document.addEventListener('mdep:open-annotations', () => panel.setVisible(true));
          document.addEventListener('mdep:focus-annotation', (e) => {
            const id = (e as CustomEvent).detail?.id as string | undefined;
            if (id) panel.focus(id);
          });
          document.addEventListener('keydown', async (e) => {
            const mod = e.metaKey || e.ctrlKey;
            if (mod && e.altKey && (e.key === 'm' || e.key === 'M' || e.code === 'KeyM')) {
              const ed = getEditor();
              if (!ed) return;
              const { from, to } = ed.state.selection;
              if (from === to) return;
              e.preventDefault();
              let x = window.innerWidth / 2, y = window.innerHeight / 2;
              try {
                const start = ed.view.coordsAtPos(from);
                const end = ed.view.coordsAtPos(to);
                x = Math.min(start.left, end.left);
                y = Math.max(start.bottom, end.bottom) + 8;
              } catch { /* fall back to centre */ }
              const comment = await promptComment({ x, y });
              if (comment) {
                store.add(from, to, comment);
                ed.view.dispatch(ed.state.tr.setMeta('mdep-annotation-refresh', true));
                panel.setVisible(true);
              }
            }
          });
        }
      } catch (err) {
        console.error('[md-editor-plus] annotation init failed', err);
      }
```

- [ ] **Step 4: Add CSS**

Append to `src/webview/styles/editor.css`:

```css
/* ---- Annotations (review-and-copy-to-AI layer) ---- */
.mdep-annotation-hl {
  background: rgba(74, 158, 232, 0.18);
  border-bottom: 2px solid rgba(74, 158, 232, 0.75);
  border-radius: 2px;
  transition: background 0.2s ease;
}
.mdep-annotation-flash { background: rgba(74, 158, 232, 0.45) !important; }
.mdep-annotation-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 16px; height: 16px; padding: 0 4px; margin-right: 2px;
  font-size: 10px; font-weight: 600; line-height: 1;
  color: #fff; background: #4a9ee8; border-radius: 8px;
  vertical-align: super; cursor: pointer; user-select: none;
}
.mdep-annotation-input {
  position: fixed; z-index: 9999; width: 280px;
  background: var(--bg-elev, #fff); color: var(--fg, #111);
  border: 1px solid var(--border, #ddd); border-radius: 8px;
  box-shadow: 0 8px 28px rgba(0,0,0,0.25); padding: 6px;
}
.mdep-annotation-input-field {
  width: 100%; min-height: 52px; resize: vertical; box-sizing: border-box;
  border: none; outline: none; background: transparent; color: inherit;
  font: inherit; font-size: 13px;
}
.annotation-panel {
  position: fixed; top: 44px; right: 0; bottom: 0; width: 320px; z-index: 50;
  background: var(--bg-elev, #fff); color: var(--fg, #111);
  border-left: 1px solid var(--border, #e3e3e3);
  display: flex; flex-direction: column; overflow: hidden;
}
.annotation-panel.hidden { display: none; }
.mdep-ann-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px; border-bottom: 1px solid var(--border, #eee);
}
.mdep-ann-title { font-weight: 600; font-size: 13px; }
.mdep-ann-head-actions { display: flex; gap: 6px; }
.mdep-ann-copy, .mdep-ann-clear {
  font-size: 12px; padding: 3px 8px; border-radius: 6px; cursor: pointer;
  border: 1px solid var(--border, #ddd); background: transparent; color: inherit;
}
.mdep-ann-copy { background: #4a9ee8; color: #fff; border-color: #4a9ee8; }
.mdep-ann-list { overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 10px; }
.mdep-ann-row { border: 1px solid var(--border, #eee); border-radius: 8px; padding: 8px; }
.mdep-ann-row-top { display: flex; align-items: flex-start; gap: 6px; }
.mdep-ann-badge-sm {
  flex: 0 0 auto; min-width: 16px; height: 16px; padding: 0 4px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 600; color: #fff; background: #4a9ee8; border-radius: 8px;
}
.mdep-ann-quote { flex: 1 1 auto; font-size: 12px; opacity: 0.8; }
.mdep-ann-del {
  flex: 0 0 auto; border: none; background: transparent; color: inherit;
  cursor: pointer; font-size: 16px; line-height: 1; opacity: 0.6;
}
.mdep-ann-del:hover { opacity: 1; }
.mdep-ann-comment {
  width: 100%; box-sizing: border-box; margin-top: 6px; resize: vertical;
  border: 1px solid var(--border, #ddd); border-radius: 6px; padding: 4px 6px;
  font: inherit; font-size: 13px; background: transparent; color: inherit;
}
.mdep-ann-empty { padding: 16px 12px; font-size: 13px; opacity: 0.65; }
.mdep-ann-count {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 14px; height: 14px; padding: 0 3px; margin-left: 2px;
  font-size: 9px; font-weight: 700; color: #fff; background: #4a9ee8; border-radius: 7px;
}
.mdep-ann-count.hidden { display: none; }
```

- [ ] **Step 5: Build + verify**

Run: `npm run compile`
Expected: `Webview built.` with no TS errors.

Run: `npm test`
Expected: all suites PASS.

- [ ] **Step 6: Commit**

```bash
git add src/webview/docContext.ts src/webview/annotationPanel.ts src/mdEditorPlusProvider.ts src/webview/index.ts src/webview/styles/editor.css
git commit -m "feat(annotations): toolbar toggle, panel wiring, shortcut, copy label, styles"
```

---

## Task 8: Manual verification in the Extension Host

**Files:** none (manual)

- [ ] **Step 1: Repackage + install the dev build**

```bash
npm run compile && npx vsce package --allow-star-activation
code --uninstall-extension aviranrevach.md-editor-plus
code --install-extension md-editor-plus-0.5.4.vsix --force
```

Then "Developer: Reload Window".

- [ ] **Step 2: Walk the acceptance checklist**

- [ ] Open a `.md` in Block view; select a paragraph → bubble menu shows 💬 → click → type a comment → Enter. Passage gets a highlight + badge ①; panel opens listing it.
- [ ] Select another passage, press `⌘⌥M`, add a comment → badge ② appears; numbering is top-to-bottom.
- [ ] Edit text above an annotation → highlight stays on the same words (position remap).
- [ ] Delete an annotated passage entirely → its annotation disappears.
- [ ] Click a panel row → editor scrolls to it and the highlight flashes.
- [ ] Edit a comment in the panel → persists (no flicker, doc not marked dirty by it).
- [ ] "Copy all" → toast "Copied N annotations" → paste into a terminal; output matches the numbered format with `Re: <path>`.
- [ ] Confirm the `.md` on disk is unchanged by annotating (only real text edits change it) — `git diff` shows no annotation markup.
- [ ] "Clear" empties the panel and removes all highlights/badges.

- [ ] **Step 3: Commit any fixes found, then finish**

Use the `superpowers:finishing-a-development-branch` skill to decide merge/PR.

---

## Self-Review (completed by plan author)

**Spec coverage:** ephemeral store (T1), decorations/no-doc-mutation (T4), numbered-markdown copy (T1 serializer + T6/T7 wiring), highlight+badge+panel (T4/T6), bubble-menu entry (T5), `⌘⌥M` (T7), panel toggle in toolbar (T7), copy toast label (T2/T7), Source-view scope (badges only render in Block view via decorations; panel toggle still available — acceptable for v1), edge cases: empty selection (T5/T7 guard), deleted range (T1 map + test), overlap (independent decorations), code block (textBetween). All covered.

**Placeholder scan:** no TBD/TODO; all code blocks complete.

**Type consistency:** `AnnotationStore` methods (`list/add/update/remove/clear/map/subscribe`) used identically across T1/T4/T6/T7. `serializeAnnotations(anns, {path, quoteAt})` consistent. `createAnnotationPanel`/`createAnnotationExtension` option shapes match call sites. Meta string `'mdep-annotation-refresh'` used consistently in T5/T7 dispatch and rebuilt-on-every-tr in T4 (the apply rebuilds unconditionally, so the meta is just a no-op trigger — consistent).
