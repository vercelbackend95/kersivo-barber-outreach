import React, { type CSSProperties, type ReactNode } from 'react';
import {
  bookingThemeToCssVars,
  resolveBookingTheme,
  type BookingThemeInput,
  type BookingThemePreset,
} from '@/lib/booking/bookingTheme';

type Props = {
  preset?: BookingThemePreset;
  theme?: Partial<BookingThemeInput>;
  density?: 'full' | 'embed';
  className?: string;
  children: ReactNode;
};

export default function BookingThemeRoot({
  preset = 'kersivo',
  theme,
  density = 'full',
  className = '',
  children,
}: Props) {
  const resolved = resolveBookingTheme(preset, theme);
  const vars = bookingThemeToCssVars(resolved);
  return (
    <div
      className={`booking-experience booking-experience--${resolved.appearance} booking-experience--${density}${className ? ` ${className}` : ''}`}
      data-booking-theme={preset}
      style={vars as CSSProperties}
    >
      {children}
    </div>
  );
}
