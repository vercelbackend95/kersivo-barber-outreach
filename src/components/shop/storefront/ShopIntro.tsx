type ShopIntroProps = {
  eyebrow?: string;
  heading: string;
  headingId?: string;
  description?: string;
  fulfilmentLabel?: string;
  safetyNote?: string;
  meta?: string[];
  compact?: boolean;
};

export default function ShopIntro({
  eyebrow,
  heading,
  headingId = 'storefront-heading',
  description,
  fulfilmentLabel,
  safetyNote,
  meta = [],
  compact = false,
}: ShopIntroProps) {
  return (
    <header className={`sf-intro${compact ? ' sf-intro--compact' : ''}`}>
      {eyebrow ? <p className="sf-intro-eyebrow">{eyebrow}</p> : null}
      <h1 className="sf-intro-heading" id={headingId}>
        {heading}
      </h1>
      {description ? <p className="sf-intro-desc">{description}</p> : null}
      {meta.length > 0 || fulfilmentLabel ? (
        <ul className="sf-intro-meta">
          {fulfilmentLabel ? <li>{fulfilmentLabel}</li> : null}
          {meta.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {safetyNote ? <p className="sf-intro-safety">{safetyNote}</p> : null}
    </header>
  );
}
