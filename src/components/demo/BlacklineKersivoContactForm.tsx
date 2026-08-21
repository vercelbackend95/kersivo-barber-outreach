import React, { useId, useState } from 'react';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { trackConsentedEvent } from '@/lib/consent/events';
import { BLACKLINE_DEMO_CONTACT_SOURCE } from '@/lib/demo/kersivoContact';

const MAX_NAME = 200;
const MAX_EMAIL = 254;
const MAX_SHOP_NAME = 160;
const MAX_MESSAGE = 2000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SUCCESS_COPY =
  'Thanks — your message has been sent to KERSIVO. We’ll get back to you shortly.';
const ERROR_COPY =
  'Something went wrong. Please try again or email us at hello@kersivo.co.uk.';

type FieldErrors = {
  name?: string;
  email?: string;
  shopName?: string;
  message?: string;
};

type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

function validateFields(values: {
  name: string;
  email: string;
  shopName: string;
  message: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.name) errors.name = 'Please enter your name.';
  else if (values.name.length > MAX_NAME) errors.name = 'Please shorten your name.';

  if (!values.email) errors.email = 'Please enter your email.';
  else if (values.email.length > MAX_EMAIL || !EMAIL_RE.test(values.email)) {
    errors.email = 'Please enter a valid email address.';
  }

  if (values.shopName.length > MAX_SHOP_NAME) {
    errors.shopName = 'Please shorten your barbershop name.';
  }

  if (!values.message) errors.message = 'Please enter your question.';
  else if (values.message.length > MAX_MESSAGE) {
    errors.message = 'Please shorten your question.';
  }

  return errors;
}

export default function BlacklineKersivoContactForm() {
  const formId = useId();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [shopName, setShopName] = useState('');
  const [message, setMessage] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<FormStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const submitting = status === 'submitting';

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const values = {
      name: name.trim(),
      email: email.trim(),
      shopName: shopName.trim(),
      message: message.trim(),
    };
    const nextErrors = validateFields(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setStatus('idle');
      setStatusMessage('');
      return;
    }

    setStatus('submitting');
    setStatusMessage('');
    trackConsentedEvent(
      FUNNEL_EVENTS.blackline_demo_contact_submit_attempt,
      undefined,
      'analytics',
    );

    try {
      const response = await fetch('/api/demo/blackline-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          shopName: values.shopName,
          message: values.message,
          companyWebsite: companyWebsite.trim(),
          source: BLACKLINE_DEMO_CONTACT_SOURCE,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        delivered?: boolean;
        error?: string;
      };

      if (!response.ok || data.ok !== true || data.delivered !== true) {
        setStatus('error');
        setStatusMessage(data.error ?? ERROR_COPY);
        return;
      }

      trackConsentedEvent(FUNNEL_EVENTS.blackline_demo_contact_submit, undefined, 'analytics');
      setName('');
      setEmail('');
      setShopName('');
      setMessage('');
      setCompanyWebsite('');
      setErrors({});
      setStatus('success');
      setStatusMessage(SUCCESS_COPY);
    } catch {
      setStatus('error');
      setStatusMessage(ERROR_COPY);
    }
  };

  return (
    <form
      className="bl-kersivo-contact-form"
      onSubmit={handleSubmit}
      noValidate
      aria-busy={submitting}
    >
      <p
        className={`bl-kersivo-contact-status${
          status === 'success'
            ? ' bl-kersivo-contact-status--success'
            : status === 'error'
              ? ' bl-kersivo-contact-status--error'
              : ''
        }`}
        role="status"
        aria-live="polite"
      >
        {statusMessage}
      </p>

      <div className="hp-field" aria-hidden="true">
        <label htmlFor={`${formId}-hp`}>
          Company website
          <input
            id={`${formId}-hp`}
            type="text"
            name="companyWebsite"
            tabIndex={-1}
            autoComplete="off"
            value={companyWebsite}
            onChange={(event) => setCompanyWebsite(event.target.value)}
          />
        </label>
      </div>

      <div className="bl-contact-field">
        <label className="bl-contact-label" htmlFor={`${formId}-name`}>
          Your name
        </label>
        <input
          className="bl-contact-input"
          id={`${formId}-name`}
          name="name"
          type="text"
          autoComplete="name"
          maxLength={MAX_NAME}
          required
          disabled={submitting}
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? `${formId}-name-error` : undefined}
        />
        {errors.name ? (
          <p className="bl-contact-error" id={`${formId}-name-error`}>
            {errors.name}
          </p>
        ) : null}
      </div>

      <div className="bl-contact-field">
        <label className="bl-contact-label" htmlFor={`${formId}-email`}>
          Your email
        </label>
        <input
          className="bl-contact-input"
          id={`${formId}-email`}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          maxLength={MAX_EMAIL}
          required
          disabled={submitting}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? `${formId}-email-error` : undefined}
        />
        {errors.email ? (
          <p className="bl-contact-error" id={`${formId}-email-error`}>
            {errors.email}
          </p>
        ) : null}
      </div>

      <div className="bl-contact-field">
        <label className="bl-contact-label" htmlFor={`${formId}-shop`}>
          Barbershop name <span className="bl-kersivo-contact-optional">(optional)</span>
        </label>
        <input
          className="bl-contact-input"
          id={`${formId}-shop`}
          name="shopName"
          type="text"
          autoComplete="organization"
          maxLength={MAX_SHOP_NAME}
          disabled={submitting}
          value={shopName}
          onChange={(event) => setShopName(event.target.value)}
          aria-invalid={errors.shopName ? true : undefined}
          aria-describedby={errors.shopName ? `${formId}-shop-error` : undefined}
        />
        {errors.shopName ? (
          <p className="bl-contact-error" id={`${formId}-shop-error`}>
            {errors.shopName}
          </p>
        ) : null}
      </div>

      <div className="bl-contact-field">
        <label className="bl-contact-label" htmlFor={`${formId}-message`}>
          Your question
        </label>
        <textarea
          className="bl-contact-textarea"
          id={`${formId}-message`}
          name="message"
          maxLength={MAX_MESSAGE}
          rows={6}
          required
          disabled={submitting}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={errors.message ? `${formId}-message-error` : undefined}
        />
        {errors.message ? (
          <p className="bl-contact-error" id={`${formId}-message-error`}>
            {errors.message}
          </p>
        ) : null}
      </div>

      <button
        className="bl-btn bl-btn--primary bl-contact-submit"
        type="submit"
        disabled={submitting}
      >
        <span>{submitting ? 'Sending…' : 'Ask KERSIVO'}</span>
        {!submitting ? <span className="bl-contact-submit-arrow" aria-hidden="true" /> : null}
      </button>
    </form>
  );
}
