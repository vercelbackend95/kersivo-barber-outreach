import React from 'react';

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
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {optional ? <span className="client-onboarding__optional-label"> · Optional</span> : null}
      </label>
      {children}
      {hint ? <p className="field__hint">{hint}</p> : null}
      {error ? (
        <p className="field__error" id={`${id}-error`} role="alert">
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
  autoComplete?: string;
}) {
  return (
    <Field id={id} label={label} optional={optional} hint={hint}>
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
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  optional?: boolean;
  label: string;
  rows?: number;
}) {
  return (
    <Field id={id} label={label} optional={optional}>
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
