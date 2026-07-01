import React from 'react';
import { AbsoluteFill } from 'remotion';
import { fontFamily, fontWeight } from '../fonts';
import { visualQuality } from '../theme';
import {
  CAROUSEL_SAFE,
  carouselColors,
  type CarouselSlide,
} from '../theme-carousel';
import { CarouselIcon, CarouselTrustIcon } from './CarouselIcons';
import { CarouselLogo } from './CarouselLogo';
import { CarouselPhotoBg } from './CarouselPhotoBg';
import { GoldBrushstroke } from './GoldBrushstroke';

type CarouselSlideLayoutProps = {
  slide: CarouselSlide;
};

function Tagline({ text }: { text: string }) {
  return (
    <p
      style={{
        fontFamily: fontFamily.brand,
        fontSize: 18,
        fontWeight: 400,
        color: carouselColors.gold,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        margin: 0,
        ...visualQuality.text,
      }}
    >
      {text}
    </p>
  );
}

function HeadlineLines({
  lines,
  goldLineIndex,
  fontSize = 64,
}: {
  lines: string[];
  goldLineIndex?: number;
  fontSize?: number;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {lines.map((line, i) => (
        <h1
          key={line}
          style={{
            fontFamily: fontFamily.heading,
            fontSize,
            fontWeight: 400,
            color: i === goldLineIndex ? carouselColors.gold : carouselColors.fg,
            lineHeight: 1.02,
            letterSpacing: '0.03em',
            margin: 0,
            ...visualQuality.text,
          }}
        >
          {line}
        </h1>
      ))}
    </div>
  );
}

function GoldSubline({ text }: { text: string }) {
  return (
    <p
      style={{
        fontFamily: fontFamily.brand,
        fontSize: 26,
        fontWeight: 600,
        fontStyle: 'italic',
        color: carouselColors.goldLight,
        margin: 0,
        lineHeight: 1.3,
        ...visualQuality.text,
      }}
    >
      {text}
    </p>
  );
}

function BodyText({ text, size = 24 }: { text: string; size?: number }) {
  return (
    <p
      style={{
        fontFamily: fontFamily.body,
        fontSize: size,
        fontWeight: 400,
        color: carouselColors.muted,
        margin: 0,
        lineHeight: 1.45,
        maxWidth: 480,
        ...visualQuality.text,
      }}
    >
      {text}
    </p>
  );
}

function FeatureRow({
  icon,
  title,
  body,
}: {
  icon: CarouselSlide['icon'];
  title: string;
  body: string;
}) {
  if (!icon) return null;

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      <CarouselIcon name={icon} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 }}>
        <h2
          style={{
            fontFamily: fontFamily.heading,
            fontSize: 36,
            fontWeight: 400,
            color: carouselColors.fg,
            letterSpacing: '0.04em',
            margin: 0,
            lineHeight: 1.05,
            ...visualQuality.text,
          }}
        >
          {title}
        </h2>
        <BodyText text={body} size={22} />
      </div>
    </div>
  );
}

function HeroSlide({ slide }: { slide: CarouselSlide }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        paddingTop: 100,
        maxWidth: 560,
      }}
    >
      {slide.tagline ? <Tagline text={slide.tagline} /> : null}
      {slide.headlineLines ? (
        <HeadlineLines lines={slide.headlineLines} goldLineIndex={slide.goldLineIndex} />
      ) : null}
      {slide.subline ? <BodyText text={slide.subline} /> : null}
    </div>
  );
}

function FeatureSlide({ slide }: { slide: CarouselSlide }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        paddingTop: 120,
        maxWidth: 560,
      }}
    >
      {slide.icon ? <CarouselIcon name={slide.icon} size={64} /> : null}
      {slide.headlineLines ? (
        <HeadlineLines lines={slide.headlineLines} fontSize={58} />
      ) : null}
      {slide.subline ? <GoldSubline text={slide.subline} /> : null}
      {slide.body ? <BodyText text={slide.body} /> : null}
    </div>
  );
}

function DualFeatureSlide({ slide }: { slide: CarouselSlide }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 40,
        paddingTop: 130,
        maxWidth: 620,
      }}
    >
      {slide.features?.map((feature) => (
        <FeatureRow
          key={feature.title}
          icon={feature.icon}
          title={feature.title}
          body={feature.body}
        />
      ))}
    </div>
  );
}

function PricingSlide({ slide }: { slide: CarouselSlide }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
        paddingTop: 40,
      }}
    >
      <div
        style={{
          border: `2px solid ${carouselColors.gold}`,
          borderRadius: 4,
          padding: '36px 48px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          backgroundColor: 'rgba(8,8,8,0.75)',
          boxShadow: `0 0 48px ${carouselColors.gold}22`,
        }}
      >
        <span
          style={{
            fontFamily: fontFamily.heading,
            fontSize: 72,
            color: carouselColors.gold,
            letterSpacing: '0.04em',
            lineHeight: 1,
            ...visualQuality.text,
          }}
        >
          {slide.pricingAmount}
        </span>
        <span
          style={{
            fontFamily: fontFamily.brand,
            fontSize: 22,
            fontWeight: 600,
            color: carouselColors.goldLight,
            letterSpacing: '0.2em',
            ...visualQuality.text,
          }}
        >
          {slide.pricingLabel}
        </span>
      </div>
      {slide.pricingBullets ? (
        <p
          style={{
            fontFamily: fontFamily.body,
            fontSize: 22,
            color: carouselColors.fg,
            textAlign: 'center',
            margin: 0,
            letterSpacing: '0.02em',
            ...visualQuality.text,
          }}
        >
          {slide.pricingBullets.join(' · ')}
        </p>
      ) : null}
      {slide.footnote ? (
        <p
          style={{
            fontFamily: fontFamily.body,
            fontSize: 18,
            color: carouselColors.gold,
            textAlign: 'center',
            margin: 0,
            maxWidth: 720,
            lineHeight: 1.5,
            ...visualQuality.text,
          }}
        >
          {slide.footnote}
        </p>
      ) : null}
    </div>
  );
}

function CtaTrustSlide({ slide }: { slide: CarouselSlide }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 36,
        paddingTop: 60,
      }}
    >
      {slide.ctaText ? (
        <GoldBrushstroke>
          <span
            style={{
              fontFamily: fontFamily.heading,
              fontSize: 40,
              color: carouselColors.bg,
              letterSpacing: '0.06em',
              ...visualQuality.text,
            }}
          >
            {slide.ctaText}
          </span>
        </GoldBrushstroke>
      ) : null}
      {slide.trustBadges ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px 32px',
            maxWidth: 640,
          }}
        >
          {slide.trustBadges.map((badge) => (
            <div
              key={badge.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <CarouselTrustIcon name={badge.icon} />
              <span
                style={{
                  fontFamily: fontFamily.body,
                  fontSize: 14,
                  fontWeight: fontWeight.semiBold,
                  color: carouselColors.muted,
                  letterSpacing: '0.08em',
                  ...visualQuality.text,
                }}
              >
                {badge.label}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {slide.footer ? (
        <p
          style={{
            fontFamily: fontFamily.brand,
            fontSize: 24,
            fontWeight: 600,
            color: carouselColors.gold,
            letterSpacing: '0.35em',
            margin: 0,
            textTransform: 'uppercase',
            ...visualQuality.text,
          }}
        >
          {slide.footer}
        </p>
      ) : null}
    </div>
  );
}

function SlideContent({ slide }: { slide: CarouselSlide }) {
  switch (slide.layout) {
    case 'hero':
      return <HeroSlide slide={slide} />;
    case 'feature':
      return <FeatureSlide slide={slide} />;
    case 'dualFeature':
      return <DualFeatureSlide slide={slide} />;
    case 'pricingBox':
      return <PricingSlide slide={slide} />;
    case 'ctaTrust':
      return <CtaTrustSlide slide={slide} />;
    default:
      return null;
  }
}

export const CarouselSlideLayout: React.FC<CarouselSlideLayoutProps> = ({ slide }) => {
  const showLogo = slide.layout === 'hero' || slide.layout === 'ctaTrust';

  return (
    <AbsoluteFill>
      <CarouselPhotoBg strength={slide.photoStrength} />
      {showLogo ? <CarouselLogo /> : null}
      <AbsoluteFill
        style={{
          padding: `${CAROUSEL_SAFE}px`,
          paddingTop: showLogo ? CAROUSEL_SAFE + 88 : CAROUSEL_SAFE,
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
        }}
      >
        <SlideContent slide={slide} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
