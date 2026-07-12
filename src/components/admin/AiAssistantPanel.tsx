import React, { useCallback, useEffect, useRef, useState } from 'react';
import AdminSectionHeader from './AdminSectionHeader';
import { ASSISTANT_STARTERS, buildDemoAssistantReply } from '@/lib/admin/ai/prompts';
import type { ChatMessage } from '@/lib/admin/ai/types';

const STORAGE_KEY = 'kersivo-admin-assistant-thread-v1';

type UiMessage = ChatMessage & { id: string };

type AiAssistantPanelProps = {
  isPublicDemo?: boolean;
};

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadStoredMessages(): UiMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is UiMessage => {
        if (!item || typeof item !== 'object') return false;
        const role = (item as UiMessage).role;
        const content = (item as UiMessage).content;
        const id = (item as UiMessage).id;
        return (
          (role === 'user' || role === 'assistant')
          && typeof content === 'string'
          && typeof id === 'string'
        );
      })
      .slice(-40);
  } catch {
    return [];
  }
}

function persistMessages(messages: UiMessage[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
  } catch {
    // ignore quota errors
  }
}

function renderMessageContent(content: string): React.ReactNode {
  const lines = content.split('\n');
  return lines.map((line, index) => {
    const withBold = line.split(/(\*\*[^*]+\*\*)/g).map((part, partIndex) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return <strong key={`${index}-${partIndex}`}>{part.slice(2, -2)}</strong>;
      }
      return <React.Fragment key={`${index}-${partIndex}`}>{part}</React.Fragment>;
    });
    return (
      <React.Fragment key={index}>
        {withBold}
        {index < lines.length - 1 ? <br /> : null}
      </React.Fragment>
    );
  });
}

export default function AiAssistantPanel({ isPublicDemo = false }: AiAssistantPanelProps) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages(loadStoredMessages());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    persistMessages(messages);
  }, [messages, hydrated]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isStreaming]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  const sendMessage = useCallback(async (rawText: string) => {
    const text = rawText.trim();
    if (!text || isStreaming) return;

    setError('');
    setDraft('');

    const userMessage: UiMessage = { id: createId(), role: 'user', content: text };
    const assistantId = createId();
    const historyForApi = [...messages, userMessage].map(({ role, content }) => ({ role, content }));

    setMessages((prev) => [...prev, userMessage, { id: assistantId, role: 'assistant', content: '' }]);
    setIsStreaming(true);

    if (isPublicDemo) {
      const reply = buildDemoAssistantReply(text);
      let i = 0;
      const tick = () => {
        i += 1;
        const slice = reply.slice(0, Math.min(reply.length, i * 12));
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId ? { ...message, content: slice } : message,
          ),
        );
        if (slice.length < reply.length) {
          window.setTimeout(tick, 16);
        } else {
          setIsStreaming(false);
        }
      };
      window.setTimeout(tick, 40);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/api/admin/ai/chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: historyForApi }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let message = 'Assistant request failed.';
        try {
          const payload = await response.json() as { error?: string };
          if (payload.error) message = payload.error;
        } catch {
          // keep default
        }
        throw new Error(message);
      }

      if (!response.body) {
        throw new Error('No response stream from Assistant.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const next = accumulated;
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId ? { ...message, content: next } : message,
          ),
        );
      }

      accumulated += decoder.decode();
      if (!accumulated.trim()) {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId
              ? { ...message, content: 'No reply returned. Try again in a moment.' }
              : message,
          ),
        );
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId
              ? { ...message, content: message.content || 'Stopped.' }
              : message,
          ),
        );
      } else {
        const message = err instanceof Error ? err.message : 'Assistant request failed.';
        setError(message);
        setMessages((prev) =>
          prev.filter((item) => item.id !== assistantId || item.content.trim()),
        );
      }
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
    }
  }, [isPublicDemo, isStreaming, messages]);

  const handleClear = useCallback(() => {
    stopStreaming();
    setMessages([]);
    setError('');
    setDraft('');
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, [stopStreaming]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void sendMessage(draft);
  };

  const handleComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(draft);
    }
  };

  const showEmpty = hydrated && messages.length === 0;

  return (
    <section className="surface booking-shell admin-assistant-shell" aria-label="Assistant">
      <AdminSectionHeader
        title="Assistant"
        description="SEO, retail, barbers, and your site — advisory help for barbershop ops."
        metaBadge={isPublicDemo ? 'Demo' : undefined}
        metaBadgeVariant="info"
        actions={(
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={handleClear}
            disabled={messages.length === 0 && !isStreaming}
          >
            Clear chat
          </button>
        )}
      />

      <div className="admin-assistant-layout">
        <div className="admin-assistant-chat" role="region" aria-label="Assistant conversation">
          <div className="admin-assistant-messages" aria-live="polite">
            {showEmpty ? (
              <div className="admin-assistant-empty">
                <p className="admin-assistant-empty-brand">Kersivo Assistant</p>
                <p className="admin-assistant-empty-copy">
                  Ask about local SEO, Google Business, retail product copy, no-shows, schedules,
                  or switching off marketplace booking apps. Advisory only — it will not change
                  bookings or shop data.
                </p>
              </div>
            ) : null}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`admin-assistant-bubble admin-assistant-bubble--${message.role}`}
              >
                <span className="admin-assistant-bubble-role">
                  {message.role === 'user' ? 'You' : 'Assistant'}
                </span>
                <div className="admin-assistant-bubble-body">
                  {message.content
                    ? renderMessageContent(message.content)
                    : (isStreaming ? <span className="admin-assistant-typing">Thinking…</span> : null)}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {error ? (
            <p className="admin-assistant-error" role="alert">{error}</p>
          ) : null}

          <div className="admin-assistant-starters" aria-label="Suggested prompts">
            {ASSISTANT_STARTERS.map((starter) => (
              <button
                key={starter.id}
                type="button"
                className="admin-assistant-starter"
                disabled={isStreaming}
                onClick={() => void sendMessage(starter.prompt)}
              >
                {starter.label}
              </button>
            ))}
          </div>

          <form className="admin-assistant-composer" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="admin-assistant-input">
              Message the Assistant
            </label>
            <textarea
              id="admin-assistant-input"
              className="admin-assistant-input"
              rows={2}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="Ask about SEO, retail, barbers, or your booking site…"
              disabled={isStreaming && isPublicDemo}
            />
            <div className="admin-assistant-composer-actions">
              {isStreaming ? (
                <button type="button" className="btn btn--ghost btn--sm" onClick={stopStreaming}>
                  Stop
                </button>
              ) : null}
              <button
                type="submit"
                className="btn btn--primary btn--sm"
                disabled={!draft.trim() || isStreaming}
              >
                Send
              </button>
            </div>
          </form>
        </div>

        <aside className="admin-assistant-rail" aria-label="Coming next">
          <div className="admin-assistant-soon">
            <span className="admin-assistant-soon-badge">Soon</span>
            <h3 className="admin-assistant-soon-title">Coming next</h3>
            <p className="admin-assistant-soon-copy">
              Live shop &amp; booking context — answers grounded in your real catalogue,
              today&apos;s chairs, and recent orders.
            </p>
            <p className="admin-assistant-soon-copy admin-assistant-soon-copy--muted">
              Admin action shortcuts — jump into the right panel without leaving the chat.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
