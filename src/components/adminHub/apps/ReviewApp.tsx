import { HubReviewCards, type HubReviewMap } from '@/components/previewHub/HubReviewCards';
import type { HubReviewSection } from '@/lib/freePreview/hubReviews.shared';
import { SETUP_FROM_LINKS_BODY } from '@/lib/adminHub/setupCard';
import type { AdminHubAppBodyProps } from './types';

const ONLY: Record<'services' | 'team' | 'hours', HubReviewSection> = {
  services: 'SERVICES',
  team: 'TEAM',
  hours: 'HOURS',
};

export default function ReviewApp({
  ctx,
  kind,
}: AdminHubAppBodyProps & { kind: 'services' | 'team' | 'hours' }) {
  const empty: HubReviewMap = { SERVICES: null, TEAM: null, HOURS: null };
  if (!ctx.canReview) {
    return (
      <section className="hub-card ks-glass-card">
        <p className="hub-card__body">{SETUP_FROM_LINKS_BODY}</p>
      </section>
    );
  }
  return (
    <HubReviewCards
      token=""
      apiBase={ctx.apiBase}
      canReview={ctx.canReview}
      mode="full"
      only={ONLY[kind]}
      shop={ctx.reviewShop}
      reviews={ctx.reviews ?? empty}
    />
  );
}

export function ServicesApp(props: AdminHubAppBodyProps) {
  return <ReviewApp {...props} kind="services" />;
}

export function TeamApp(props: AdminHubAppBodyProps) {
  return <ReviewApp {...props} kind="team" />;
}

export function HoursApp(props: AdminHubAppBodyProps) {
  return <ReviewApp {...props} kind="hours" />;
}
