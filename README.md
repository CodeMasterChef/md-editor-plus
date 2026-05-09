# MD Editor Plus

**Notion-style markdown block editor for Visual Studio Code.**

Open any Markdown file and it renders as polished, block-based content. Click anywhere to edit, drag blocks to reorder, slash to insert. Your file stays plain Markdown on disk, so it works with every other tool in your pipeline.

![MD Editor Plus](media/icon.png)

---

## Why use it

VS Code's built-in preview is great for reading. The default text editor is great for editing. **MD Editor Plus is what you want when you actually want to write**: the way you write in Notion or Linear, not the way you write a config file.

- Blocks behave like blocks: drag, click, slash to insert
- Real headings, real lists, real tables, no `## Heading 2` clutter
- Round-trips Markdown losslessly, so commits stay clean
- Works on any folder. No database, no cloud, no migration

### Coming from Notion?

If you're a vibe-coder who lives inside Notion, Linear, or Coda and you're tired of staring at raw `##` headings the moment you open a `.md` file, this extension is built for you. The block model, the drag handles, the slash menu, the bubble formatting toolbar, the page-width feel: it's all there, just rendered over local Markdown files instead of a SaaS database. Your README, your design docs, your scratchpads. Same muscle memory, no migration.

---

## Supported file types

The block view registers itself as a custom editor for:

`*.md`, `*.markdown`, `*.mdown`, `*.mkd`, `*.mdx`

MDX content is rendered as Markdown; embedded JSX falls into raw paragraphs (or you can edit it directly in **Code view**).

---

## Getting started

1. Install **MD Editor Plus** from the Marketplace.
2. Open any `.md` file. It appears in the block view by default.
3. Press `⌘/` (`Ctrl+/` on Windows/Linux) anywhere to insert a new block.
4. Hover any block to grab its drag handle (`⠿`) and reorder it.
5. Need raw Markdown? Click the **Code** segment in the toolbar, or run **MD Editor Plus: Open Source View** from the Command Palette.

To switch a single file back to VS Code's default editor, run **MD Editor Plus: Open Source View** or use **Reopen Editor With…** from the editor's title bar.

---

## The toolbar

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [logo]  [Preview | Code]              filename.md              [Aa] [⋯] │
└─────────────────────────────────────────────────────────────────────────┘
```

The toolbar fades to 50% opacity when your cursor isn't near it, so it stays out of the way while you write. Bring the mouse within ~150 px of the top of the page and it lights back up.

| Element | Behavior |
|---|---|
| **Logo** | Icon for the extension. |
| **Preview / Code** | Switch between the rendered block view and the raw Markdown view. The active button shows its label (`Preview` or `Code`). |
| **Filename** | Centered. **Hover** to open the actions menu (Copy, Duplicate, etc.). The full name shows in a native tooltip when truncated. |
| **Aa** | **Click** to open the display-settings panel (theme, page width, font, code-block options). |
| **⋯** | **Click** to open the actions menu, anchored to the top-right. |

Filename hover and ⋯ click open the same actions list, but each anchors its own panel. They are independent surfaces, so the hover behavior never accidentally triggers the click target and vice versa.

---

## Display settings (Aa)

Every visual setting is **runtime-only by default**. Change anything you like for the current session and it won't follow you to other files. Click **Save view as default** at the bottom to commit the current view as your global default; **Reset** clears your saved defaults and restores the built-in ones.

### Theme

Four hand-tuned themes, plus **Sync with system** to follow VS Code's color theme automatically.

| Theme | Vibe |
|---|---|
| **Light** | Notion's classic clean white background |
| **Claude** | Soft warm tones inspired by Claude.ai |
| **Sepia** | Paper-warm, easy on long reading sessions |
| **Dark** | Deep neutrals, comfortable at night |

Hover any theme button for a live color-swatch preview.

### Page width

A continuous slider with **magnetic snap stops** at 600 / 800 / 1000 / 1200 / 1400 px.

- Drag the thumb freely; release within ~30 px of a stop and it snaps.
- Click any dot to jump to that width.
- The blue pill on the right shows the live value.
- **Full width** toggle below acts as an override. When on, the page fills the entire window. Touching the slider or clicking a stop while Full width is on automatically turns it off.

### Text size

`S` / `M` / `L` / `XL` (14 / 16 / 18 / 20 px). Each button's tooltip previews "The quick brown fox" rendered at that exact size, so you can taste-test before committing.

### Font

`Sans` / `Serif` / `Mono`. Tooltips preview each face the same way.

### Code blocks

Four toggles for the developer-leaning bits:

| Toggle | Effect |
|---|---|
| **Always dark: Code Snippets** | Force fenced code blocks to use a dark background even when the page theme is light. Editing a doc on a light theme but want IDE-style code? This. |
| **Always dark: Code view** | Same idea, but for the raw Markdown source view. |
| **Full width: Only in Code view** | Source view fills the window even when the rendered view stays narrow. Great for diff-friendly long lines. |
| **Shorten Code Snippets** | Long code blocks collapse to a preview with a **Show more / Show less** button. |

### Save view as default

Captures every visible setting (theme, font, text size, page width, full-width, all four code-block toggles) and writes them to your **User-scope** VS Code settings. They follow you across every project from now on. The button is disabled when the current view already matches what's saved.

### Reset

Clears the saved defaults and restores the built-in ones (Light theme, Sans font, Medium text, 800 px page, all toggles off). Disabled when nothing has been customized.

---

## Actions menu (filename hover or ⋯)

| Action | What it does |
|---|---|
| **Copy page content** | Copies the entire Markdown to your clipboard |
| **Copy file path** | Copies the absolute filesystem path |
| **Duplicate** | Creates `name copy.md` in the same folder and opens it |
| **Open in Finder** | Reveals the file in Finder / Explorer / your OS browser |

---

## Editor blocks

Click `+` in the gutter or press `⌘/` (`Ctrl+/`) to open the **block picker**. Filter by typing.

| Section | Blocks |
|---|---|
| **Text** | Paragraph, Heading 1, Heading 2, Heading 3 |
| **Lists** | Bullet list, Numbered list, Task list |
| **Media** | Image, Callout, Toggle |
| **Other** | Blockquote, Code block, Divider |

### Task lists

Render as actual checkboxes. Click to toggle. Your changes round-trip to standard `- [ ]` / `- [x]` Markdown.

### Tables

Insert from the block picker, then edit cells inline. Add rows and columns from the bubble menu when the cursor is in a table.

### Code blocks

A first-class block, not just a `<pre>`:

- **Syntax highlighting** for ~50 languages via [lowlight](https://github.com/wooorm/lowlight)
- **Line-number gutter** with click-and-drag to **reorder lines** within the block
- **Copy button** in the header
- **Show more / Show less** when "Shorten Code Snippets" is on (collapses anything over ~12 lines)
- **Smart paste**: pasting a fenced code block (` ```lang\n…\n``` `) into an existing code block strips the wrapper

### Callouts

GitHub-flavored `> [!NOTE]`, `> [!WARNING]`, `> [!TIP]`, etc. Render with a colored background and an emoji icon.

```markdown
> [!NOTE] 💡
> Callout blocks render with color and icon.
```

### Toggles

Collapsible sections that hide their contents until clicked. Useful for FAQs, long answer keys, etc. Round-trip as HTML `<details>` blocks.

### Drag handle

Hover any block (paragraph, heading, list, image, code block, anything) to surface a `⠿` handle in the left gutter. Grab it to drag the whole block to a new position.

### Bubble menu

Select any text and a contextual toolbar appears above the selection.

| Group | Buttons |
|---|---|
| **Inline formatting** | Bold, italic, underline, strikethrough, inline code |
| **Linking & color** | Insert link, text color, highlight color |
| **Insert** | Emoji picker |
| **Convert** | "Turn into" submenu. Change paragraph to heading, list, quote, code block, etc. |

### Frontmatter

YAML (`---`) and TOML (`+++`) frontmatter is **detected automatically** and hidden from the rendered view (so the document doesn't start with stray horizontal rules and ugly key-value paragraphs). A small **FRONTMATTER · N lines** pill appears at the top of the editor. Click it to jump to **Code view** where you can edit the frontmatter directly. The frontmatter is preserved losslessly on save.

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `⌘/` &nbsp;/&nbsp; `Ctrl+/` | Open the block picker at the cursor |
| `⌘B` &nbsp;/&nbsp; `Ctrl+B` | Bold |
| `⌘I` &nbsp;/&nbsp; `Ctrl+I` | Italic |
| `⌘U` &nbsp;/&nbsp; `Ctrl+U` | Underline |
| `⌘⇧X` &nbsp;/&nbsp; `Ctrl+Shift+X` | Strikethrough |
| `⌘E` &nbsp;/&nbsp; `Ctrl+E` | Inline code |
| `⌘K` &nbsp;/&nbsp; `Ctrl+K` | Insert link |
| `Esc` | Close any open menu / popover |

The bubble menu shows the relevant shortcut next to each button.

---

## Tooltips

Every interactive control has a custom tooltip. Text-only for buttons, **rich previews** where useful (theme color swatches, text-size and font samples, slider stop labels). Tooltips appear after a 350 ms hover delay, flip above/below the target depending on screen edge, and dismiss on scroll, click, blur, or `Esc`.

---

## Commands

Available via the Command Palette (`⌘⇧P` / `Ctrl+Shift+P`):

| Command | Description |
|---|---|
| **MD Editor Plus: Open Block View** | Reopens the active file with the block editor |
| **MD Editor Plus: Open Source View** | Reopens the active file with VS Code's default text editor |

---

## Settings reference

All settings live under `mdEditorPlus.*` in your User or Workspace settings. They're written by the **Save view as default** button, but you can edit them by hand if you prefer.

| Setting | Type | Default | Description |
|---|---|---|---|
| `mdEditorPlus.theme` | `"auto"` \| `"light"` \| `"sepia"` \| `"claude"` \| `"dark"` | `"light"` | Default color theme |
| `mdEditorPlus.font` | `"sans"` \| `"serif"` \| `"mono"` | `"sans"` | Default font family |
| `mdEditorPlus.textSize` | `"s"` \| `"m"` \| `"l"` \| `"xl"` | `"m"` | Default text size |
| `mdEditorPlus.pageWidth` | `number` (400 to 2400) | `800` | Default page width in px |
| `mdEditorPlus.fullWidth` | `boolean` | `false` | Open in full-window-width by default |
| `mdEditorPlus.alwaysDarkCode` | `boolean` | `false` | Force dark code blocks regardless of page theme |
| `mdEditorPlus.alwaysDarkSource` | `boolean` | `false` | Force dark source view regardless of page theme |
| `mdEditorPlus.sourceFullWidth` | `boolean` | `false` | Render source view at full width even when the page is narrow |
| `mdEditorPlus.shortenCodeSnippets` | `boolean` | `false` | Collapse long code snippets behind a Show more button |

---

## Markdown compatibility

MD Editor Plus reads and writes **CommonMark** plus the GitHub-flavored extensions you'd expect:

- Headings, paragraphs, blockquotes, lists (bulleted, ordered, task)
- Tables (GFM pipe syntax)
- Strikethrough, inline code, fenced code blocks with language
- Links, autolinks, images
- HTML passthrough (`<details>`, etc.)
- GFM callouts: `> [!NOTE]`, `> [!WARNING]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!CAUTION]`
- YAML / TOML frontmatter (preserved, not rendered)

Open the bundled `demo.md` to see every supported block in one place.

---

## Tips & tricks

- **Quick raw view**: even without leaving the block view, the bubble menu's `code` button wraps the selection in inline code. For a full code block, use the block picker.
- **Drag a code line**: inside a code block, the line numbers are draggable. Reorder lines without re-typing.
- **Touch the slider, kill Full width**: Full width is intentionally an override, not a mode. Any interaction with the page-width slider (drag, keyboard arrows, click a stop) automatically clears Full width.
- **Save view per project**: saves are global by default (every project gets the same defaults). Edit `.vscode/settings.json` directly if you want a project-specific override; Workspace-scope settings beat User-scope on file open.
- **Frontmatter edits**: the pill at the top is your shortcut into Code view, where the frontmatter is the first block of text.

---

## Requirements

- VS Code **1.74** or newer.
- No external services, no telemetry, no network calls. Everything runs locally in the webview.

---

## Known limitations

- Very large Markdown files (>1 MB) may take a beat to render on first open.
- Image paths render relative to the workspace root.
- MDX support is "lite". Embedded JSX renders as raw text in the rendered view; for full MDX editing, switch to **Code view**.

---

## Release notes

See [CHANGELOG.md](CHANGELOG.md).

---

## License

[MIT](LICENSE)
