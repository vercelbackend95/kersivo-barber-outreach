import { HubReviewCards, type HubReviewMap } from '@/components/previewHub/HubReviewCards';
import { SETUP_FROM_LINKS_BODY } from '@/lib/adminHub/setupCard';
import type { AdminHubAppBodyProps } from './types';

export function HoursApp({ ctx }: AdminHubAppBodyProps) {
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
      only="HOURS"
      shop={ctx.reviewShop}
      reviews={ctx.reviews ?? empty}
    />
  );
}
