export const prerender = false;

import type { APIRoute } from 'astro';
import OpenAI from 'openai';
import { requireAdmin } from '@/lib/admin/auth';
import { buildSystemPrompt } from '@/lib/admin/ai/systemPrompt';
import {
  MAX_CHAT_MESSAGES,
  MAX_MESSAGE_CHARS,
  MAX_TOTAL_CHARS,
  type ChatMessage,
  type ChatRequestBody,
} from '@/lib/admin/ai/types';

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function parseMessages(body: unknown): ChatMessage[] | null {
  if (!body || typeof body !== 'object') return null;
  const messages = (body as ChatRequestBody).messages;
  if (!Array.isArray(messages) || messages.length === 0) return null;
  if (messages.length > MAX_CHAT_MESSAGES) return null;

  const normalized: ChatMessage[] = [];
  let totalChars = 0;

  for (const raw of messages) {
    if (!raw || typeof raw !== 'object') return null;
    const role = (raw as ChatMessage).role;
    const content = (raw as ChatMessage).content;
    if (role !== 'user' && role !== 'assistant') return null;
    if (typeof content !== 'string') return null;
    const trimmed = content.trim();
    if (!trimmed || trimmed.length > MAX_MESSAGE_CHARS) return null;
    totalChars += trimmed.length;
    if (totalChars > MAX_TOTAL_CHARS) return null;
    normalized.push({ role, content: trimmed });
  }

  if (normalized[normalized.length - 1]?.role !== 'user') return null;
  return normalized;
}

export const POST: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  const apiKey = import.meta.env.OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return jsonError(
      'Assistant is not configured. Set OPENAI_API_KEY on the server.',
      503,
    );
  }

  let body: unknown;
  try {
    body = await ctx.request.json();
  } catch {
    return jsonError('Invalid JSON body.', 400);
  }

  const messages = parseMessages(body);
  if (!messages) {
    return jsonError(
      'Send a messages array (user/assistant only, last message must be user).',
      400,
    );
  }

  const model =
    import.meta.env.OPENAI_MODEL
    ?? process.env.OPENAI_MODEL
    ?? 'gpt-4o-mini';

  const openai = new OpenAI({ apiKey });

  try {
    const stream = await openai.chat.completions.create({
      model,
      temperature: 0.45,
      max_tokens: 1200,
      stream: true,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        ...messages.map((message) => ({
          role: message.role as 'user' | 'assistant',
          content: message.content,
        })),
      ],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (ctx.request.signal.aborted) {
              controller.close();
              return;
            }
            const text = chunk.choices[0]?.delta?.content ?? '';
            if (text) controller.enqueue(encoder.encode(text));
          }
          controller.close();
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Stream failed.';
          controller.enqueue(encoder.encode(`\n\n[Assistant error: ${message}]`));
          controller.close();
        }
      },
      cancel() {
        // Client aborted — OpenAI SDK stream ends with the request signal when supported.
      },
    });

    return new Response(readable, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[admin/ai/chat] OpenAI request failed', error);
    const message = error instanceof Error ? error.message : 'Assistant request failed.';
    return jsonError(message, 502);
  }
};
