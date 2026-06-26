import React from 'react';
import { ViralCtaBumperCard } from './components/ViralCtaBumperCard';
import { VIRAL_CTA_BUMPER_DEFAULTS } from './theme-viral-cta-bumper';

export type ViralCtaBumperProps = {
  headline?: string;
  subline?: string;
};

export const ViralCtaBumper: React.FC<ViralCtaBumperProps> = ({
  headline = VIRAL_CTA_BUMPER_DEFAULTS.headline,
  subline = VIRAL_CTA_BUMPER_DEFAULTS.subline,
}) => {
  return (
    <ViralCtaBumperCard
      headline={headline}
      subline={subline}
      url={VIRAL_CTA_BUMPER_DEFAULTS.url}
    />
  );
};
