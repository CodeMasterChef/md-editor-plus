# Notion MD Viewer — VS Code Extension Design

**Date:** 2026-05-08
**Status:** Approved

---

## Overview

A VS Code extension that opens `.md` files in a Notion-styled rich-text editor by default. The file renders as a polished Notion-like document with inline block editing — no raw Markdown visible unless the user toggles to source view.

---

## Core Experience

- `.md` files open in the Notion view by default (registered as `CustomTextEditorProvider`)
- Click any block to edit it inline (contenteditable via Tiptap)
- A persistent toggle button switches between **Notion View** and **Source View** (raw text editor)
- Theme follows VS Code's active color scheme (light/dark), with a setting to pin it to light or dark

---

## Architecture

Two runtime contexts communicate via `postMessage`:

### Extension Host (`src/`)

| File | Responsibility |
|---|---|
| `extension.ts` | Entry point. Registers `CustomTextEditorProvider` for `*.md`. Registers commands: `notion-md.openNotionView`, `notion-md.openSourceView`. |
| `notionEditorProvider.ts` | Implements `CustomTextEditorProvider`. Reads file on open, sends content to webview. Receives serialized Markdown back and applies it as a `WorkspaceEdit`. Guards against echo loops with an `_isApplyingEdit` flag. |

### Webview (`src/webview/`)

| File | Responsibility |
|---|---|
| `index.ts` | Bootstraps the editor. Handles `postMessage` from host (`init`, `update`, `themeChange`). |
| `editor.ts` | Tiptap instance with all extensions loaded. Debounces onChange (500ms), serializes to Markdown, fires `postMessage` back to host. |
| `extensions/callout.ts` | Custom Tiptap Node extension for Notion-style callout blocks (emoji + colored bg). Parses `> [!NOTE/WARNING/TIP]` syntax. Implements `toMarkdown` for round-trip. |
| `extensions/toggle.ts` | Custom Tiptap Node extension for collapsible toggle blocks. Uses `<details>/<summary>` HTML. Implements `toMarkdown`. |
| `theme.ts` | Reads VS Code's body class (`vscode-dark` / `vscode-light`). Applies CSS custom properties. Responds to `themeChange` postMessages. |
| `styles/notion-light.css` | CSS custom properties for the light Notion theme. |
| `styles/notion-dark.css` | CSS custom properties for the dark Notion theme. |

### postMessage Protocol

| Direction | Message | When |
|---|---|---|
| Host → Webview | `{ type: 'init', markdown: string }` | File opens |
| Host → Webview | `{ type: 'update', markdown: string }` | External file change detected |
| Host → Webview | `{ type: 'themeChange', theme: 'light' \| 'dark' }` | User changes `notionMdViewer.theme` setting |
| Webview → Host | `{ type: 'edit', markdown: string }` | User edits (debounced 500ms) |

---

## Block Types

All standard Markdown blocks are rendered and editable. Two custom extensions are needed for Notion-specific blocks.

| Block | Markdown Syntax | Tiptap Source |
|---|---|---|
| Heading 1–3 | `# ## ###` | `@tiptap/starter-kit` |
| Paragraph | plain text | `@tiptap/starter-kit` |
| Blockquote | `> text` | `@tiptap/starter-kit` |
| Code block + syntax highlight | ` ```lang ` | `@tiptap/extension-code-block-lowlight` + `lowlight` |
| Bullet / ordered list | `- 1.` | `@tiptap/starter-kit` |
| To-do list (interactive checkboxes) | `- [ ] - [x]` | `@tiptap/extension-task-list` |
| Table | `\| col \|` | `@tiptap/extension-table` |
| Image with caption | `![alt](url)` | `@tiptap/extension-image` |
| Horizontal rule (divider) | `---` | `@tiptap/starter-kit` |
| Callout block | `> [!NOTE]` | **custom** `extensions/callout.ts` |
| Toggle / collapsible | `<details>` | **custom** `extensions/toggle.ts` |
| Inline: bold, italic, strikethrough, code, link | `** * ~~ \` []()` | `@tiptap/starter-kit` |

---

## Edit & Sync Flow

### User edits (webview → file)

1. User types in a Tiptap block
2. Tiptap updates its ProseMirror doc and re-renders instantly
3. `onChange` fires → 500ms debounce timer resets
4. On timer expiry: serialize full doc to Markdown via `@tiptap/extension-markdown`
5. `postMessage({ type: 'edit', markdown })` sent to extension host
6. Host sets `_isApplyingEdit = true`, applies `WorkspaceEdit`, clears flag
7. VS Code marks file dirty; user saves with Cmd+S normally

### External file change (file → webview)

1. `onDidChangeTextDocument` fires in the provider
2. Guard: skip if `_isApplyingEdit` is true (our own edit — ignore)
3. Read updated document text
4. `postMessage({ type: 'update', markdown })` to webview
5. Webview calls `editor.commands.setContent(markdown)` — Tiptap reimports and re-renders

### Toggle between views

- **Notion → Source:** toolbar button fires `vscode.commands.executeCommand('vscode.openWith', uri, 'default')`
- **Source → Notion:** command palette `Open in Notion View` fires `vscode.commands.executeCommand('vscode.openWith', uri, 'notion-md-viewer')`

---

## Theme System

- VS Code automatically applies `vscode-dark`, `vscode-light`, or `vscode-high-contrast` to the webview body — the webview's CSS reacts to this directly, no postMessage needed for VS Code theme changes
- Light and dark Notion themes are CSS custom property sets toggled by a class on the root element
- Extension setting `notionMdViewer.theme`: `"auto"` (default) | `"light"` | `"dark"` — stored in workspace settings, overridable in user settings
- When the setting changes, the host sends `{ type: 'themeChange' }` to the webview, which re-evaluates the active theme class

---

## Notion Design Tokens (both themes)

| Token | Light | Dark |
|---|---|---|
| `--background` | `#ffffff` | `#191919` |
| `--text-primary` | `#37352f` | `#cfcfcf` |
| `--text-secondary` | `#9b9a97` | `#6c7086` |
| `--border` | `#e8e8e8` | `#2f2f2f` |
| `--block-hover` | `#f7f6f3` | `#252525` |
| `--callout-bg` | `#f7f6f3` | `#2d2d1a` |
| `--code-bg` | `#f7f6f3` | `#252525` |
| Font (body) | `ui-sans-serif, 'Inter', sans-serif` | same |
| Font (headings) | `ui-serif, 'Georgia', serif` | same |

---

## Build Pipeline

| Step | Tool |
|---|---|
| Webview bundle | `esbuild` → `dist/webview.js` |
| Extension host compile | `tsc` → `dist/extension.js` |
| Package | `vsce package` → `.vsix` |
| Dev watch | `npm run watch` (runs both in parallel) |

---

## Project Structure

```
md-viewer-mscode/
├── src/
│   ├── extension.ts
│   ├── notionEditorProvider.ts
│   └── webview/
│       ├── index.ts
│       ├── editor.ts
│       ├── theme.ts
│       ├── extensions/
│       │   ├── callout.ts
│       │   └── toggle.ts
│       └── styles/
│           ├── notion-light.css
│           └── notion-dark.css
├── docs/
│   └── superpowers/specs/
│       └── 2026-05-08-notion-md-viewer-design.md
├── package.json
├── tsconfig.json
├── esbuild.config.js
└── .vscodeignore
```

---

## VS Code Extension Manifest (`package.json`) Key Points

- `contributes.customEditors`: registers `notion-md-viewer` for `*.md` with `priority: "default"`
- `contributes.commands`: `notion-md.openSourceView`, `notion-md.openNotionView`
- `contributes.configuration`: `notionMdViewer.theme` enum `["auto", "light", "dark"]`
- `engines.vscode`: `^1.74.0` (minimum for stable CustomEditor API)

---

## Out of Scope

- Slash commands (Notion-style `/` block picker) — future enhancement
- Database / kanban views
- Multi-file linking (`[[wikilinks]]`)
- Publishing or exporting to PDF/HTML
