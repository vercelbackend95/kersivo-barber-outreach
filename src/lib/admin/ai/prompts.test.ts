import { describe, expect, it } from 'vitest';
import { ASSISTANT_UPGRADE_NOTE, buildDemoAssistantReply } from './prompts';

const SAMPLE_MESSAGES = [
  'How do I raise utilisation?',
  'Grow retail AOV and attach',
  'Where do I mark an order collected?',
  'History vs bookings',
  'Barber time off for vacation',
  'How do I use client reliability tags?',
  'What should I check in reports each week?',
  'Add a new service with a price',
  'Draft an SEO title and meta',
  'Which pomade product should I stock?',
  'Should I take deposits and send SMS?',
  'hello',
];

describe('buildDemoAssistantReply customer-facing copy', () => {
  it('uses the KERSIVO subscription note exactly', () => {
    expect(ASSISTANT_UPGRADE_NOTE).toBe('Unlock the full power of KERSIVO Assistant with a KERSIVO subscription.');
  });

  it.each(SAMPLE_MESSAGES)('never exposes implementation details for %j', (message) => {
    const reply = buildDemoAssistantReply(message);
    expect(reply).not.toMatch(/openai|api[_ ]?key|live model|live ai|production assistant|protected admin|real admin|configured|stream|canned|playbook/i);
    expect(reply).not.toMatch(/Kersivo/);
  });

  it.each(SAMPLE_MESSAGES)('shows the subscription note at most once for %j', (message) => {
    const reply = buildDemoAssistantReply(message);
    expect(reply.split(ASSISTANT_UPGRADE_NOTE).length - 1).toBeLessThanOrEqual(1);
  });

  it('keeps the no-show follow-up and closes with the subscription note', () => {
    const reply = buildDemoAssistantReply('How do I raise utilisation?');
    expect(reply).toContain('Follow-up: Clients tags for repeat no-shows.');
    expect(reply.trim().endsWith(ASSISTANT_UPGRADE_NOTE)).toBe(true);
  });
});
