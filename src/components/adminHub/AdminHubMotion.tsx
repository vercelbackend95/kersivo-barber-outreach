import { useEffect } from 'react';

const COUNT_MS = 650;

function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - 2 ** (-10 * t);
}

/**
 * Overview micro-interactions. Renders nothing; everything is progressive:
 * - pointer spotlight on tiles and a slight lean on the preview phone (mouse / pen only);
 * - the Changes figures count up once.
 * Skipped entirely under `prefers-reduced-motion: reduce`. No layout is read inside the frame callback.
 */
export function AdminHubMotion() {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const bento = document.querySelector<HTMLElement>('.admin-hub-bento');
    if (!bento) return;

    const cleanups: Array<() => void> = [];

    // Count-up: the server-rendered number stays in the DOM for screen readers and no-JS; only the paint changes.
    for (const node of bento.querySelectorAll<HTMLElement>('[data-hub-count]')) {
      const target = Number(node.textContent);
      if (!Number.isFinite(target) || target <= 0) continue;
      const label = String(target);
      const start = performance.now();
      let frame = 0;
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / COUNT_MS);
        node.textContent = String(Math.round(target * easeOutExpo(progress)));
        if (progress < 1) frame = requestAnimationFrame(tick);
        else node.textContent = label;
      };
      frame = requestAnimationFrame(tick);
      cleanups.push(() => {
        cancelAnimationFrame(frame);
        node.textContent = label;
      });
    }

    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      let frame = 0;
      let last: PointerEvent | null = null;
      let tilted: HTMLElement | null = null;

      const apply = () => {
        frame = 0;
        const event = last;
        if (!event) return;
        const tile = (event.target as Element | null)?.closest<HTMLElement>('.admin-hub-tile');
        if (!tile) return;
        const rect = tile.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        tile.style.setProperty('--hub-mx', `${x}px`);
        tile.style.setProperty('--hub-my', `${y}px`);
        const phone = tile.querySelector<HTMLElement>('.admin-hub-phone');
        if (phone && !tile.classList.contains('admin-hub-tile--locked')) {
          const dx = x / rect.width - 0.5;
          const dy = y / rect.height - 0.5;
          phone.style.setProperty('--hub-ry', `${(dx * 12).toFixed(2)}deg`);
          phone.style.setProperty('--hub-rx', `${(-dy * 8).toFixed(2)}deg`);
          tilted = phone;
        }
      };
      const onMove = (event: PointerEvent) => {
        if (event.pointerType === 'touch') return;
        last = event;
        if (!frame) frame = requestAnimationFrame(apply);
      };
      const reset = () => {
        last = null;
        if (!tilted) return;
        tilted.style.removeProperty('--hub-rx');
        tilted.style.removeProperty('--hub-ry');
        tilted = null;
      };
      const onOut = (event: PointerEvent) => {
        const from = (event.target as Element | null)?.closest('.admin-hub-bento__preview');
        const to = (event.relatedTarget as Element | null)?.closest?.('.admin-hub-bento__preview');
        if (from && from !== to) reset();
      };
      bento.addEventListener('pointermove', onMove, { passive: true });
      bento.addEventListener('pointerout', onOut, { passive: true });
      cleanups.push(() => {
        bento.removeEventListener('pointermove', onMove);
        bento.removeEventListener('pointerout', onOut);
        if (frame) cancelAnimationFrame(frame);
        reset();
      });
    }

    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, []);

  return null;
}
