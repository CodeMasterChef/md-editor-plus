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
