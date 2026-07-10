import React from 'react';

type LeaderCrownIconProps = React.SVGProps<SVGSVGElement>;

export default function LeaderCrownIcon({ className = '', ...props }: LeaderCrownIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`admin-leaderboard-crown ${className}`.trim()}
      aria-hidden="true"
      {...props}
    >
      <path
        fill="currentColor"
        d="M4 8.5 7.2 4.8c.4-.5 1.2-.5 1.6 0L12 7.8l3.2-3c.4-.5 1.2-.5 1.6 0L20 8.5 18.8 16H5.2L4 8.5Z"
      />
      <path
        fill="currentColor"
        d="M5 17.5h14v2.5H5v-2.5Z"
      />
      <circle fill="currentColor" cx="12" cy="11" r="1.1" opacity="0.85" />
      <circle fill="currentColor" cx="8.2" cy="10.2" r="0.75" opacity="0.7" />
      <circle fill="currentColor" cx="15.8" cy="10.2" r="0.75" opacity="0.7" />
    </svg>
  );
}
