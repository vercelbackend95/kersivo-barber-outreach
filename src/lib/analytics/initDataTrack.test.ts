/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { initDataTrack } from './initDataTrack';
import { trackConsentedEvent } from '@/lib/consent/events';

vi.mock('@/lib/consent/events', () => ({
  trackConsentedEvent: vi.fn(),
}));

const trackSpy = vi.mocked(trackConsentedEvent);

describe('initDataTrack', () => {
  beforeAll(() => {
    initDataTrack();
  });

  beforeEach(() => {
    trackSpy.mockClear();
    document.body.innerHTML = '';
  });

  it('fires trackConsentedEvent once when clicking a link with data-track', () => {
    const link = document.createElement('a');
    link.href = '#pricing';
    link.setAttribute('data-track', 'plan_my_setup_click');
    document.body.appendChild(link);

    link.click();

    expect(trackSpy).toHaveBeenCalledTimes(1);
    expect(trackSpy).toHaveBeenCalledWith('plan_my_setup_click', undefined, 'analytics');
  });

  it('fires trackConsentedEvent once when clicking button[type=button] with data-track', () => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('data-track', 'view_live_demo_click');
    document.body.appendChild(button);

    button.click();

    expect(trackSpy).toHaveBeenCalledTimes(1);
    expect(trackSpy).toHaveBeenCalledWith('view_live_demo_click', undefined, 'analytics');
  });

  it('does not fire when clicking button[type=submit] with data-track', () => {
    const form = document.createElement('form');
    form.addEventListener('submit', (event) => event.preventDefault());
    const button = document.createElement('button');
    button.type = 'submit';
    button.setAttribute('data-track', 'setup_enquiry_submit');
    form.appendChild(button);
    document.body.appendChild(form);

    button.click();

    expect(trackSpy).not.toHaveBeenCalled();
  });

  it('does not fire automatically on form submit', () => {
    const form = document.createElement('form');
    form.setAttribute('data-track', 'setup_enquiry_submit');
    const button = document.createElement('button');
    button.type = 'submit';
    button.setAttribute('data-track', 'setup_enquiry_submit');
    form.appendChild(button);
    document.body.appendChild(form);

    form.addEventListener('submit', (event) => event.preventDefault());
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(trackSpy).not.toHaveBeenCalled();
  });

  it('does not register duplicate listeners when initDataTrack is called twice', () => {
    initDataTrack();
    initDataTrack();

    const link = document.createElement('a');
    link.href = '#contact';
    link.setAttribute('data-track', 'ask-about-setup');
    document.body.appendChild(link);

    link.click();

    expect(trackSpy).toHaveBeenCalledTimes(1);
    expect(trackSpy).toHaveBeenCalledWith('ask-about-setup', undefined, 'analytics');
  });
});
