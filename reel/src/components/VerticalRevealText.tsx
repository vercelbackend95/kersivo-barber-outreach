import React from 'react';

import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

import { colors, snapTransform, visualQuality } from '../theme';

import { fontFamily } from '../fonts';



type VerticalRevealTextProps = {

  text: string;

  delay?: number;

  fontSize?: number;

  color?: string;

  splitBy?: 'words' | 'characters';

  style?: React.CSSProperties;

};



export const VerticalRevealText: React.FC<VerticalRevealTextProps> = ({

  text,

  delay = 0,

  fontSize = 120,

  color = colors.fg,

  splitBy = 'words',

  style,

}) => {

  const frame = useCurrentFrame();

  const { fps } = useVideoConfig();

  const parts = splitBy === 'words' ? text.split(' ') : [...text];



  return (

    <div

      style={{

        display: 'flex',

        flexWrap: 'wrap',

        justifyContent: 'center',

        gap: splitBy === 'words' ? '0.25em' : 0,

        ...style,

      }}

    >

      {parts.map((part, i) => {

        const stagger = i * 4;

        const progress = spring({

          frame: frame - delay - stagger,

          fps,

          config: { stiffness: 190, damping: 24 },

        });

        const y = snapTransform(interpolate(progress, [0, 1], [fontSize * 0.6, 0]));

        const opacity = interpolate(progress, [0, 0.4, 1], [0, 1, 1]);



        return (

          <span

            key={`${part}-${i}`}

            style={{

              display: 'inline-block',

              overflow: 'hidden',

              fontFamily: fontFamily.heading,

              fontSize,

              lineHeight: 0.95,

              letterSpacing: '0.04em',

              color,

              transform: `translate3d(0, ${y}px, 0)`,

              opacity,

              textShadow: visualQuality.headingShadow,

              ...visualQuality.text,

              ...visualQuality.gpu,

            }}

          >

            {part}

            {splitBy === 'words' && i < parts.length - 1 ? '\u00A0' : ''}

          </span>

        );

      })}

    </div>

  );

};


