import type { CSSProperties } from 'react';
import { Check } from '@/components/lucide-react';
import { TOUR_COPY, type TourStepId } from '@/lib/adminHub/tour';

/**
 * The tour's companion: a miniature of the owner's website. Each setup step owns one part of it; a part is an
 * outline until its step is done, then shows what the owner added (their logo, their photos, their counts).
 * Decorative for assistive tech: one sentence describes the whole picture.
 */
export type BlueprintSlotState = 'empty' | 'now' | 'done' | 'just';

const SLOT_NAME: Record<TourStepId, string> = {
  logo: 'Logo',
  photos: 'Photos',
  services: 'Services',
  team: 'Team',
  hours: 'Hours',
};

const ORDER: TourStepId[] = ['logo', 'photos', 'services', 'team', 'hours'];
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function SlotTag(props: { id: TourStepId; index: number; state: BlueprintSlotState }) {
  const done = props.state === 'done' || props.state === 'just';
  return (
    <span className="ks-bp__tag">
      <span className="ks-bp__num">
        {done ? <Check width={9} height={9} strokeWidth={3.2} /> : props.index}
      </span>
      {SLOT_NAME[props.id]}
    </span>
  );
}

export function SiteBlueprint(props: {
  states: Record<TourStepId, BlueprintSlotState>;
  shopName: string | null;
  logoSrc?: string | null;
  photoSrcs?: string[];
  details?: Partial<Record<TourStepId, string | null>>;
  /** Parts draw in one after another (welcome and finale). */
  assemble?: boolean;
}) {
  const { states, details = {} } = props;
  const photos = (props.photoSrcs ?? []).slice(0, 3);
  const filled = (id: TourStepId) => states[id] === 'done' || states[id] === 'just';
  const summary = `${TOUR_COPY.blueprintLabel}: ${ORDER.map(
    (id) => `${SLOT_NAME[id].toLowerCase()} ${filled(id) ? 'added' : 'to do'}`,
  ).join(', ')}.`;
  const slot = (id: TourStepId) => ({
    'data-slot': id,
    'data-state': states[id],
    style: { '--kt-i': ORDER.indexOf(id) } as CSSProperties,
  });

  return (
    <div className={`ks-bp${props.assemble ? ' ks-bp--assemble' : ''}`} role="img" aria-label={summary}>
      <div className="ks-bp__page" aria-hidden="true">
        <div className="ks-bp__bar">
          <div className="ks-bp__logo" {...slot('logo')}>
            {filled('logo') && props.logoSrc ? (
              <img
                className="ks-bp__fill ks-bp__logo-img"
                src={props.logoSrc}
                alt=""
                decoding="async"
                onError={(event) => {
                  event.currentTarget.hidden = true;
                }}
              />
            ) : filled('logo') ? (
              <span className="ks-bp__fill ks-bp__logo-mark">
                <Check width={12} height={12} strokeWidth={3} />
              </span>
            ) : null}
            <SlotTag id="logo" index={1} state={states.logo} />
          </div>
          <span className="ks-bp__nav">
            <i />
            <i />
            <i />
          </span>
          <span className="ks-bp__book">Book</span>
        </div>

        <div className="ks-bp__hero" {...slot('photos')}>
          {filled('photos') ? (
            <span className="ks-bp__fill ks-bp__shots">
              {photos.length ? (
                photos.map((src) => (
                  <img
                    key={src}
                    src={src}
                    alt=""
                    decoding="async"
                    onError={(event) => {
                      event.currentTarget.hidden = true;
                    }}
                  />
                ))
              ) : (
                <span className="ks-bp__shots-blank" />
              )}
            </span>
          ) : null}
          <span className="ks-bp__name">{props.shopName || 'Your barbershop'}</span>
          <SlotTag id="photos" index={2} state={states.photos} />
        </div>

        <div className="ks-bp__cols">
          <div className="ks-bp__panel" {...slot('services')}>
            <SlotTag id="services" index={3} state={states.services} />
            <span className="ks-bp__fill ks-bp__rows">
              {[0, 1, 2].map((row) => (
                <span className="ks-bp__row" key={row}>
                  <i />
                  <b />
                </span>
              ))}
            </span>
            {filled('services') && details.services ? <span className="ks-bp__detail">{details.services}</span> : null}
          </div>
          <div className="ks-bp__panel" {...slot('team')}>
            <SlotTag id="team" index={4} state={states.team} />
            <span className="ks-bp__fill ks-bp__faces">
              <i />
              <i />
              <i />
            </span>
            {filled('team') && details.team ? <span className="ks-bp__detail">{details.team}</span> : null}
          </div>
        </div>

        <div className="ks-bp__hours" {...slot('hours')}>
          <SlotTag id="hours" index={5} state={states.hours} />
          <span className="ks-bp__fill ks-bp__days">
            {DAYS.map((day, index) => (
              <i key={index}>{day}</i>
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}
