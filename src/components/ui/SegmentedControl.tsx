import { type KeyboardEvent, type ReactNode } from 'react';

export type SegmentedControlOption<T extends string> = {
  value: T;
  label: string;
  href?: string;
  icon?: ReactNode;
};

export function SegmentedControl<T extends string>(props: {
  options: readonly SegmentedControlOption<T>[];
  value: T;
  onChange?: (value: T) => void;
  name?: string;
  legend?: string;
  ariaLabel?: string;
  size?: 'default' | 'small';
  grow?: boolean;
  className?: string;
}) {
  const { options, value, onChange, name, legend, ariaLabel, size = 'default', grow, className } = props;
  const asFieldset = Boolean(name && legend);
  const Tag = asFieldset ? 'fieldset' : 'div';
  const radioName =
    name ??
    (ariaLabel
      ? ariaLabel
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
      : 'segmented');
  const classNames = [
    'calc-segmented',
    size === 'small' && 'calc-segmented--small',
    grow && 'calc-segmented--grow',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  function activate(next: T) {
    if (next !== value) onChange?.(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const index = options.findIndex((option) => option.value === value);
    const last = options.length - 1;
    let next = index < 0 ? 0 : index;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = index <= 0 ? last : index - 1;
    else next = index >= last ? 0 : index + 1;
    const option = options[next];
    if (!option) return;
    activate(option.value);
    const root = event.currentTarget;
    const target = root.querySelector<HTMLElement>(`[data-seg-value="${option.value}"]`);
    target?.focus();
  }

  return (
    <Tag
      className={classNames}
      role={asFieldset ? undefined : 'radiogroup'}
      aria-label={asFieldset ? undefined : ariaLabel}
      onKeyDown={onKeyDown}
    >
      {legend && asFieldset ? <legend className="sr-only">{legend}</legend> : null}
      {options.map((option) => {
        const on = option.value === value;
        const label = (
          <span>
            {option.icon}
            {option.label}
          </span>
        );
        if (option.href) {
          return (
            <a
              key={option.value}
              className={`calc-segmented__option${on ? ' is-on' : ''}`}
              href={option.href}
              aria-current={on ? 'page' : undefined}
              data-seg-value={option.value}
            >
              {label}
            </a>
          );
        }
        return (
          <label key={option.value} className="calc-segmented__option">
            <input
              type="radio"
              name={radioName}
              value={option.value}
              checked={on}
              data-seg-value={option.value}
              onChange={() => activate(option.value)}
            />
            {label}
          </label>
        );
      })}
    </Tag>
  );
}
