import React from 'react';

const SF_FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif';

type IosLockScreenMockProps = {
  title?: string;
  subtitle?: string;
  time?: string;
};

function MessagesIcon({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.22,
        background: 'linear-gradient(180deg, #5DF675 0%, #2ECC4A 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="white" aria-hidden>
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
      </svg>
    </div>
  );
}

export const IosLockScreenMock: React.FC<IosLockScreenMockProps> = ({
  title = 'You still open?',
  subtitle = 'Just a quick trim?',
  time = '11:04',
}) => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(180deg, #0a0a0c 0%, #000000 55%, #050508 100%)',
        borderRadius: 42,
        overflow: 'hidden',
        position: 'relative',
        fontFamily: SF_FONT,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 22px 0',
          color: '#fff',
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        <span>{time}</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <svg width={18} height={12} viewBox="0 0 18 12" fill="white" aria-hidden>
            <rect x={0} y={8} width={3} height={4} rx={0.5} />
            <rect x={5} y={5} width={3} height={7} rx={0.5} />
            <rect x={10} y={2} width={3} height={10} rx={0.5} />
            <rect x={15} y={0} width={3} height={12} rx={0.5} />
          </svg>
          <svg width={16} height={12} viewBox="0 0 16 12" fill="white" aria-hidden>
            <path d="M8 2.4C5.4 2.4 3.1 3.4 1.4 5.1L0 3.7C2.1 1.6 4.9 0.4 8 0.4s5.9 1.2 8 3.3l-1.4 1.4C13.9 3.4 11.6 2.4 8 2.4zm0 3.6c-1.6 0-3 .6-4.1 1.7L2.5 5.3C3.9 3.9 5.8 3.2 8 3.2s4.1.7 5.5 2.1l-1.4 1.4C11 6.6 9.6 6 8 6zm0 3.6c-.8 0-1.5.3-2.1.9l-1.4-1.4c1-1 2.4-1.6 3.9-1.6s2.9.6 3.9 1.6l-1.4 1.4c-.6-.6-1.3-.9-2.1-.9zM8 12c-.6 0-1.1-.5-1.1-1.1S7.4 9.8 8 9.8s1.1.5 1.1 1.1S8.6 12 8 12z" />
          </svg>
          <svg width={27} height={13} viewBox="0 0 27 13" aria-hidden>
            <rect
              x={0.5}
              y={0.5}
              width={22}
              height={12}
              rx={3}
              stroke="rgba(255,255,255,0.35)"
              fill="none"
            />
            <rect x={2} y={2} width={17} height={9} rx={2} fill="#fff" />
            <rect x={23.5} y={4} width={3} height={5} rx={1} fill="rgba(255,255,255,0.35)" />
          </svg>
        </div>
      </div>

      <p
        style={{
          margin: '120px 0 0',
          textAlign: 'center',
          fontSize: 96,
          fontWeight: 200,
          color: '#fff',
          letterSpacing: '-0.04em',
          lineHeight: 1,
        }}
      >
        {time}
      </p>

      <div
        style={{
          position: 'absolute',
          left: 24,
          right: 24,
          bottom: 48,
        }}
      >
        <div
          style={{
            background: 'rgba(255,255,255,0.18)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderRadius: 18,
            padding: '14px 16px',
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
            boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
          }}
        >
          <MessagesIcon size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.55)',
                letterSpacing: '-0.01em',
              }}
            >
              Messages
            </p>
            <p
              style={{
                margin: '4px 0 0',
                fontSize: 16,
                fontWeight: 600,
                color: '#fff',
                lineHeight: 1.25,
                letterSpacing: '-0.02em',
              }}
            >
              {title}
            </p>
            <p
              style={{
                margin: '4px 0 0',
                fontSize: 15,
                fontWeight: 400,
                color: 'rgba(255,255,255,0.85)',
                lineHeight: 1.3,
                letterSpacing: '-0.01em',
              }}
            >
              {subtitle}
            </p>
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 140,
          height: 5,
          borderRadius: 3,
          backgroundColor: 'rgba(255,255,255,0.35)',
        }}
      />
    </div>
  );
};
