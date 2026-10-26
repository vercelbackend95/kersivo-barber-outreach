import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const chooser = read('src/components/SystemChooser.astro');
const handler = read('src/lib/initSystemChooser.ts');

describe('homepage live demo chooser', () => {
  it('exposes both demo options as genuine new-tab links for keyboard and browser users', () => {
    expect(chooser).toMatch(/<a\s+class="system-chooser__tile system-chooser__tile--clients"\s+href="\/book"\s+target="_blank"\s+rel="noopener noreferrer"/);
    expect(chooser).toMatch(/<a\s+class="system-chooser__tile system-chooser__tile--barbers"\s+href="\/admin-demo\?section=bookings_dashboard"\s+target="_blank"\s+rel="noopener noreferrer"/);
    expect(chooser).not.toContain('role="link"');
    expect(chooser).not.toContain('tabindex="0"');
    expect(chooser).toContain('role="dialog"');
    expect(chooser).toContain('aria-modal="true"');
  });

  it('opens a new tab during user activation, before any async session lookup', () => {
    const activation = handler.slice(
      handler.indexOf('const activateTile = async'),
      handler.indexOf('  tiles.forEach((tile) => {', handler.indexOf('const activateTile = async')),
    );
    expect(activation).toContain("window.open('about:blank', '_blank')");
    expect(activation.indexOf("window.open('about:blank', '_blank')")).toBeLessThan(
      activation.indexOf("await fetch('/api/admin/session'"),
    );
    expect(activation).toContain('newTab.opener = null');
    expect(activation).toContain('newTab.location.replace(targetHref)');
    expect(activation).toContain('window.location.assign(targetHref)');
    expect(handler).toContain('event.metaKey || event.ctrlKey || event.shiftKey || event.altKey');
  });

  it('returns focus and traps Tab navigation while the dialog is open', () => {
    expect(handler).toContain('lastOpenTrigger.focus()');
    expect(handler).toContain("if (event.key === 'Escape')");
    expect(handler).toContain("event.key !== 'Tab'");
    expect(handler).toContain('last.focus()');
    expect(handler).toContain('first.focus()');
  });
});
