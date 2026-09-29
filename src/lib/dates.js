// Dates are stored as local ISO strings ("2026-09-29") and months as "2026-09".
// String comparison works for ordering, so most logic never needs Date objects.

const pad = (n) => String(n).padStart(2, '0');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const today = () => toISO(new Date());

export function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export const daysInMonth = (year, month0) => new Date(year, month0 + 1, 0).getDate();

export function addMonths(iso, n) {
  const d = parseISO(iso);
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  t.setDate(Math.min(d.getDate(), daysInMonth(t.getFullYear(), t.getMonth())));
  return toISO(t);
}

/** a - b, in whole days */
export const diffDays = (a, b) => Math.round((parseISO(a) - parseISO(b)) / 86400000);

export const monthKey = (iso) => iso.slice(0, 7);

export function nextMonthKey(key) {
  let [y, m] = key.split('-').map(Number);
  m += 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return `${y}-${pad(m)}`;
}

export function fmtDate(iso, { year } = {}) {
  if (!iso) return '';
  const d = parseISO(iso);
  const showYear = year ?? d.getFullYear() !== new Date().getFullYear();
  return `${d.getDate()} ${MON[d.getMonth()]}${showYear ? ' ' + d.getFullYear() : ''}`;
}

export function fmtMonth(key, { long = false, year } = {}) {
  const [y, m] = key.split('-').map(Number);
  const name = (long ? MONTH : MON)[m - 1];
  const showYear = year ?? y !== new Date().getFullYear();
  return showYear ? `${name} ${y}` : name;
}

/** "today", "tomorrow", "in 3 days", "5 days ago" */
export function relDays(iso, todayISO) {
  const n = diffDays(iso, todayISO);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

/** "12 days", "3 months", "1 year 2 months" */
export function durationBetween(fromISO, toISOString) {
  const days = diffDays(toISOString, fromISO);
  if (days < 31) return `${Math.max(days, 0)} day${days === 1 ? '' : 's'}`;
  const a = parseISO(fromISO);
  const b = parseISO(toISOString);
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) months -= 1;
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts = [];
  if (y) parts.push(`${y} year${y > 1 ? 's' : ''}`);
  if (m) parts.push(`${m} month${m > 1 ? 's' : ''}`);
  return parts.join(' ') || '1 month';
}

export function timeNow() {
  return new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
}
