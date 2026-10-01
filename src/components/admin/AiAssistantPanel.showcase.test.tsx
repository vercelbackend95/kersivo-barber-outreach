/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import AiAssistantPanel from './AiAssistantPanel';

const LIST_SCROLL_HEIGHT = 4800;

function sendStarter(label: string) {
  const starter = [...document.querySelectorAll<HTMLButtonElement>('.admin-assistant-starter')]
    .find((button) => button.textContent?.trim() === label)!;
  fireEvent.click(starter);
}

async function waitForReply() {
  await waitFor(() => expect(document.querySelector('.admin-assistant-starter:disabled')).toBeNull(), { timeout: 5000 });
}

describe('AiAssistantPanel in the hero showcase', () => {
  let intoView: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    intoView = vi.fn();
    Element.prototype.scrollIntoView = intoView;
  });

  afterEach(() => {
    cleanup();
  });

  it('marks the showcase shell for the bounded-height contract', () => {
    render(<AiAssistantPanel isPublicDemo showcaseMode />);
    const shell = document.querySelector('.admin-assistant-shell')!;
    expect(shell.classList.contains('admin-assistant-shell--showcase')).toBe(true);
    expect(shell.getAttribute('data-assistant-showcase')).toBe('true');
  });

  it('keeps starters and the composer outside the scrollable message history', () => {
    render(<AiAssistantPanel isPublicDemo showcaseMode />);
    const list = document.querySelector('.admin-assistant-messages')!;
    const chat = document.querySelector('.admin-assistant-chat')!;
    for (const selector of ['.admin-assistant-starters', '.admin-assistant-composer', '.admin-assistant-data-notice', 'button[type="submit"]']) {
      const element = document.querySelector(selector)!;
      expect(list.contains(element)).toBe(false);
      expect(chat.contains(element)).toBe(true);
    }
  });

  it('pins only the message history to the newest message, never scrolling an ancestor', async () => {
    const { container } = render(<AiAssistantPanel isPublicDemo showcaseMode />);
    const list = document.querySelector<HTMLElement>('.admin-assistant-messages')!;
    Object.defineProperty(list, 'scrollHeight', { configurable: true, value: LIST_SCROLL_HEIGHT });
    const pageScroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);

    for (let index = 0; index < 5; index += 1) {
      sendStarter('Barber time off');
      await waitForReply();
    }
    await waitFor(() => expect(list.scrollTop).toBe(LIST_SCROLL_HEIGHT));

    expect(document.querySelectorAll('.admin-assistant-bubble')).toHaveLength(10);
    expect(intoView).not.toHaveBeenCalled();
    expect(pageScroll).not.toHaveBeenCalled();
    expect(document.scrollingElement?.scrollTop ?? 0).toBe(0);
    expect(container.scrollTop).toBe(0);
    expect(document.querySelector<HTMLElement>('.admin-assistant-shell')!.scrollTop).toBe(0);
    expect(document.querySelector<HTMLElement>('.admin-assistant-chat')!.scrollTop).toBe(0);
    pageScroll.mockRestore();
  }, 20_000);

  it('coalesces streamed updates into at most one history scroll per frame', async () => {
    const frames: FrameRequestCallback[] = [];
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => frames.push(cb));
    render(<AiAssistantPanel isPublicDemo showcaseMode />);
    sendStarter('Raise utilisation');
    await waitFor(() => expect(document.querySelector('.admin-assistant-bubble--assistant')?.textContent?.length ?? 0).toBeGreaterThan(80));
    expect(frames.length).toBe(1);
    raf.mockRestore();
    frames.splice(0).forEach((cb) => cb(0));
    await waitForReply();
  });
});

describe('AiAssistantPanel in the normal admin', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps the original shell and scrollIntoView behaviour', async () => {
    const intoView = vi.fn();
    Element.prototype.scrollIntoView = intoView;
    render(<AiAssistantPanel isPublicDemo />);
    const shell = document.querySelector('.admin-assistant-shell')!;
    expect(shell.className).toBe('surface booking-shell admin-assistant-shell');
    expect(shell.hasAttribute('data-assistant-showcase')).toBe(false);
    intoView.mockClear();
    sendStarter('Barber time off');
    await waitForReply();
    expect(intoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'end' });
  });
});
