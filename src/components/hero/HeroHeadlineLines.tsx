import { cn } from '@/lib/utils';

const LINE_CLASS = 'block pb-[0.14em]';

type HeroHeadlineLinesProps = {
  desktop: string;
  mobile: string;
  className?: string;
};

/** Static responsive headline lines — visible without JS (LCP-friendly). */
export function HeroHeadlineLines({ desktop, mobile, className }: HeroHeadlineLinesProps) {
  return (
    <>
      <span className={cn(className, 'md:hidden')}>
        {mobile.split('\n').map((line, index) => (
          <span key={`m-${index}`} className={LINE_CLASS}>
            {line}
          </span>
        ))}
      </span>
      <span className={cn(className, 'hidden md:block')}>
        {desktop.split('\n').map((line, index) => (
          <span key={`d-${index}`} className={LINE_CLASS}>
            {line}
          </span>
        ))}
      </span>
    </>
  );
}
