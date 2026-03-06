import type { HTMLAttributes } from 'react';

type SettingsGearIconProps = HTMLAttributes<HTMLSpanElement>;

export function SettingsGearIcon({ className, ...rest }: SettingsGearIconProps) {
  const mergedClassName = ['admin-settings-gear-icon', className].filter(Boolean).join(' ');

  return <span {...rest} className={mergedClassName} aria-hidden="true" />;
}
