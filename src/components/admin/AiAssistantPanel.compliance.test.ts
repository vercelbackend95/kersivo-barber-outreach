import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CURRENT_DPA_VERSION } from '@/lib/legal/dpaVersion';
import { CURRENT_TERMS_VERSION } from '@/lib/legal/termsVersion';

const here = dirname(fileURLToPath(import.meta.url));

function readRepoFile(...segments: string[]): string {
  return readFileSync(join(here, ...segments), 'utf8');
}

const DATA_MINIMISATION_NOTICE =
  'Do not enter client personal data, sensitive information or confidential booking notes unless it is necessary for your request.';

describe('Admin AI assistant compliance surfaces', () => {
  it('shows a data-minimisation notice and Clear chat without durable browser storage', () => {
    const panel = readRepoFile('AiAssistantPanel.tsx');
    const normalized = panel.replace(/\s+/g, ' ');
    expect(normalized).toContain(DATA_MINIMISATION_NOTICE);
    expect(panel).toContain('Clear chat');
    expect(panel).toContain("fetch('/api/admin/ai/chat'");
    expect(panel).toContain('admin-assistant-data-notice');
    expect(panel).not.toContain('localStorage');
    expect(panel).not.toContain('sessionStorage');
    expect(panel).not.toMatch(/indexedDB/i);
    expect(panel).not.toContain('kersivo-admin-assistant-thread-v1');
  });

  it('forwards free-text messages to OpenAI without claiming server-side CPD scrub', () => {
    const api = readRepoFile('../../pages/api/admin/ai/chat.ts');
    expect(api).toContain("requireAdminPermission(ctx, 'ai.use')");
    expect(api).toContain('OPENAI_API_KEY');
    expect(api).toContain('chat.completions.create');
    expect(api).not.toContain('sanitizeOpsText');
    expect(api).not.toContain('scrubSentryEvent');
    expect(api).toContain("console.error('[admin/ai/chat] OpenAI request failed'");
    expect(api).toContain('{ name:');
    expect(api).not.toMatch(/console\.error\('\[admin\/ai\/chat\] OpenAI request failed', error\)/);
  });

  it('warning notice covers personal data, sensitive information and confidential booking notes', () => {
    const panel = readRepoFile('AiAssistantPanel.tsx');
    const normalized = panel.replace(/\s+/g, ' ');
    expect(normalized).toContain('client personal data');
    expect(normalized).toContain('sensitive information');
    expect(normalized).toContain('confidential booking notes');
    expect(panel).not.toMatch(/name="dpaAccepted"/);
    expect(panel).not.toMatch(/I consent to AI/i);
  });

  it('keeps Terms and DPA versions aligned after the Slack-removal disclosure update', () => {
    expect(CURRENT_TERMS_VERSION).toBe('2026-09-22');
    expect(CURRENT_DPA_VERSION).toBe('2026-09-22');
  });

  it('keeps a single LaunchWizard Terms acceptance checkbox', () => {
    const launchWizard = readRepoFile('launch/LaunchWizard.tsx');
    const checkboxCount = (launchWizard.match(/name="termsAccepted"/g) ?? []).length;
    expect(checkboxCount).toBe(1);
    expect(launchWizard).not.toMatch(/name="dpaAccepted"/);
  });

  it('keeps OpenAI conditional Sub-processor disclosure and Twilio active; AWS not active', () => {
    const dpa = readRepoFile('../../pages/dpa.astro');
    const privacy = readRepoFile('../../pages/privacy.astro');
    expect(dpa).toContain('OpenAI');
    expect(dpa).toContain('OPENAI_API_KEY');
    expect(dpa).toContain('Twilio');
    expect(dpa).not.toMatch(/\bAWS\b/);
    expect(privacy).toContain('OpenAI');
    expect(privacy).toContain('Twilio');
    expect(privacy).not.toMatch(/\bAWS\b/);
  });
});
