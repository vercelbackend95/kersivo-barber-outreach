import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(process.cwd(), 'src/styles/components/admin-ai.css'), 'utf8');

function rule(selector: string, source = css): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`));
  expect(match, `missing rule ${selector}`).toBeTruthy();
  return match![1];
}

describe('Assistant showcase layout contract', () => {
  it('bounds the shell to the content canvas without growing', () => {
    const shell = rule('.admin-assistant-shell--showcase');
    expect(shell).toMatch(/height:\s*100%/);
    expect(shell).toMatch(/max-height:\s*100%/);
    expect(shell).toMatch(/min-height:\s*0/);
    expect(shell).toMatch(/overflow:\s*hidden/);
  });

  it('gives the header its intrinsic height and the layout only what is left', () => {
    expect(rule('.admin-assistant-shell--showcase > .admin-section-header')).toMatch(/flex:\s*0 0 auto/);
    const layout = rule('.admin-assistant-shell--showcase > .admin-assistant-layout');
    expect(layout).toMatch(/flex:\s*1 1 0/);
    expect(layout).toMatch(/min-height:\s*0/);
    expect(layout).toMatch(/grid-template-rows:\s*minmax\(0, 1fr\)/);
  });

  it('overrides the normal chat min-height and makes the history the only flexible child', () => {
    const chat = rule('.admin-assistant-shell--showcase .admin-assistant-chat');
    expect(chat).toMatch(/min-height:\s*0/);
    expect(chat).toMatch(/max-height:\s*100%/);
    const list = rule('.admin-assistant-shell--showcase .admin-assistant-messages');
    expect(list).toMatch(/flex:\s*1 1 0/);
    expect(list).toMatch(/min-height:\s*0/);
    expect(list).toMatch(/overflow-y:\s*auto/);
    expect(css).toMatch(
      /\.admin-assistant-shell--showcase \.admin-assistant-error,\s*\.admin-assistant-shell--showcase \.admin-assistant-starters,\s*\.admin-assistant-shell--showcase \.admin-assistant-composer\s*\{\s*flex:\s*0 0 auto;/,
    );
  });

  it('keeps the normal Assistant rules untouched', () => {
    expect(rule('.admin-assistant-chat')).toMatch(/min-height:\s*clamp\(28rem, 68vh, 42rem\)/);
    expect(rule('.admin-assistant-shell')).not.toMatch(/height/);
    const narrowNormal = css.slice(css.indexOf('@media (max-width: 47.99rem)'));
    expect(narrowNormal).toMatch(/\.admin-assistant-chat \{\s*min-height:\s*clamp\(24rem, 62vh, 36rem\)/);
    const showcaseSelectors = css.match(/[^{}]*\{/g)!.filter((selector) => /showcase/.test(selector));
    expect(showcaseSelectors.every((selector) => selector.includes('.admin-assistant-shell--showcase') || selector.includes('@media'))).toBe(true);
  });
});
