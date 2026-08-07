import React, { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';

export function Field({
  id,
  label,
  hint,
  error,
  optional,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  const errorId = `${id}-error`;
  const describedBy = [hint ? `${id}-hint` : null, error ? errorId : null]
    .filter(Boolean)
    .join(' ') || undefined;

  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
      })
    : children;

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {optional ? <span className="client-onboarding__optional-label"> · Optional</span> : null}
      </label>
      {control}
      {hint ? (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput({
  id,
  value,
  onChange,
  type = 'text',
  disabled,
  optional,
  label,
  hint,
  error,
  autoComplete,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  disabled?: boolean;
  optional?: boolean;
  label: string;
  hint?: string;
  error?: string;
  autoComplete?: string;
}) {
  return (
    <Field id={id} label={label} optional={optional} hint={hint} error={error}>
      <input
        id={id}
        className="input"
        type={type}
        value={value}
        disabled={disabled}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

export function TextArea({
  id,
  value,
  onChange,
  disabled,
  optional,
  label,
  rows = 4,
  error,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  optional?: boolean;
  label: string;
  rows?: number;
  error?: string;
}) {
  return (
    <Field id={id} label={label} optional={optional} error={error}>
      <textarea
        id={id}
        className="textarea"
        rows={rows}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}
