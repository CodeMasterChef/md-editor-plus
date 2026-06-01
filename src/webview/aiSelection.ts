// Pure helpers for deriving prompt context from a selection. No DOM/editor imports.

export interface SelectionSummary {
  lines: number;
  words: number;
}

export function summarizeSelection(text: string): SelectionSummary {
  const lines = text.split('\n').filter(l => l.trim().length > 0).length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return { lines, words };
}

export function formatSummary(s: SelectionSummary): string {
  const lineWord = s.lines === 1 ? 'line' : 'lines';
  return `Converting ${s.lines} ${lineWord} · ~${s.words} words`;
}

export function locateAnchors(
  md: string,
  startText: string,
  endText: string,
): { startLine: number | null; endLine: number | null } {
  const lines = md.split('\n');
  const find = (needle: string): number | null => {
    if (!needle) return null;
    const idx = lines.findIndex(l => l.includes(needle));
    return idx === -1 ? null : idx + 1;
  };
  return { startLine: find(startText), endLine: find(endText) };
}

export function truncateAnchor(text: string, max = 80): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length <= max ? collapsed : collapsed.slice(0, max) + '…';
}
