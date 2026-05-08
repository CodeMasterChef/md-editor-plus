# Block Handle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Notion-style block handle to the editor — a `+` button in the left gutter and a `⠿` drag handle inside each hovered row, with a searchable block-type picker and drag-to-reorder.

**Architecture:** `tiptap-extension-global-drag-handle` (community, MIT) handles DnD reordering and positions a `.drag-handle` element next to the hovered block. After editor creation, `blockHandle.ts` injects a `+` button into that element and wires click handlers. `blockPicker.ts` builds and manages the floating dark picker panel.

**Tech Stack:** TypeScript, Tiptap v2, `tiptap-extension-global-drag-handle`, plain DOM APIs, Jest (filter function unit tests)

---

## File Map

| File | Change |
|---|---|
| `package.json` | Add `tiptap-extension-global-drag-handle` devDep |
| `src/webview/styles/editor.css` | Row hover tint, drag handle + button layout, picker, tooltip |
| `src/webview/blockPicker.ts` | **New** — block definitions, `filterBlocks`, floating picker DOM |
| `src/webview/blockHandle.ts` | **New** — injects `+` into drag handle, wires pickers, `⌘/` shortcut |
| `src/webview/editor.ts` | Add `GlobalDragHandle` extension; call `createBlockHandle(editor)` |
| `tests/blockPicker.test.ts` | Unit tests for `filterBlocks` |

---

### Task 1: Install package

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
cd "/Users/aviranrevach/AI Projects Aviran/MD viewer mscode"
npm install --save-dev tiptap-extension-global-drag-handle
```

Expected: package added to `node_modules/`, no errors.

- [ ] **Step 2: Verify**

```bash
grep "global-drag-handle" package.json
```

Expected: one line with `"tiptap-extension-global-drag-handle"` in devDependencies.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add global drag handle package"
```

---

### Task 2: CSS — row hover, handle layout, picker, tooltip

**Files:**
- Modify: `src/webview/styles/editor.css`

- [ ] **Step 1: Increase editor left padding to create the gutter, and add row hover tint**

Find the `#editor` rule and update it:

```css
#editor {
  margin: 0 auto;
  padding: 48px 24px 96px 64px; /* 64px left = room for gutter */
  max-width: 720px;
}

#editor.width-medium { max-width: 850px; }
#editor.width-full   { max-width: 100%; padding: 16px 32px 48px 64px; }
```

Then append to the end of `editor.css`:

```css
/* ── Block handle & picker ────────────────────────────── */

/* Row hover tint */
.ProseMirror > *:hover {
  background: var(--block-hover);
  border-radius: 4px;
}

/* Drag handle container — created and positioned by GlobalDragHandle extension */
.drag-handle {
  display: flex;
  align-items: center;
  gap: 2px;
  padding-right: 4px;
}

/* + button — sits in the gutter, to the LEFT of the drag icon */
.block-handle-plus {
  background: transparent;
  border: none;
  color: #aaaaaa;
  font-size: 17px;
  font-weight: 300;
  width: 18px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  transition: background 0.1s, color 0.1s, box-shadow 0.1s;
  flex-shrink: 0;
}

.block-handle-plus:hover {
  background: var(--bg, #ffffff);
  color: #444444;
  box-shadow: 0 1px 4px rgba(0,0,0,0.14), 0 0 0 1.5px #d8d8d8;
}

/* Drag icon — sits inside the row */
.block-handle-drag {
  color: #cccccc;
  font-size: 12px;
  cursor: grab;
  width: 16px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  transition: color 0.1s, background 0.1s;
}

.block-handle-drag:hover {
  color: #888;
  background: rgba(0,0,0,0.06);
}

/* Tooltip */
.block-handle-tooltip {
  position: fixed;
  background: #1a1a1a;
  color: #e8e8e8;
  border-radius: 7px;
  padding: 6px 10px;
  font-size: 11px;
  line-height: 1.55;
  text-align: center;
  pointer-events: none;
  z-index: 1100;
  display: none;
  box-shadow: 0 4px 12px rgba(0,0,0,0.35);
  white-space: nowrap;
}

.block-handle-tooltip .kbd {
  background: #333;
  border-radius: 3px;
  padding: 1px 5px;
  font-family: var(--font-mono, monospace);
  font-size: 10px;
}

/* Block picker */
.block-picker {
  position: fixed;
  display: none;
  width: 220px;
  background: #1e1e1e;
  border-radius: 10px;
  padding: 6px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3);
  z-index: 1050;
  max-height: 360px;
  overflow-y: auto;
}

.block-picker.open { display: block; }

.block-picker-search {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  margin-bottom: 4px;
  background: #2a2a2a;
  border-radius: 6px;
}

.block-picker-input {
  background: transparent;
  border: none;
  color: #cdd6f4;
  font-size: 12px;
  font-family: inherit;
  outline: none;
  width: 100%;
}

.block-picker-input::placeholder { color: #6c7086; }

.block-picker-section-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: #45475a;
  padding: 6px 8px 3px;
}

.block-picker-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
}

.block-picker-item:hover,
.block-picker-item.active {
  background: #2a2a2a;
}

.block-picker-icon {
  width: 28px;
  height: 28px;
  background: #2a2a2a;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: #cdd6f4;
  flex-shrink: 0;
  font-family: var(--font-mono, monospace);
}

.block-picker-item.active .block-picker-icon { background: #313244; }

.block-picker-label {
  font-size: 12px;
  color: #cdd6f4;
  line-height: 1.3;
}

.block-picker-sep {
  height: 1px;
  background: #2a2a2a;
  margin: 4px 6px;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/webview/styles/editor.css
git commit -m "feat: add block handle and picker CSS"
```

---

### Task 3: `src/webview/blockPicker.ts` (TDD)

**Files:**
- Create: `src/webview/blockPicker.ts`
- Create: `tests/blockPicker.test.ts`

- [ ] **Step 1: Write failing tests `tests/blockPicker.test.ts`**

```typescript
import { filterBlocks, BLOCK_DEFS } from '../src/webview/blockPicker';

describe('filterBlocks', () => {
  it('returns all blocks when query is empty', () => {
    expect(filterBlocks('')).toHaveLength(BLOCK_DEFS.length);
  });

  it('filters by label case-insensitively', () => {
    const results = filterBlocks('head');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(b =>
      b.label.toLowerCase().includes('head') ||
      b.description.toLowerCase().includes('head') ||
      b.id.toLowerCase().includes('head')
    )).toBe(true);
  });

  it('returns empty array for no matches', () => {
    expect(filterBlocks('zzznomatch')).toHaveLength(0);
  });

  it('finds heading1 when querying "h1"', () => {
    const ids = filterBlocks('h1').map(b => b.id);
    expect(ids).toContain('heading1');
  });

  it('finds image block when querying "image"', () => {
    const ids = filterBlocks('image').map(b => b.id);
    expect(ids).toContain('image');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx jest tests/blockPicker.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../src/webview/blockPicker'`

- [ ] **Step 3: Create `src/webview/blockPicker.ts`**

```typescript
import { Editor } from '@tiptap/core';

export interface BlockDef {
  id: string;
  label: string;
  description: string;
  icon: string;
  section: 'text' | 'lists' | 'media' | 'other';
  insert: (editor: Editor, pos: number) => void;
}

export const BLOCK_DEFS: BlockDef[] = [
  {
    id: 'paragraph',
    label: 'Paragraph',
    description: 'Plain text block',
    icon: '¶',
    section: 'text',
    insert: (editor, pos) =>
      editor.chain().focus().insertContentAt(pos, { type: 'paragraph', content: [] }).run(),
  },
  {
    id: 'heading1',
    label: 'Heading 1',
    description: 'Big section title',
    icon: 'H1',
    section: 'text',
    insert: (editor, pos) =>
      editor.chain().focus().insertContentAt(pos, { type: 'heading', attrs: { level: 1 }, content: [] }).run(),
  },
  {
    id: 'heading2',
    label: 'Heading 2',
    description: 'Sub-section heading',
    icon: 'H2',
    section: 'text',
    insert: (editor, pos) =>
      editor.chain().focus().insertContentAt(pos, { type: 'heading', attrs: { level: 2 }, content: [] }).run(),
  },
  {
    id: 'heading3',
    label: 'Heading 3',
    description: 'Small heading',
    icon: 'H3',
    section: 'text',
    insert: (editor, pos) =>
      editor.chain().focus().insertContentAt(pos, { type: 'heading', attrs: { level: 3 }, content: [] }).run(),
  },
  {
    id: 'bulletList',
    label: 'Bullet list',
    description: 'Unordered list',
    icon: '•',
    section: 'lists',
    insert: (editor, pos) =>
      editor.chain().focus().insertContentAt(pos, {
        type: 'bulletList',
        content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [] }] }],
      }).run(),
  },
  {
    id: 'orderedList',
    label: 'Numbered list',
    description: 'Ordered list',
    icon: '1.',
    section: 'lists',
    insert: (editor, pos) =>
      editor.chain().focus().insertContentAt(pos, {
        type: 'orderedList',
        content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [] }] }],
      }).run(),
  },
  {
    id: 'taskList',
    label: 'Task list',
    description: 'Checkbox list',
    icon: '☑',
    section: 'lists',
    insert: (editor, pos) =>
      editor.chain().focus().insertContentAt(pos, {
        type: 'taskList',
        content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [] }] }],
      }).run(),
  },
  {
    id: 'image',
    label: 'Image',
    description: 'Paste URL or drag & drop',
    icon: '🖼',
    section: 'media',
    insert: (editor, pos) => {
      const url = window.prompt('Image URL:');
      if (url) editor.chain().focus().insertContentAt(pos, { type: 'image', attrs: { src: url, alt: '' } }).run();
    },
  },
  {
    id: 'callout',
    label: 'Callout',
    description: 'Highlighted note block',
    icon: '💡',
    section: 'media',
    insert: (editor, pos) =>
      editor.chain().focus().insertContentAt(pos, {
        type: 'callout',
        attrs: { type: 'note', emoji: '💡' },
        content: [{ type: 'text', text: ' ' }],
      }).run(),
  },
  {
    id: 'toggle',
    label: 'Toggle',
    description: 'Collapsible section',
    icon: '▶',
    section: 'media',
    insert: (editor, pos) =>
      editor.chain().focus().insertContentAt(pos, {
        type: 'toggle',
        attrs: { summary: 'Toggle' },
        content: [{ type: 'paragraph', content: [] }],
      }).run(),
  },
  {
    id: 'blockquote',
    label: 'Blockquote',
    description: 'Quoted text',
    icon: '❝',
    section: 'other',
    insert: (editor, pos) =>
      editor.chain().focus().insertContentAt(pos, {
        type: 'blockquote',
        content: [{ type: 'paragraph', content: [] }],
      }).run(),
  },
  {
    id: 'codeBlock',
    label: 'Code block',
    description: 'Syntax-highlighted code',
    icon: '</>',
    section: 'other',
    insert: (editor, pos) =>
      editor.chain().focus().insertContentAt(pos, { type: 'codeBlock', attrs: { language: null } }).run(),
  },
  {
    id: 'horizontalRule',
    label: 'Divider',
    description: 'Horizontal rule',
    icon: '—',
    section: 'other',
    insert: (editor, pos) =>
      editor.chain().focus().insertContentAt(pos, { type: 'horizontalRule' }).run(),
  },
];

export function filterBlocks(query: string): BlockDef[] {
  if (!query.trim()) return BLOCK_DEFS;
  const q = query.toLowerCase();
  return BLOCK_DEFS.filter(
    b =>
      b.label.toLowerCase().includes(q) ||
      b.description.toLowerCase().includes(q) ||
      b.id.toLowerCase().includes(q),
  );
}

const SECTION_LABELS: Record<BlockDef['section'], string> = {
  text:  'Text',
  lists: 'Lists',
  media: 'Media & blocks',
  other: 'Other',
};

export interface BlockPicker {
  open: (anchorEl: HTMLElement, insertPos: number) => void;
  close: () => void;
}

export function createBlockPicker(editor: Editor): BlockPicker {
  let currentPos = 0;
  let activeIdx  = 0;
  let filtered: BlockDef[] = BLOCK_DEFS;

  const el = document.createElement('div');
  el.className = 'block-picker';
  el.innerHTML = `
    <div class="block-picker-search">
      <input class="block-picker-input" placeholder="Filter blocks…" autocomplete="off" spellcheck="false" />
    </div>
    <div class="block-picker-list"></div>
  `;
  document.body.appendChild(el);

  const input = el.querySelector<HTMLInputElement>('.block-picker-input')!;
  const list  = el.querySelector<HTMLElement>('.block-picker-list')!;

  function renderList(items: BlockDef[]): void {
    list.innerHTML = '';
    let globalIdx = 0;
    ((['text', 'lists', 'media', 'other'] as const)).forEach(section => {
      const sectionItems = items.filter(b => b.section === section);
      if (!sectionItems.length) return;
      if (list.childElementCount > 0) {
        const sep = document.createElement('div');
        sep.className = 'block-picker-sep';
        list.appendChild(sep);
      }
      const lbl = document.createElement('div');
      lbl.className = 'block-picker-section-label';
      lbl.textContent = SECTION_LABELS[section];
      list.appendChild(lbl);
      sectionItems.forEach(block => {
        const row = document.createElement('div');
        row.className = 'block-picker-item';
        row.dataset.idx = String(globalIdx);
        row.innerHTML = `<span class="block-picker-icon">${block.icon}</span><span class="block-picker-label">${block.label}</span>`;
        row.addEventListener('mousedown', e => { e.preventDefault(); select(block); });
        list.appendChild(row);
        globalIdx++;
      });
    });
    activeIdx = 0;
    updateActive();
  }

  function updateActive(): void {
    list.querySelectorAll<HTMLElement>('.block-picker-item').forEach((row, i) => {
      row.classList.toggle('active', i === activeIdx);
    });
  }

  function select(block: BlockDef): void {
    block.insert(editor, currentPos);
    close();
  }

  input.addEventListener('input', () => {
    filtered = filterBlocks(input.value);
    renderList(filtered);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIdx = Math.min(activeIdx + 1, filtered.length - 1);
      updateActive();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIdx = Math.max(activeIdx - 1, 0);
      updateActive();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[activeIdx]) select(filtered[activeIdx]);
    } else if (e.key === 'Escape') {
      close();
    }
  });

  function open(anchorEl: HTMLElement, insertPos: number): void {
    currentPos = insertPos;
    filtered = BLOCK_DEFS;
    input.value = '';
    renderList(BLOCK_DEFS);
    el.classList.add('open');

    const rect = anchorEl.getBoundingClientRect();
    el.style.left = `${rect.left + window.scrollX}px`;
    el.style.top  = `${rect.bottom + window.scrollY + 6}px`;

    // Flip above anchor if picker would overflow bottom of viewport
    requestAnimationFrame(() => {
      const pickerRect = el.getBoundingClientRect();
      if (pickerRect.bottom > window.innerHeight - 12) {
        el.style.top = `${rect.top + window.scrollY - pickerRect.height - 6}px`;
      }
      input.focus();
    });
  }

  function close(): void {
    el.classList.remove('open');
    input.value = '';
  }

  document.addEventListener('mousedown', e => {
    if (!el.contains(e.target as Node)) close();
  });

  return { open, close };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest tests/blockPicker.test.ts --no-coverage
```

Expected: PASS — 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/webview/blockPicker.ts tests/blockPicker.test.ts
git commit -m "feat: add block picker with testable filter function"
```

---

### Task 4: `src/webview/blockHandle.ts`

**Files:**
- Create: `src/webview/blockHandle.ts`

- [ ] **Step 1: Create `src/webview/blockHandle.ts`**

```typescript
import { Editor } from '@tiptap/core';
import { createBlockPicker } from './blockPicker';

function getInsertPosFromHandle(editor: Editor, handleEl: HTMLElement): number {
  const rect = handleEl.getBoundingClientRect();
  // Sample a point just to the right of the handle, at vertical mid-point
  const result = editor.view.posAtCoords({
    left: rect.right + 24,
    top:  rect.top + rect.height / 2,
  });
  if (!result) return editor.state.doc.content.size;

  const $pos = editor.view.state.doc.resolve(result.pos);
  // Walk up to a top-level child of the doc
  let depth = $pos.depth;
  while (depth > 1) depth--;
  return $pos.end(depth);
}

function showTooltip(tooltip: HTMLElement, targetEl: HTMLElement, text: string): void {
  tooltip.innerHTML = text;
  tooltip.style.display = 'block';
  const rect = targetEl.getBoundingClientRect();
  tooltip.style.left = `${rect.left + window.scrollX + rect.width / 2}px`;
  tooltip.style.top  = `${rect.top  + window.scrollY - tooltip.offsetHeight - 6}px`;
  // Correct left after measuring width
  requestAnimationFrame(() => {
    const tw = tooltip.offsetWidth;
    tooltip.style.left = `${rect.left + window.scrollX + rect.width / 2 - tw / 2}px`;
  });
}

function hideTooltip(tooltip: HTMLElement): void {
  tooltip.style.display = 'none';
}

export function createBlockHandle(editor: Editor): void {
  const picker  = createBlockPicker(editor);
  const tooltip = document.createElement('div');
  tooltip.className = 'block-handle-tooltip';
  document.body.appendChild(tooltip);

  // GlobalDragHandle creates a .drag-handle element after the editor mounts.
  // We augment it with our + button and drag icon once it exists.
  const interval = setInterval(() => {
    const handleEl = document.querySelector<HTMLElement>('.drag-handle');
    if (!handleEl) return;
    clearInterval(interval);

    // Inject + button at the start of the handle
    const plusBtn = document.createElement('button');
    plusBtn.className = 'block-handle-plus';
    plusBtn.textContent = '+';
    handleEl.insertAdjacentElement('afterbegin', plusBtn);

    // Wrap the existing drag icon content in a styled span
    // (GlobalDragHandle puts its icon as direct child text or svg)
    const dragIcon = document.createElement('div');
    dragIcon.className = 'block-handle-drag';
    dragIcon.textContent = '⠿';
    // Replace whatever GlobalDragHandle put inside (keep only our icon)
    Array.from(handleEl.children).forEach(child => {
      if (child !== plusBtn) child.remove();
    });
    handleEl.appendChild(dragIcon);

    // + button: click → open picker
    plusBtn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      picker.open(plusBtn, getInsertPosFromHandle(editor, handleEl));
    });

    // + button: tooltip
    plusBtn.addEventListener('mouseenter', () => {
      showTooltip(tooltip, plusBtn, 'Add block below');
    });
    plusBtn.addEventListener('mouseleave', () => hideTooltip(tooltip));

    // drag icon: click without drag → open picker
    let dragStarted = false;
    dragIcon.addEventListener('dragstart', () => { dragStarted = true; });
    dragIcon.addEventListener('click', e => {
      if (dragStarted) { dragStarted = false; return; }
      e.preventDefault();
      e.stopPropagation();
      picker.open(dragIcon, getInsertPosFromHandle(editor, handleEl));
    });

    // drag icon: tooltip
    dragIcon.addEventListener('mouseenter', () => {
      showTooltip(tooltip, dragIcon,
        '<strong>Drag</strong> to move<br><strong>Click</strong> or <span class="kbd">⌘/</span> to open menu'
      );
    });
    dragIcon.addEventListener('mouseleave', () => hideTooltip(tooltip));
  }, 100);

  // ⌘/ keyboard shortcut — opens picker at current cursor position
  editor.view.dom.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === '/' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      const { from } = editor.state.selection;
      const $pos  = editor.view.state.doc.resolve(from);
      let depth = $pos.depth;
      while (depth > 1) depth--;
      const insertPos = $pos.end(depth);

      // Position picker near cursor
      const coords = editor.view.coordsAtPos(from);
      const anchor = document.createElement('div');
      anchor.style.cssText = `position:fixed;left:${coords.left}px;top:${coords.bottom}px;width:0;height:0`;
      document.body.appendChild(anchor);
      picker.open(anchor, insertPos);
      requestAnimationFrame(() => anchor.remove());
    }
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/webview/blockHandle.ts
git commit -m "feat: add block handle with + button, tooltip, and ⌘/ shortcut"
```

---

### Task 5: Update `src/webview/editor.ts`

**Files:**
- Modify: `src/webview/editor.ts`

- [ ] **Step 1: Add `GlobalDragHandle` to imports and extensions, call `createBlockHandle`**

Replace the full contents of `src/webview/editor.ts`:

```typescript
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import GlobalDragHandle from 'tiptap-extension-global-drag-handle';
import { common, createLowlight } from 'lowlight';
import { Markdown } from 'tiptap-markdown';
import Callout from './extensions/callout';
import Toggle from './extensions/toggle';
import { createBubbleMenu } from './bubbleMenu';
import { createBlockHandle } from './blockHandle';

const lowlight = createLowlight(common);

let _editor: Editor | null = null;
let _debounceTimer: ReturnType<typeof setTimeout> | null = null;

export type OnChangeCallback = (markdown: string) => void;

export function createEditor(
  element: HTMLElement,
  initialMarkdown: string,
  onChange: OnChangeCallback,
): Editor {
  _editor = new Editor({
    element,
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CodeBlockLowlight.configure({ lowlight }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Image,
      Link.configure({ openOnClick: false }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Markdown.configure({ transformCopiedText: true }),
      Callout,
      Toggle,
      GlobalDragHandle.configure({ dragHandleWidth: 48 }),
    ],
    content: initialMarkdown,
    onUpdate({ editor }) {
      if (_debounceTimer) clearTimeout(_debounceTimer);
      _debounceTimer = setTimeout(() => {
        const markdown = editor.storage.markdown.getMarkdown() as string;
        onChange(markdown);
      }, 500);
    },
  });

  createBubbleMenu(_editor);
  createBlockHandle(_editor);
  return _editor;
}

export function updateContent(markdown: string): void {
  if (!_editor) return;
  _editor.commands.setContent(markdown);
}

export function destroyEditor(): void {
  if (_debounceTimer) clearTimeout(_debounceTimer);
  _editor?.destroy();
  _editor = null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/webview/editor.ts
git commit -m "feat: add GlobalDragHandle extension and wire createBlockHandle"
```

---

### Task 6: Build and smoke test

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: all tests pass (including 5 new blockPicker tests).

- [ ] **Step 2: Build**

```bash
npm run compile 2>&1
```

Expected: no TypeScript errors, `Webview built.`

- [ ] **Step 3: Launch Extension Development Host and smoke test**

Press ▶ in VS Code Run & Debug panel. Open any `.md` file. Verify:

1. Hovering a paragraph/heading → row gets a subtle gray tint
2. `+` appears in the left margin (outside the gray)
3. `⠿` appears inside the gray tint area
4. Hovering `+` → it gets a white box with shadow
5. Hovering `⠿` → tooltip appears: "Drag to move / Click or ⌘/ to open menu"
6. Clicking `+` → dark picker opens below, search filter works
7. Typing "head" in filter → only heading items show
8. Pressing Enter → inserts heading below the row
9. Pressing Escape → picker closes
10. Pressing `⌘/` while cursor is in any block → picker opens at cursor
11. Drag `⠿` up or down → block reorders, drop indicator line shows
12. Clicking `⠿` (without dragging) → picker opens

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "chore: verify block handle smoke test complete"
```

---

## Self-Review Notes

**Spec coverage:**
- ✅ 3-state visual (default, hovered, handle-hovered) → CSS + blockHandle.ts
- ✅ `+` outside gray, `⠿` inside → CSS layout on `.drag-handle` container
- ✅ Tooltip on both buttons → `showTooltip`/`hideTooltip` in blockHandle.ts
- ✅ All 13 block types → `BLOCK_DEFS` in blockPicker.ts
- ✅ Image URL prompt → `window.prompt` in image's `insert`
- ✅ Callout + Toggle using existing extensions → `insertContentAt` with correct node types
- ✅ Search filter + keyboard nav (↑↓ Enter Escape) → `blockPicker.ts`
- ✅ Inserts after hovered row → `getInsertPosFromHandle` using `$pos.end(depth)`
- ✅ `⌘/` shortcut → keydown listener in `blockHandle.ts`
- ✅ DnD reorder → `GlobalDragHandle` extension

**Type consistency:**
- `BlockDef` defined in `blockPicker.ts`, used in tests ✅
- `BlockPicker.open(anchorEl, insertPos)` defined and called in `blockHandle.ts` ✅
- `filterBlocks(query: string): BlockDef[]` exported and tested ✅
- `createBlockHandle(editor: Editor): void` matches usage in `editor.ts` ✅
- `createBlockPicker(editor: Editor): BlockPicker` matches usage in `blockHandle.ts` ✅
