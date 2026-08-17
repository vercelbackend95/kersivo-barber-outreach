import { describe, expect, it } from 'vitest';
import {
  DEMO_CONTACT_EMAIL_MAX,
  DEMO_CONTACT_MAP_LABEL,
  DEMO_CONTACT_MAP_WARNING,
  DEMO_CONTACT_MESSAGE_MAX,
  DEMO_CONTACT_NAME_MAX,
  DEMO_CONTACT_SAFETY_LABEL,
  DEMO_CONTACT_SUCCESS,
  validateDemoContact,
} from './contact';

describe('BLACKLINE demo contact helpers', () => {
  it('exposes map, safety, and field limits without implying a real enquiry channel', () => {
    expect(DEMO_CONTACT_MAP_LABEL).toContain('fictional BLACKLINE demonstration location');
    expect(DEMO_CONTACT_MAP_WARNING).toBe('Illustrative map · Not for navigation');
    expect(DEMO_CONTACT_SAFETY_LABEL).toBe('Demo form · No message will be sent');
    expect(DEMO_CONTACT_SUCCESS).toBe('Demo complete. No message was sent or stored.');
    expect(DEMO_CONTACT_NAME_MAX).toBe(80);
    expect(DEMO_CONTACT_EMAIL_MAX).toBe(254);
    expect(DEMO_CONTACT_MESSAGE_MAX).toBe(1000);
    expect(DEMO_CONTACT_SUCCESS.toLowerCase()).not.toMatch(/we’ll get back|message sent|we’ll be in touch|has been received/);
  });

  it('validates the three demo fields locally', () => {
    expect(validateDemoContact({ name: '', email: '', message: '' })).toEqual({
      name: 'Enter your name.',
      email: 'Enter your email.',
      message: 'Enter a message.',
    });
    expect(validateDemoContact({ name: 'Alex', email: 'not-an-email', message: 'Hello' }).email).toBe(
      'Enter a valid email address.',
    );
    expect(validateDemoContact({ name: 'Alex', email: 'alex@example.com', message: 'Chair availability' })).toEqual({});
  });
});
