import { Check, Eye, Sparkles } from '@/components/lucide-react';
import {
  ADMIN_HUB_COLOURS_MAKE_ACCENT_DEEPER,
  ADMIN_HUB_COLOURS_MAKE_ACCENT_LIGHTER,
  ADMIN_HUB_COLOURS_MAKE_MAIN_DEEPER,
  ADMIN_HUB_COLOURS_MAKE_MAIN_LIGHTER,
  ADMIN_HUB_COLOURS_READABILITY,
  ADMIN_HUB_GUIDE_ALL_CLEAR,
  ADMIN_HUB_GUIDE_CHECKS,
  ADMIN_HUB_GUIDE_EMPTY,
  ADMIN_HUB_GUIDE_FIX_ALL,
  ADMIN_HUB_GUIDE_FIX_TO,
  ADMIN_HUB_GUIDE_HOW,
  ADMIN_HUB_GUIDE_HOW_BODY,
  ADMIN_HUB_GUIDE_RATIO,
  ADMIN_HUB_GUIDE_STATE,
  ADMIN_HUB_GUIDE_SUMMARY_CLEAR,
  ADMIN_HUB_GUIDE_SUMMARY_FIX,
  ADMIN_HUB_GUIDE_TIPS,
  ADMIN_HUB_GUIDE_TO_FIX,
  ADMIN_HUB_GUIDE_TONE,
  ADMIN_HUB_GUIDE_TRY,
} from '@/lib/adminHub/copy';
import {
  contrastMeter,
  formatContrastRatio,
  type BrandBackgroundTone,
  type ColourRole,
  type GuideCheck,
  type GuideReport,
} from '@/lib/adminHub/colour';

function toneWord(tone: BrandBackgroundTone): 'dark' | 'light' {
  return tone === 'LIGHT' ? 'light' : 'dark';
}

function checkText(check: GuideCheck, tone: BrandBackgroundTone): { title: string; body: string } {
  if (check.id === 'main') {
    const copy = ADMIN_HUB_GUIDE_CHECKS.main;
    return { title: copy.title, body: check.pass ? copy.pass(toneWord(tone)) : copy.fail(toneWord(tone)) };
  }
  const copy = ADMIN_HUB_GUIDE_CHECKS[check.id];
  return { title: copy.title, body: check.pass ? copy.pass : copy.fail };
}

function fixLabel(check: GuideCheck): string | null {
  const fix = check.fix;
  if (!fix) return null;
  if (fix.kind === 'accent') return ADMIN_HUB_GUIDE_TRY(fix.name);
  if (fix.role === 'accent') return fix.direction === 'lighter' ? ADMIN_HUB_COLOURS_MAKE_ACCENT_LIGHTER : ADMIN_HUB_COLOURS_MAKE_ACCENT_DEEPER;
  return fix.direction === 'lighter' ? ADMIN_HUB_COLOURS_MAKE_MAIN_LIGHTER : ADMIN_HUB_COLOURS_MAKE_MAIN_DEEPER;
}

/** A tiny live sample of the pair the check is about, in the real colours. */
function Sample(props: { check: GuideCheck }) {
  const { background, foreground } = props.check.sample;
  switch (props.check.id) {
    case 'button':
      return (
        <span className="admin-hub-guide__sample admin-hub-guide__sample--button" style={{ background, color: foreground }}>
          Book
        </span>
      );
    case 'main':
    case 'accentBg':
      return (
        <span className="admin-hub-guide__sample" style={{ background }}>
          <b style={{ color: foreground }}>Aa</b>
          <i style={{ background: foreground }} />
        </span>
      );
    case 'colourBlind':
      return (
        <span className="admin-hub-guide__sample admin-hub-guide__sample--pair" style={{ background }}>
          <i style={{ background: foreground }} />
          <Eye width={12} height={12} strokeWidth={2} aria-hidden="true" />
        </span>
      );
    default:
      return (
        <span className="admin-hub-guide__sample admin-hub-guide__sample--pair" style={{ background }}>
          <i style={{ background: foreground }} />
        </span>
      );
  }
}

/**
 * “Easy to read?”: a verdict, then one row per check with a live sample, a plain-English line, a contrast meter
 * with the pass mark, and a one-tap fix that shows the colour it will use.
 */
export function ReadabilityGuide(props: {
  report: GuideReport;
  tone: BrandBackgroundTone;
  canEdit: boolean;
  hasMain: boolean;
  onFixColour: (role: ColourRole, hex: string) => void;
  onAccent: (hex: string) => void;
  onTone: (tone: BrandBackgroundTone) => void;
  onFixAll: () => void;
}) {
  const { report } = props;
  const state = !props.hasMain ? 'empty' : report.failing ? 'fail' : 'pass';
  const headline =
    state === 'empty' ? ADMIN_HUB_GUIDE_EMPTY : state === 'fail' ? ADMIN_HUB_GUIDE_TO_FIX(report.failing) : ADMIN_HUB_GUIDE_ALL_CLEAR;

  return (
    <section className="admin-hub-guide" data-state={state} data-testid="admin-hub-colours-contrast" aria-labelledby="admin-hub-guide-title">
      <header className="admin-hub-guide__head">
        <h3 id="admin-hub-guide-title" className="admin-hub-cp__label">
          {ADMIN_HUB_COLOURS_READABILITY}
        </h3>
        <p className="admin-hub-guide__verdict" role="status" data-testid="admin-hub-guide-verdict">
          <span className="admin-hub-guide__dot" aria-hidden="true">
            {state === 'pass' ? <Check width={12} height={12} strokeWidth={3} /> : null}
          </span>
          <span>
            <strong>{headline}</strong>
            {report.tips ? <span className="admin-hub-guide__tips"> · {ADMIN_HUB_GUIDE_TIPS(report.tips)}</span> : null}
          </span>
        </p>
        {state !== 'empty' ? (
          <p className="admin-hub-guide__summary">{state === 'fail' ? ADMIN_HUB_GUIDE_SUMMARY_FIX : ADMIN_HUB_GUIDE_SUMMARY_CLEAR}</p>
        ) : null}
        {report.fixAll ? (
          <button type="button" className="btn btn--primary btn--sm admin-hub-guide__fix-all" onClick={props.onFixAll} disabled={!props.canEdit}>
            <Sparkles width={14} height={14} strokeWidth={2} aria-hidden="true" />
            {ADMIN_HUB_GUIDE_FIX_ALL}
          </button>
        ) : null}
      </header>

      {report.checks.length ? (
        <ul className="admin-hub-guide__list">
          {report.checks.map((check) => {
            const text = checkText(check, props.tone);
            const label = fixLabel(check);
            const stateLabel =
              check.level === 'tip'
                ? check.pass
                  ? ADMIN_HUB_GUIDE_STATE.tipOk
                  : ADMIN_HUB_GUIDE_STATE.tip
                : check.pass
                  ? ADMIN_HUB_GUIDE_STATE.pass
                  : ADMIN_HUB_GUIDE_STATE.fail;
            const tone = check.pass ? 'ok' : check.level === 'tip' ? 'tip' : 'fail';
            return (
              <li key={check.id} className={`admin-hub-guide__row is-${tone}`} data-line={check.id} data-pass={check.pass ? 'true' : 'false'}>
                <Sample check={check} />
                <div className="admin-hub-guide__body">
                  <p className="admin-hub-guide__title">
                    <span>{text.title}</span>
                    <span className={`admin-hub-guide__badge is-${tone}`}>{stateLabel}</span>
                  </p>
                  <p className="admin-hub-guide__text">{text.body}</p>
                  {check.ratio !== null && check.needs !== null ? (
                    <div className="admin-hub-guide__meter">
                      <span
                        className="admin-hub-guide__bar"
                        style={{
                          ['--fill' as string]: `${contrastMeter(check.ratio) * 100}%`,
                          ['--mark' as string]: `${contrastMeter(check.needs) * 100}%`,
                        }}
                        aria-hidden="true"
                      />
                      <span className="admin-hub-guide__ratio">
                        {ADMIN_HUB_GUIDE_RATIO(formatContrastRatio(check.ratio), formatContrastRatio(check.needs))}
                      </span>
                    </div>
                  ) : null}
                  {!check.pass && check.fix && label ? (
                    <button
                      type="button"
                      className="btn btn--outline btn--sm admin-hub-guide__fix"
                      disabled={!props.canEdit}
                      onClick={() => {
                        const fix = check.fix!;
                        if (fix.kind === 'accent') props.onAccent(fix.hex);
                        else props.onFixColour(fix.role, fix.hex);
                      }}
                      aria-describedby={`admin-hub-guide-fix-${check.id}`}
                    >
                      <i style={{ background: check.fix.hex }} aria-hidden="true" />
                      {label}
                      <span className="admin-hub-sr-only" id={`admin-hub-guide-fix-${check.id}`}>
                        {ADMIN_HUB_GUIDE_FIX_TO(check.fix.hex)}
                      </span>
                    </button>
                  ) : null}
                  {check.id === 'main' && !check.pass && report.toneSwitch ? (
                    <button
                      type="button"
                      className="btn btn--link admin-hub-guide__tone"
                      disabled={!props.canEdit}
                      onClick={() => props.onTone(report.toneSwitch!.tone)}
                    >
                      {ADMIN_HUB_GUIDE_TONE(toneWord(report.toneSwitch.tone))}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <details className="admin-hub-guide__how">
        <summary>{ADMIN_HUB_GUIDE_HOW}</summary>
        <p>{ADMIN_HUB_GUIDE_HOW_BODY}</p>
      </details>
    </section>
  );
}
