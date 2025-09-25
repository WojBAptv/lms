// client/src/lib/timeScale.ts
export type ZoomMode = 'day' | 'week' | 'month';

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function toISO(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
export function addDays(iso: string, days: number): string {
  const dt = parseISO(iso);
  dt.setDate(dt.getDate() + days);
  return toISO(dt);
}
export function daysBetween(a: string, b: string): number {
  const ms = parseISO(b).getTime() - parseISO(a).getTime();
  return Math.round(ms / 86400000);
}

// Return Monday of the week of given date
export function startOfWeek(iso: string): string {
  const d = parseISO(iso);
  const dow = (d.getDay() + 6) % 7; // Mon=0,...Sun=6
  d.setDate(d.getDate() - dow);
  return toISO(d);
}
// Return first day of month
export function startOfMonth(iso: string): string {
  const d = parseISO(iso);
  d.setDate(1);
  return toISO(d);
}

export type Tick = { iso: string; label: string };

export type TimeScale = {
  mode: ZoomMode;
  startISO: string;
  endISO: string;
  unitDays: number;           // day=1, week=7, month≈30 (we'll compute months by calendar when making ticks)
  unitPx: number;             // pixels per unit
  dateToX(iso: string): number;
  ticks: Tick[];              // header ticks
};

function monthLabel(iso: string): string {
  // "MM" or "YYYY-MM" when first month or January – tweak as you like
  return iso.slice(5, 7);
}

export function useTimeScale(params: {
  mode: ZoomMode;
  startISO: string;
  endISO: string;
  unitPx?: number; // default per mode
}): TimeScale {
  const { mode, startISO, endISO } = params;
  const unitPx = params.unitPx ?? (mode === 'day' ? 40 : mode === 'week' ? 30 : 50);
  const start = startISO;
  const end = endISO;

  let unitDays = 1;
  const ticks: Tick[] = [];

  if (mode === 'day') {
    unitDays = 1;
    const total = daysBetween(start, end) + 1;
    for (let i = 0; i < total; i++) {
      const iso = addDays(start, i);
      ticks.push({ iso, label: iso.slice(5) });
    }
  } else if (mode === 'week') {
    unitDays = 7;
    // ensure the range starts on Monday
    let cur = startOfWeek(start);
    const last = startOfWeek(end);
    while (daysBetween(cur, last) >= 0) {
      ticks.push({ iso: cur, label: cur.slice(5) }); // label "MM-DD" of week start
      cur = addDays(cur, 7);
    }
  } else {
    // month
    unitDays = 30; // used for dateToX step, not for tick generation
    // generate month starts between start and end
    const d0 = parseISO(startOfMonth(start));
    const dEnd = parseISO(end);
    let d = new Date(d0);
    while (d <= dEnd) {
      const iso = toISO(d);
      ticks.push({ iso, label: monthLabel(iso) });
      // move to first of next month
      d.setMonth(d.getMonth() + 1, 1);
    }
  }

  function dateToX(iso: string): number {
    if (mode === 'day' || mode === 'week') {
      // compress days by unitDays
      return (daysBetween(start, iso) / (mode === 'day' ? 1 : 7)) * unitPx;
    } else {
      // month mode: compute months between start-of-months (calendar-accurate)
      const a = parseISO(startOfMonth(start));
      const b = parseISO(startOfMonth(iso));
      const months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
      return months * unitPx;
    }
  }

  return { mode, startISO: start, endISO: end, unitDays, unitPx, dateToX, ticks };
}
