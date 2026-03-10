import type * as React from 'react';

import { cn } from '@/lib/utils';

interface IconProps {
  className?: string;
}

const ShieldCheck = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

const Lock = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

const Award = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <circle cx="12" cy="8" r="5" />
    <path d="m8 14-2 7 6-3 6 3-2-7" />
  </svg>
);

const Medal = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M12 14 7 4h10l-5 10z" />
    <circle cx="12" cy="17" r="4" />
    <path d="m10.5 17 1 1 2-2" />
  </svg>
);

interface Certification {
  icon: React.ReactNode;
  name: string;
}

interface TrustStrip3Props {
  certifications?: Certification[];
  guarantees?: string[];
  className?: string;
}

const DEFAULT_CERTIFICATIONS: Certification[] = [
  { icon: <ShieldCheck className="size-5" />, name: 'SSL Secured' },
  { icon: <Lock className="size-5" />, name: 'PCI Compliant' },
  { icon: <Award className="size-5" />, name: 'BBB Accredited' },
  { icon: <Medal className="size-5" />, name: 'Top Rated 2024' },
];

const DEFAULT_GUARANTEES = ['Money-back guarantee', 'Authentic products', 'Secure checkout'];

const TrustStrip3 = ({
  certifications = DEFAULT_CERTIFICATIONS,
  guarantees = DEFAULT_GUARANTEES,
  className,
}: TrustStrip3Props) => {
  return (
    <section className={cn('trust-strip3 border-y py-6', className)}>
      <div className="container">
        <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
          {/* Certifications */}
          <div className="flex flex-wrap items-center justify-center gap-4 md:justify-start">
            {certifications.map((cert, index) => (
              <div key={index} className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5">
                <span className="text-muted-foreground">{cert.icon}</span>
                <span className="text-sm font-medium">{cert.name}</span>
              </div>
            ))}
          </div>

          {/* Guarantees */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground md:justify-end">
            {guarantees.map((guarantee, index) => (
              <div key={index} className="flex items-center gap-1.5">
                <div className="size-1.5 rounded-full bg-emerald-500" />
                <span>{guarantee}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export { TrustStrip3 };
