import React from 'react';
import { AbsoluteFill } from 'remotion';
import { PercentCounterStrike } from './components/PercentCounterStrike';

export const PercentCounterOverlay: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
      }}
    >
      <PercentCounterStrike />
    </AbsoluteFill>
  );
};
