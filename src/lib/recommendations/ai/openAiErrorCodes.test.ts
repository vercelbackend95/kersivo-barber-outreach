import { describe, expect, it } from 'vitest';

import { mapOpenAiSdkError } from './openAiErrorCodes';

describe('mapOpenAiSdkError', () => {
  it('maps HTTP 401 to OPENAI_AUTH_ERROR', () => {
    expect(mapOpenAiSdkError({ status: 401 })).toBe('OPENAI_AUTH_ERROR');
  });

  it('maps invalid_api_key code to OPENAI_AUTH_ERROR', () => {
    expect(mapOpenAiSdkError({ code: 'invalid_api_key' })).toBe('OPENAI_AUTH_ERROR');
  });

  it('maps AuthenticationError name to OPENAI_AUTH_ERROR', () => {
    expect(mapOpenAiSdkError({ name: 'AuthenticationError' })).toBe('OPENAI_AUTH_ERROR');
  });

  it('maps API key pattern in Error message to OPENAI_AUTH_ERROR', () => {
    expect(mapOpenAiSdkError(new Error('Invalid API key sk-secret123'))).toBe('OPENAI_AUTH_ERROR');
  });

  it('maps API key pattern in error properties to OPENAI_AUTH_ERROR without leaking key', () => {
    const code = mapOpenAiSdkError({ message: 'Invalid API key sk-secret123' });
    expect(code).toBe('OPENAI_AUTH_ERROR');
    expect(code).not.toMatch(/sk-/);
  });

  it('maps HTTP 429 to OPENAI_RATE_LIMIT', () => {
    expect(mapOpenAiSdkError({ status: 429 })).toBe('OPENAI_RATE_LIMIT');
  });

  it('maps rate_limit_exceeded code to OPENAI_RATE_LIMIT', () => {
    expect(mapOpenAiSdkError({ code: 'rate_limit_exceeded' })).toBe('OPENAI_RATE_LIMIT');
  });

  it('maps RateLimitError name to OPENAI_RATE_LIMIT', () => {
    expect(mapOpenAiSdkError({ name: 'RateLimitError' })).toBe('OPENAI_RATE_LIMIT');
  });

  it('maps ETIMEDOUT code to OPENAI_TIMEOUT', () => {
    expect(mapOpenAiSdkError({ code: 'ETIMEDOUT' })).toBe('OPENAI_TIMEOUT');
  });

  it('maps TimeoutError name to OPENAI_TIMEOUT', () => {
    expect(mapOpenAiSdkError({ name: 'TimeoutError' })).toBe('OPENAI_TIMEOUT');
  });

  it('maps HTTP 400 to OPENAI_BAD_REQUEST', () => {
    expect(mapOpenAiSdkError({ status: 400 })).toBe('OPENAI_BAD_REQUEST');
  });

  it('maps BadRequestError name to OPENAI_BAD_REQUEST', () => {
    expect(mapOpenAiSdkError({ name: 'BadRequestError' })).toBe('OPENAI_BAD_REQUEST');
  });

  it('maps ECONNRESET code to OPENAI_CONNECTION_ERROR', () => {
    expect(mapOpenAiSdkError({ code: 'ECONNRESET' })).toBe('OPENAI_CONNECTION_ERROR');
  });

  it('maps APIConnectionError name to OPENAI_CONNECTION_ERROR', () => {
    expect(mapOpenAiSdkError({ name: 'APIConnectionError' })).toBe('OPENAI_CONNECTION_ERROR');
  });

  it('maps HTTP 500 to OPENAI_SERVER_ERROR', () => {
    expect(mapOpenAiSdkError({ status: 500 })).toBe('OPENAI_SERVER_ERROR');
  });

  it('maps InternalServerError name to OPENAI_SERVER_ERROR', () => {
    expect(mapOpenAiSdkError({ name: 'InternalServerError' })).toBe('OPENAI_SERVER_ERROR');
  });

  it('maps HTTP 402 to OPENAI_BILLING_ERROR', () => {
    expect(mapOpenAiSdkError({ status: 402 })).toBe('OPENAI_BILLING_ERROR');
  });

  it('maps insufficient_quota to OPENAI_BILLING_ERROR', () => {
    expect(mapOpenAiSdkError({ code: 'insufficient_quota' })).toBe('OPENAI_BILLING_ERROR');
  });

  it('maps credit_balance_exhausted to OPENAI_BILLING_ERROR', () => {
    expect(mapOpenAiSdkError({ code: 'credit_balance_exhausted' })).toBe('OPENAI_BILLING_ERROR');
  });

  it('maps plain Error without status/code to OPENAI_SDK_ERROR', () => {
    expect(mapOpenAiSdkError(new Error('rate limit exceeded'))).toBe('OPENAI_SDK_ERROR');
    expect(mapOpenAiSdkError(new Error('timeout'))).toBe('OPENAI_SDK_ERROR');
  });

  it('maps unknown shapes to OPENAI_SDK_ERROR', () => {
    expect(mapOpenAiSdkError(null)).toBe('OPENAI_SDK_ERROR');
    expect(mapOpenAiSdkError('unexpected')).toBe('OPENAI_SDK_ERROR');
    expect(mapOpenAiSdkError({ status: 418 })).toBe('OPENAI_SDK_ERROR');
  });

  it('never returns provider message text', () => {
    const code = mapOpenAiSdkError(new Error('rate limit exceeded'));
    expect(code).not.toContain('rate');
    expect(code).not.toContain('limit');
  });
});
