# Backlog

Running list of work explicitly deferred from shipped or designed features.
Each item names the spec it was deferred from so the context isn't lost.

Add new entries at the top of each section.

---

## Board — table view (deferred from `2026-05-23-board-table-view-design.md`)

- Multi-column sort
- "Group by week / month" smart bucketing for `date` fields (v1 buckets by exact value)
- Multi-group membership when grouping by `tags` (v1: card appears only in its first tag's group)
- Frozen / sticky first column on horizontal scroll
- Filter / search bar inside the table
- Aggregations in the group header row (count, sum, avg)
- Conditional formatting (cell color by value)
- Bulk-select rows + bulk edit
- CSV / markdown export of the table
- Per-view saved presets (e.g. "Show overdue only")
- Persisted group-collapse state (v1 keeps it in-memory; resets on reload)

## Board — other views (designed-for, not built)

- Calendar view — cards laid out by a `date` field on a month grid
- Timeline / Gantt view — needs a new field type (`daterange` / start+end)

## Board — kanban v1 carry-overs (from `2026-05-20-board-block-design.md`)

- Side panel resize handle (fixed 420 px in v1)
- Saved filters or search within a board
- Card relations (link a card to another card)
- Templates (preset boards)
- Formulas, rollups, aggregates
- Comments / activity log on cards
- `@`-mention autocomplete from a member list (free text only in v1)
- Auto-promotion of existing markdown task lists into a board
- Multi-card selection / bulk move
- Per-board color theming beyond status colors
- Export to CSV / JSON
- Pinning / docking the side panel

## Mermaid visual edit — a11y polish (from the agent audit)

- `aria-pressed` on shape picker icons, B/I/U/S type chips, padding/line-height segmented buttons
- `aria-haspopup` + `aria-expanded` on Fill/Stroke/Text/Align/Shape popover triggers
- Focus management: focus first item on popover open, return focus to trigger on close
- Per-popover Escape close (currently only the visual-edit-wide panic Escape)

## Mermaid — still unverified in real host

- Connector-dot click hang (couldn't repro in harness; added defensive Escape + try/catch)
- White popover visual fidelity across all themes (light/dark/sepia/claude)
