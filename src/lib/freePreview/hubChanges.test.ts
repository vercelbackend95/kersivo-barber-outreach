import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { hubChangeDraftSchema, renderChangesPlainText, HUB_CHANGE_PAGES } from './hubChanges';
import { HUB_ROUND_USED } from './hubCopy';

describe('hub changes', () => {
  it('validates a draft and renders plain text for back-compat', () => {
    expect(hubChangeDraftSchema.safeParse({ page: 'HOME', body: 'Make the logo larger' }).success).toBe(true);
    expect(hubChangeDraftSchema.safeParse({ page: 'HOME', body: '' }).success).toBe(false);
    expect(HUB_CHANGE_PAGES).toContain('BOOKING');
    expect(
      renderChangesPlainText([
        { page: 'HOME', body: 'Bigger logo' },
        { page: 'SERVICES', body: 'Fade is £22' },
      ]),
    ).toBe('Home: Bigger logo\n\nServices: Fade is £22');
  });

  it('send increments changeRoundsUsed; review create does not', () => {
    const changes = readFileSync(path.join(process.cwd(), 'src/lib/freePreview/hubChanges.ts'), 'utf8');
    expect(changes).toContain('changeRoundsUsed: { increment: 1 }');
    expect(changes).toContain("status: 'CHANGES_REQUESTED'");
    expect(changes).toContain('changesRequestedText: text');
    const reviews = readFileSync(path.join(process.cwd(), 'src/lib/freePreview/hubReviews.ts'), 'utf8');
    expect(reviews).not.toContain('changeRoundsUsed');
    expect(HUB_ROUND_USED).toContain('included round of changes');
  });
});
