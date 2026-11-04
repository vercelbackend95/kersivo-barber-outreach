import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown, Copy } from '@/components/lucide-react';
import {
  copyDayTo,
  formatOpenHours,
  formatOpeningPeriod,
  isClosingChoiceAllowed,
  isOpeningChoiceAllowed,
  OPENING_DAY_NAMES,
  OPENING_HOURS_NONE_OPEN,
  OPENING_WEEK_PRESETS,
  OPENING_WEEKDAYS,
  openingTimeMinutes,
  openingWeekErrors,
  openingWeekMatchesPreset,
  pickClosingTime,
  pickOpeningTime,
  snapToQuarter,
  summariseOpeningWeek,
  weeklyOpenMinutes,
  type OpeningDay,
  type OpeningWeekday,
} from '@/lib/shopData/openingHours';

/** Final UI copy (British English). */
export const OPENING_HOURS_COPY = {
  week: 'Your week',
  hoursOpen: 'hours open a week',
  startFrom: 'Start from',
  patternApplied: 'Pattern applied. Fine-tune any day below.',
  closed: 'Closed',
  opens: 'Opens',
  closes: 'Closes',
  showAll: 'Show all 24 hours',
  daytimeOnly: 'Daytime hours only',
  done: 'Done',
  weekdays: 'Weekdays',
  everyDay: 'Every day',
  clear: 'Clear',
  cancel: 'Cancel',
  copy: 'Copy',
  suggestedTitle: 'Suggested hours, not saved yet',
  suggestedText: "We've filled in common barbershop hours. Change any day, or confirm them as they are.",
  useThese: 'Use these hours',
  saving: 'Saving…',
  copyTo: (count: number) => `Copy to ${count} ${count === 1 ? 'day' : 'days'}`,
  copied: (day: string, count: number) => `Copied ${day} to ${count} ${count === 1 ? 'day' : 'days'}.`,
  closingMoved: (time: string) => `Closing time moved to ${time} so it stays after opening.`,
} as const;

/** The timeline and the default hour grid cover 06:00–23:00. */
const DAY_START = 6 * 60;
const DAY_END = 23 * 60;
const SCALE_TICKS = ['06:00', '09:00', '12:00', '15:00', '18:00', '21:00'];
const QUARTERS = [0, 15, 30, 45] as const;
const pad = (value: number) => String(value).padStart(2, '0');

function timelinePosition(day: OpeningDay): { left: string; width: string } {
  const range = DAY_END - DAY_START;
  const clamp = (minutes: number) => Math.min(DAY_END, Math.max(DAY_START, minutes));
  const opens = clamp(openingTimeMinutes(day.opens) ?? DAY_START);
  const closes = clamp(openingTimeMinutes(day.closes) ?? DAY_START);
  const left = ((opens - DAY_START) / range) * 100;
  const width = (Math.max(0, closes - opens) / range) * 100;
  // A period outside the range still shows a sliver at that edge (min-width in CSS); keep it inside the track.
  return { left: `${Math.min(left, 99)}%`, width: `${width}%` };
}

type Expanded = { day: OpeningWeekday; panel: 'time' | 'copy' } | null;

/**
 * The one opening hours editor (paid dashboard settings and the hub "Add to your website" flow): "Week at a glance".
 *
 * Controlled: the parent owns the week and decides when to save. A summary of the week, quick patterns, then one row
 * per day (Monday first) with an open switch, the hours, a timeline and a copy action. Hours change in an inline
 * picker (24-hour, 15-minute steps) that never lets closing fall at or before opening. Layout follows the editor's
 * own width (container query), not the viewport.
 *
 * Styles: src/styles/components/opening-hours-editor.css (loaded by the pages that use it).
 */
export function OpeningHoursEditor(props: {
  value: readonly OpeningDay[];
  onChange: (next: OpeningDay[]) => void;
  disabled?: boolean;
  /** Accessible name of the whole week, e.g. "Opening hours". */
  label?: string;
  /** Hide the per-day copy buttons and the quick patterns. */
  hideCopy?: boolean;
  /** Hours shown are a suggestion, not saved yet: show the banner. */
  suggested?: boolean;
  /** The banner's "Use these hours" button. */
  onConfirmSuggested?: () => void;
  /** Busy state for that button. */
  confirming?: boolean;
}) {
  const baseId = useId();
  const week = props.value;
  const disabled = Boolean(props.disabled);
  const tools = !disabled && !props.hideCopy;
  const errors = openingWeekErrors(week);
  const [expanded, setExpanded] = useState<Expanded>(null);
  const [message, setMessage] = useState('');
  const timeButtons = useRef<Partial<Record<OpeningWeekday, HTMLButtonElement | null>>>({});
  const copyButtons = useRef<Partial<Record<OpeningWeekday, HTMLButtonElement | null>>>({});

  const lines = summariseOpeningWeek(week);
  const total = formatOpenHours(weeklyOpenMinutes(week));
  const noneOpen = week.length > 0 && !week.some((day) => day.isOpen);

  const replaceDay = (next: OpeningDay) => {
    props.onChange(week.map((day) => (day.dayOfWeek === next.dayOfWeek ? next : day)));
  };

  const toggle = (day: OpeningDay) => {
    if (day.isOpen && expanded?.day === day.dayOfWeek && expanded.panel === 'time') setExpanded(null);
    replaceDay({ ...day, isOpen: !day.isOpen });
  };

  const openPanel = (day: OpeningWeekday, panel: 'time' | 'copy') => {
    setExpanded((current) => (current?.day === day && current.panel === panel ? null : { day, panel }));
  };

  const closePanel = (day: OpeningWeekday, panel: 'time' | 'copy') => {
    setExpanded(null);
    const target = panel === 'time' ? timeButtons.current[day] : copyButtons.current[day];
    // After React has removed the panel.
    window.requestAnimationFrame(() => target?.focus());
  };

  const applyPreset = (index: number) => {
    const preset = OPENING_WEEK_PRESETS[index];
    if (!preset) return;
    setExpanded(null);
    props.onChange(preset.week.map((day) => ({ ...day })));
    setMessage(OPENING_HOURS_COPY.patternApplied);
  };

  // Esc closes the open picker or copy panel (focus anywhere in the editor, including its row button) and hands
  // focus back to that button. Handled here so the app window around the editor does not close too.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || !expanded) return;
    event.preventDefault();
    event.stopPropagation();
    closePanel(expanded.day, expanded.panel);
  };

  const copyDay = (from: OpeningWeekday, targets: OpeningWeekday[]) => {
    if (!targets.length) return;
    props.onChange(copyDayTo(week, from, targets));
    setMessage(OPENING_HOURS_COPY.copied(OPENING_DAY_NAMES[from].long, targets.length));
    closePanel(from, 'copy');
  };

  return (
    <div
      className={`ks-hours${disabled ? ' is-readonly' : ''}${props.hideCopy ? ' no-copy' : ''}`}
      role="group"
      aria-label={props.label ?? 'Opening hours'}
      data-testid="opening-hours-editor"
      onKeyDown={onKeyDown}
    >
      <div className="ks-hours__summary" data-testid="opening-hours-summary">
        <div className="ks-hours__summary-main">
          <p className="ks-hours__eyebrow">{OPENING_HOURS_COPY.week}</p>
          <ul className="ks-hours__groups">
            {lines.map((line) => (
              <li key={line.days} className={`ks-hours__group${line.closed ? ' is-closed' : ''}`}>
                <span className="ks-hours__group-days">{line.days}</span>{' '}
                <span className="ks-hours__group-time">{line.time}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="ks-hours__total" data-testid="opening-hours-total">
          <span className="ks-hours__total-num">{total}</span>{' '}
          <span className="ks-hours__total-label">{OPENING_HOURS_COPY.hoursOpen}</span>
        </p>
      </div>

      {props.suggested && !disabled ? (
        <div className="ks-hours__suggested" data-testid="opening-hours-suggested">
          <div className="ks-hours__suggested-copy">
            <p className="ks-hours__suggested-title">{OPENING_HOURS_COPY.suggestedTitle}</p>
            <p className="ks-hours__suggested-text">{OPENING_HOURS_COPY.suggestedText}</p>
          </div>
          {props.onConfirmSuggested ? (
            <button
              type="button"
              className="btn btn--primary btn--sm ks-hours__suggested-btn"
              aria-busy={props.confirming || undefined}
              disabled={props.confirming}
              onClick={props.onConfirmSuggested}
            >
              {props.confirming ? OPENING_HOURS_COPY.saving : OPENING_HOURS_COPY.useThese}
            </button>
          ) : null}
        </div>
      ) : null}

      {tools ? (
        <div className="ks-hours__patterns">
          <span className="ks-hours__patterns-label" id={`${baseId}-patterns`}>
            {OPENING_HOURS_COPY.startFrom}
          </span>
          <div className="ks-hours__chip-row" role="group" aria-labelledby={`${baseId}-patterns`}>
            {OPENING_WEEK_PRESETS.map((preset, index) => (
              <button
                key={preset.id}
                type="button"
                className="ks-hours__chip"
                aria-pressed={openingWeekMatchesPreset(week, preset)}
                onClick={() => applyPreset(index)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="ks-hours__scale" aria-hidden="true">
        <span className="ks-hours__scale-track">
          {SCALE_TICKS.map((tick) => (
            <span
              key={tick}
              className="ks-hours__tick"
              style={{ left: `${(((openingTimeMinutes(tick) ?? 0) - DAY_START) / (DAY_END - DAY_START)) * 100}%` }}
            >
              {tick}
            </span>
          ))}
        </span>
      </div>

      <ol className="ks-hours__list">
        {week.map((day) => {
          const name = OPENING_DAY_NAMES[day.dayOfWeek];
          const id = `${baseId}-${day.dayOfWeek}`;
          const error = errors[day.dayOfWeek] ?? null;
          const closed = !day.isOpen;
          const period = formatOpeningPeriod(day.opens, day.closes);
          const timeOpen = expanded?.day === day.dayOfWeek && expanded.panel === 'time' && day.isOpen;
          const copyOpen = expanded?.day === day.dayOfWeek && expanded.panel === 'copy';
          const bar = timelinePosition(day);
          return (
            <li
              key={day.dayOfWeek}
              className={`ks-hours__day${closed ? ' is-closed' : ''}${error ? ' has-error' : ''}${
                timeOpen || copyOpen ? ' is-expanded' : ''
              }`}
              data-day={day.dayOfWeek}
            >
              <div className="ks-hours__row">
                <span className="ks-hours__name" id={`${id}-name`}>
                  {name.long}
                </span>
                {disabled ? null : (
                  <button
                    type="button"
                    role="switch"
                    className="ks-hours__switch"
                    aria-checked={day.isOpen}
                    aria-label={`Open on ${name.long}`}
                    onClick={() => toggle(day)}
                  >
                    <span className="ks-hours__track" aria-hidden="true">
                      <span className="ks-hours__thumb" />
                    </span>
                  </button>
                )}
                <div className="ks-hours__time">
                  {closed ? (
                    <span className="ks-hours__closed">{OPENING_HOURS_COPY.closed}</span>
                  ) : disabled ? (
                    <span className="ks-hours__time-text">{period}</span>
                  ) : (
                    <button
                      ref={(node) => {
                        timeButtons.current[day.dayOfWeek] = node;
                      }}
                      type="button"
                      className="ks-hours__time-btn"
                      aria-expanded={timeOpen}
                      aria-controls={`${id}-picker`}
                      aria-label={`Change ${name.long} hours, now ${day.opens} to ${day.closes}`}
                      aria-invalid={error ? true : undefined}
                      aria-describedby={error ? `${id}-error` : undefined}
                      onClick={() => openPanel(day.dayOfWeek, 'time')}
                    >
                      <span className="ks-hours__time-value">{period}</span>
                      <ChevronDown className="ks-hours__chevron" width={16} height={16} aria-hidden="true" />
                    </button>
                  )}
                </div>
                <span className={`ks-hours__timeline${closed ? ' is-closed' : ''}`} aria-hidden="true">
                  {closed ? null : <span className="ks-hours__bar" style={bar} />}
                </span>
                {tools ? (
                  <button
                    ref={(node) => {
                      copyButtons.current[day.dayOfWeek] = node;
                    }}
                    type="button"
                    className="ks-hours__copy-btn"
                    aria-label={`Copy ${name.long} hours to other days`}
                    aria-expanded={copyOpen}
                    aria-controls={`${id}-copy`}
                    onClick={() => openPanel(day.dayOfWeek, 'copy')}
                  >
                    <Copy width={16} height={16} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
              {timeOpen ? (
                <TimePicker
                  id={`${id}-picker`}
                  day={day}
                  dayName={name.long}
                  onChange={(next, moved) => {
                    replaceDay(next);
                    if (moved) setMessage(OPENING_HOURS_COPY.closingMoved(moved));
                  }}
                  onClose={() => closePanel(day.dayOfWeek, 'time')}
                />
              ) : null}
              {copyOpen ? (
                <CopyPanel
                  id={`${id}-copy`}
                  day={day}
                  onCancel={() => closePanel(day.dayOfWeek, 'copy')}
                  onApply={(targets) => copyDay(day.dayOfWeek, targets)}
                />
              ) : null}
              <p className="ks-hours__error" id={`${id}-error`} aria-live="polite">
                {error}
              </p>
            </li>
          );
        })}
      </ol>

      <p
        className={`ks-hours__status${noneOpen ? ' is-error' : ''}`}
        role="status"
        aria-live="polite"
        data-testid="opening-hours-status"
      >
        {noneOpen ? OPENING_HOURS_NONE_OPEN : message}
      </p>
    </div>
  );
}

function TimePicker(props: {
  id: string;
  day: OpeningDay;
  dayName: string;
  onChange: (next: OpeningDay, movedClosing: string | null) => void;
  onClose: () => void;
}) {
  const { day, dayName } = props;
  const opens = openingTimeMinutes(day.opens) ?? 9 * 60;
  const closes = openingTimeMinutes(day.closes) ?? 18 * 60;
  const [showAll, setShowAll] = useState(() => opens < DAY_START || closes < DAY_START);
  const firstHour = showAll ? 0 : 6;
  const hours = Array.from({ length: 24 - firstHour }, (_, index) => firstHour + index);

  const pickOpens = (minutes: number) => {
    const result = pickOpeningTime(day, minutes);
    props.onChange(result.day, result.movedClosing);
  };
  const pickCloses = (minutes: number) => props.onChange(pickClosingTime(day, minutes), null);

  const openHour = Math.floor(opens / 60);
  const closeHour = Math.floor(closes / 60);

  const column = (kind: 'opens' | 'closes') => {
    const isOpens = kind === 'opens';
    const value = isOpens ? day.opens : day.closes;
    const current = isOpens ? opens : closes;
    const currentHour = isOpens ? openHour : closeHour;
    const label = isOpens ? OPENING_HOURS_COPY.opens : OPENING_HOURS_COPY.closes;
    const hourAllowed = (hour: number) =>
      isOpens
        ? isOpeningChoiceAllowed(hour * 60)
        : QUARTERS.some((minute) => isClosingChoiceAllowed(day.opens, hour * 60 + minute));
    const minuteAllowed = (minute: number) =>
      isOpens
        ? isOpeningChoiceAllowed(currentHour * 60 + minute)
        : isClosingChoiceAllowed(day.opens, currentHour * 60 + minute);
    const pick = isOpens ? pickOpens : pickCloses;
    const headingId = `${props.id}-${kind}`;
    return (
      <div className={`ks-hours__col ks-hours__col--${kind}`}>
        <p className="ks-hours__col-head" id={headingId}>
          <span className="ks-hours__col-label">{label}</span>
          <span className="ks-hours__col-value">{value}</span>
        </p>
        <div
          className="ks-hours__hours"
          role="group"
          aria-label={`${isOpens ? 'Opening' : 'Closing'} hour on ${dayName}`}
        >
          {hours.map((hour) => (
            <button
              key={hour}
              type="button"
              className="ks-hours__cell"
              aria-pressed={hour === currentHour}
              disabled={!hourAllowed(hour)}
              onClick={() => pick(hour * 60 + snapToQuarter(current % 60))}
            >
              {pad(hour)}
            </button>
          ))}
        </div>
        <div
          className="ks-hours__minutes"
          role="group"
          aria-label={`${isOpens ? 'Opening' : 'Closing'} minutes on ${dayName}`}
        >
          {QUARTERS.map((minute) => (
            <button
              key={minute}
              type="button"
              className="ks-hours__cell"
              aria-pressed={current % 60 === minute}
              disabled={!minuteAllowed(minute)}
              onClick={() => pick(currentHour * 60 + minute)}
            >
              :{pad(minute)}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      className="ks-hours__panel ks-hours__picker"
      id={props.id}
      role="group"
      aria-label={`${dayName} hours`}
      data-testid="opening-hours-picker"
    >
      <div className="ks-hours__cols">
        {column('opens')}
        {column('closes')}
      </div>
      <div className="ks-hours__panel-foot">
        <button type="button" className="btn btn--link ks-hours__link" onClick={() => setShowAll((all) => !all)}>
          {showAll ? OPENING_HOURS_COPY.daytimeOnly : OPENING_HOURS_COPY.showAll}
        </button>
        <button type="button" className="btn btn--secondary btn--sm" onClick={props.onClose}>
          {OPENING_HOURS_COPY.done}
        </button>
      </div>
    </div>
  );
}

function CopyPanel(props: {
  id: string;
  day: OpeningDay;
  onCancel: () => void;
  onApply: (targets: OpeningWeekday[]) => void;
}) {
  const { day } = props;
  const name = OPENING_DAY_NAMES[day.dayOfWeek].long;
  const others = OPENING_WEEKDAYS.filter((weekday) => weekday !== day.dayOfWeek);
  const [selected, setSelected] = useState<OpeningWeekday[]>([]);
  const headId = `${props.id}-head`;
  const set = (days: readonly OpeningWeekday[]) =>
    setSelected(others.filter((weekday) => days.includes(weekday)));
  const toggle = (weekday: OpeningWeekday) =>
    set(selected.includes(weekday) ? selected.filter((d) => d !== weekday) : [...selected, weekday]);

  return (
    <div
      className="ks-hours__panel ks-hours__copy"
      id={props.id}
      role="group"
      aria-labelledby={headId}
      data-testid="opening-hours-copy"
    >
      <p className="ks-hours__copy-head" id={headId}>
        Copy <strong>{name}</strong> ({day.isOpen ? formatOpeningPeriod(day.opens, day.closes) : OPENING_HOURS_COPY.closed}) to
      </p>
      <div className="ks-hours__day-chips">
        {others.map((weekday) => (
          <button
            key={weekday}
            type="button"
            className="ks-hours__chip ks-hours__chip--day"
            aria-pressed={selected.includes(weekday)}
            aria-label={OPENING_DAY_NAMES[weekday].long}
            onClick={() => toggle(weekday)}
          >
            {OPENING_DAY_NAMES[weekday].short}
          </button>
        ))}
      </div>
      <div className="ks-hours__quick">
        <button type="button" className="btn btn--link ks-hours__link" onClick={() => set([1, 2, 3, 4, 5])}>
          {OPENING_HOURS_COPY.weekdays}
        </button>
        <span aria-hidden="true">·</span>
        <button type="button" className="btn btn--link ks-hours__link" onClick={() => set(others)}>
          {OPENING_HOURS_COPY.everyDay}
        </button>
        <span aria-hidden="true">·</span>
        <button type="button" className="btn btn--link ks-hours__link" onClick={() => set([])}>
          {OPENING_HOURS_COPY.clear}
        </button>
      </div>
      <div className="ks-hours__panel-foot">
        <button type="button" className="btn btn--ghost btn--sm" onClick={props.onCancel}>
          {OPENING_HOURS_COPY.cancel}
        </button>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          disabled={!selected.length}
          onClick={() => props.onApply(selected)}
        >
          {selected.length ? OPENING_HOURS_COPY.copyTo(selected.length) : OPENING_HOURS_COPY.copy}
        </button>
      </div>
    </div>
  );
}
