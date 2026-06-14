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

export type EditResult =
  | { action: 'save'; value: string }
  | { action: 'delete' }
  | { action: 'cancel' };

// Like promptComment, but pre-filled for editing an existing annotation and
// with a Delete button. Used when clicking a badge in the document.
export function promptCommentEdit(opts: { x: number; y: number; initial: string }): Promise<EditResult> {
  activeCleanup?.();

  return new Promise((resolve) => {
    const pop = document.createElement('div');
    pop.className = 'mdep-annotation-input';
    const ta = document.createElement('textarea');
    ta.className = 'mdep-annotation-input-field';
    ta.placeholder = 'Edit comment…  (Enter to save, Esc to cancel)';
    ta.value = opts.initial ?? '';
    const footer = document.createElement('div');
    footer.className = 'mdep-annotation-input-footer';
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'mdep-annotation-input-del';
    del.textContent = 'Delete';
    del.title = 'Delete this annotation';
    footer.appendChild(del);
    pop.appendChild(ta);
    pop.appendChild(footer);
    document.body.appendChild(pop);

    // Clamp within the viewport (after footer is in the DOM so height is real).
    const margin = 8;
    const rect = pop.getBoundingClientRect();
    pop.style.left = `${Math.max(margin, Math.min(opts.x, window.innerWidth - rect.width - margin))}px`;
    pop.style.top = `${Math.max(margin, Math.min(opts.y, window.innerHeight - rect.height - margin))}px`;

    let done = false;
    const finish = (r: EditResult): void => {
      if (done) return;
      done = true;
      cleanup();
      resolve(r);
    };
    const cleanup = (): void => {
      document.removeEventListener('mousedown', onDocMouseDown, true);
      pop.remove();
      if (activeCleanup === cleanup) activeCleanup = null;
    };
    activeCleanup = cleanup;

    const onDocMouseDown = (e: MouseEvent): void => {
      if (!pop.contains(e.target as Node)) finish({ action: 'cancel' });
    };

    del.addEventListener('click', (e) => {
      e.preventDefault();
      finish({ action: 'delete' });
    });

    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const v = ta.value.trim();
        finish(v ? { action: 'save', value: v } : { action: 'cancel' });
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finish({ action: 'cancel' });
      }
    });

    document.addEventListener('mousedown', onDocMouseDown, true);
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  });
}
