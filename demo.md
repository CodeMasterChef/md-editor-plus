# MD Editor Plus

A beautiful Markdown editor for VS Code. Write in Markdown, see it like Notion.

---

## Getting Started

Open any `.md` file and it renders instantly in Notion style. Click any block to edit it inline. No raw syntax in sight.

> **Tip:** Use the toolbar at the top to switch themes, adjust width, or toggle between the preview and raw source.

---

## What It Looks Like

Every Markdown element gets the Notion treatment — clean typography, generous spacing, and just enough polish to make your notes feel like a real document.

### Headings

Three heading levels with tight, confident line heights. Perfect for structured notes, planning docs, and technical specs.

### Inline Formatting

You can write **bold**, *italic*, ~~strikethrough~~, and `inline code` just like normal Markdown. The bubble menu appears whenever you select text — giving you formatting controls right where you need them.

### Code Blocks

Full syntax highlighting out of the box:

```typescript
interface Document {
  title: string;
  blocks: Block[];
  createdAt: Date;
}

function render(doc: Document): string {
  return doc.blocks
    .map(block => block.toHTML())
    .join('\n');
}
```

---

## Callout Blocks

> [!NOTE] 💡
> Callout blocks are great for tips, warnings, and important information. They render with a colored background and an emoji icon.

> [!WARNING] ⚠️
> Be careful when editing the source view — changes sync back to the file in real time.

---

## Lists

**Task lists** are interactive — checkboxes actually work:

- [x] Install MD Editor Plus
- [x] Open a Markdown file
- [ ] Try the bubble menu on selected text
- [ ] Drag a block to reorder it
- [ ] Explore the block picker with `⌘/`

**Bullet lists** for unordered items:

- Clean, minimal rendering
- Generous line height for readability
- Nested lists supported

**Numbered lists** for sequences:

1. Select some text
2. The bubble menu appears above
3. Choose a formatting option
4. Done — no raw syntax required

---

## Tables

| Feature | Status | Notes |
|---|---|---|
| Inline editing | ✅ | Click any block |
| Bubble menu | ✅ | Appears on text select |
| Block picker | ✅ | `⌘/` or `+` icon |
| Drag to reorder | ✅ | Grab the `⠿` handle |
| Light / Dark / Auto | ✅ | Syncs with VS Code theme |
| Narrow / Medium / Full width | ✅ | Toolbar toggle |

---

## Block Picker

Hover any block and a `+` icon appears in the left margin. Click it to insert a new block below — headings, lists, code, callouts, toggles, images, and more. Or press `⌘/` from anywhere to open the picker at your cursor.

---

## Theme Support

Three theme modes, switchable from the toolbar:

- **Light** — Clean white background, Notion's classic look
- **Dark** — Deep dark background, easy on the eyes
- **Auto** — Follows your VS Code theme automatically

---

*Made for developers who want their notes to look as good as their code.*
