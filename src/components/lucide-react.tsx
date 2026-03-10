import * as React from "react";

type IconProps = React.SVGProps<SVGSVGElement>;

const Zap = ({ ...props }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M4 14a1 1 0 0 1-.78-1.63l9-11A1 1 0 0 1 14 2v7h6a1 1 0 0 1 .78 1.63l-9 11A1 1 0 0 1 10 21v-7z" />
  </svg>
);

const Clock = ({ ...props }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

export { Clock, Zap };
