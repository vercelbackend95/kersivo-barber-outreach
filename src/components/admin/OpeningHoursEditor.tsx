import { useId } from 'react';
import {
  copyMondayToWeekdays,
  OPENING_DAY_NAMES,
  openingWeekErrors,
  timeOptionsFor,
  type OpeningDay,
} from '@/lib/shopData/openingHours';

export const OPENING_HOURS_COPY_MONDAY = 'Copy Monday to all weekdays';

/**
 * The one opening hours editor (paid dashboard settings and the hub "Add to your website" flow).
 *
 * Controlled: the parent owns the week and decides when to save. Seven days, Monday first; from
 * 1024 px one row of seven day cards, below that one row per day. 24-hour times in 15-minute steps
 * (selects, so the format never follows the device's 12-hour setting). Validation comes from the
 * shared schema and is shown inline per day.
 *
 * Styles: src/styles/components/opening-hours-editor.css (loaded by the pages that use it).
 */
export function OpeningHoursEditor(props: {
  value: readonly OpeningDay[];
  onChange: (next: OpeningDay[]) => void;
  disabled?: boolean;
  /** Accessible name of the whole week, e.g. "Opening hours". */
  label?: string;
  /** Hide the copy action (e.g. read-only screens). */
  hideCopy?: boolean;
}) {
  const baseId = useId();
  const errors = openingWeekErrors(props.value);
  const disabled = Boolean(props.disabled);

  const update = (dayOfWeek: number, patch: Partial<OpeningDay>) => {
    props.onChange(props.value.map((day) => (day.dayOfWeek === dayOfWeek ? { ...day, ...patch } : day)));
  };

  return (
    <div className="ks-hours" role="group" aria-label={props.label ?? 'Opening hours'} data-testid="opening-hours-editor">
      {props.hideCopy ? null : (
        <div className="ks-hours__tools">
          <button
            type="button"
            className="btn btn--ghost btn--sm ks-hours__copy"
            disabled={disabled}
            onClick={() => props.onChange(copyMondayToWeekdays(props.value))}
          >
            {OPENING_HOURS_COPY_MONDAY}
          </button>
        </div>
      )}
      <ol className="ks-hours__grid">
        {props.value.map((day) => {
          const name = OPENING_DAY_NAMES[day.dayOfWeek];
          const id = `${baseId}-${day.dayOfWeek}`;
          const error = errors[day.dayOfWeek] ?? null;
          const closed = !day.isOpen;
          return (
            <li
              key={day.dayOfWeek}
              className={`ks-hours__day${closed ? ' is-closed' : ''}${error ? ' has-error' : ''}`}
              data-day={day.dayOfWeek}
            >
              <div className="ks-hours__head">
                <span className="ks-hours__name" id={`${id}-name`}>
                  <span aria-hidden="true">{name.short}</span>
                  <span className="ks-hours__sr">{name.long}</span>
                </span>
                <label className="ks-hours__switch">
                  <input
                    type="checkbox"
                    role="switch"
                    checked={day.isOpen}
                    disabled={disabled}
                    aria-label={`Open on ${name.long}`}
                    onChange={(event) => update(day.dayOfWeek, { isOpen: event.target.checked })}
                  />
                  <span className="ks-hours__track" aria-hidden="true">
                    <span className="ks-hours__thumb" />
                  </span>
                  <span className="ks-hours__state" aria-hidden="true">
                    {closed ? 'Closed' : 'Open'}
                  </span>
                </label>
              </div>
              <div className="ks-hours__times">
                <label className="ks-hours__time" htmlFor={`${id}-opens`}>
                  <span className="ks-hours__time-label">
                    Opens<span className="ks-hours__sr"> on {name.long}</span>
                  </span>
                  <select
                    id={`${id}-opens`}
                    className="select ks-hours__select"
                    value={day.opens}
                    disabled={disabled || closed}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${id}-error` : undefined}
                    onChange={(event) => update(day.dayOfWeek, { opens: event.target.value })}
                  >
                    {timeOptionsFor(day.opens).map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ks-hours__time" htmlFor={`${id}-closes`}>
                  <span className="ks-hours__time-label">
                    Closes<span className="ks-hours__sr"> on {name.long}</span>
                  </span>
                  <select
                    id={`${id}-closes`}
                    className="select ks-hours__select"
                    value={day.closes}
                    disabled={disabled || closed}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${id}-error` : undefined}
                    onChange={(event) => update(day.dayOfWeek, { closes: event.target.value })}
                  >
                    {timeOptionsFor(day.closes).map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="ks-hours__error" id={`${id}-error`} aria-live="polite">
                {error}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
