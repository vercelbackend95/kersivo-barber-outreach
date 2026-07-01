import React from 'react';
import { CAROUSEL_SLIDES } from '../theme-carousel';
import { CarouselSlideLayout } from './CarouselSlideLayout';

export type InstagramCarouselSlideProps = {
  slideIndex: number;
};

export const InstagramCarouselSlide: React.FC<InstagramCarouselSlideProps> = ({
  slideIndex,
}) => {
  const slide = CAROUSEL_SLIDES[slideIndex] ?? CAROUSEL_SLIDES[0];
  return <CarouselSlideLayout slide={slide} />;
};
