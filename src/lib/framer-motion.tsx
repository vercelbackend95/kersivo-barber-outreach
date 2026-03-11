import React, { useEffect, useState } from "react";

type InViewOptions = {
  amount?: number;
  margin?: string;
};

const useInView = <T extends Element>(
  ref: React.RefObject<T | null>,
  options?: InViewOptions,
) => {
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      {
        threshold: options?.amount ?? 0,
        rootMargin: options?.margin,
      },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [options?.amount, options?.margin, ref]);

  return isInView;
};

type MotionDivProps = React.HTMLAttributes<HTMLDivElement> & {
  animate?: React.CSSProperties;
  initial?: React.CSSProperties;
  transition?: unknown;
};

const MotionDiv = React.forwardRef<HTMLDivElement, MotionDivProps>(
  ({ animate, style, ...props }, ref) => {
    void props.initial;
    void props.transition;
    return <div ref={ref} style={{ ...style, ...animate }} {...props} />;
  },
);

MotionDiv.displayName = "MotionDiv";

const motion = {
  div: MotionDiv,
};

export { motion, useInView };
