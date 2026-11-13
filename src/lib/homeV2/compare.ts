type CompareRow = { users: number; ex: string; inc: string; less: string; w: string };

/** Barber-count slider: swaps in the server-computed Booksy estimate for the chosen team size. */
export function createCompare(root: HTMLElement): (() => void) | null {
  const range = root.querySelector<HTMLInputElement>('[data-hv2-compare-range]');
  const dataNode = root.querySelector<HTMLScriptElement>('[data-hv2-compare-data]');
  if (!range || !dataNode) return null;

  let rows: CompareRow[];
  try {
    rows = JSON.parse(dataNode.textContent ?? '[]') as CompareRow[];
  } catch {
    return null;
  }

  const count = root.querySelector<HTMLElement>('[data-hv2-compare-count]');
  const users = root.querySelector<HTMLElement>('[data-hv2-compare-users]');
  const ex = root.querySelector<HTMLElement>('[data-hv2-compare-ex]');
  const inc = root.querySelector<HTMLElement>('[data-hv2-compare-inc]');
  const bar = root.querySelector<HTMLElement>('[data-hv2-compare-bar]');
  const team = root.querySelector<HTMLElement>('[data-hv2-compare-team]');
  const less = root.querySelector<HTMLElement>('[data-hv2-compare-less]');
  const seats = Array.from(root.querySelectorAll<HTMLElement>('[data-hv2-compare-seats] > li'));

  const update = () => {
    const value = Number(range.value);
    const row = rows.find((entry) => entry.users === value);
    if (!row) return;
    const min = Number(range.min) || 1;
    const max = Number(range.max) || rows.length;
    range.style.setProperty('--fill', `${((value - min) / (max - min)) * 100}%`);
    range.setAttribute('aria-valuetext', `${value} ${value === 1 ? 'barber' : 'barbers'}`);
    if (count) count.textContent = String(value);
    if (users) users.textContent = String(row.users);
    if (ex) ex.textContent = `${row.ex}/month + VAT`;
    if (inc) inc.textContent = row.inc;
    if (bar) bar.style.setProperty('--w', row.w);
    if (team) team.textContent = `${value} ${value === 1 ? 'barber' : 'barbers'}`;
    if (less && less.textContent !== row.less) {
      less.textContent = row.less;
      // Restart the small pop on the figure each time it changes.
      less.classList.remove('is-bump');
      void less.offsetWidth;
      less.classList.add('is-bump');
    }
    seats.forEach((seat, index) => seat.classList.toggle('is-on', index < value));
  };

  range.addEventListener('input', update);
  update();
  return () => range.removeEventListener('input', update);
}
