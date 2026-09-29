// Business rules live here, as pure functions over the data shape.
// When the Spring Boot backend arrives, these rules move server-side and the
// screens keep working because they only talk to services/api.js.

import { addDays, daysInMonth, diffDays, monthKey, nextMonthKey, parseISO } from '../lib/dates';

export const DUE_SOON_DAYS = 7;

export const DEFAULT_RENT = { 1: 14000, 2: 9500, 3: 8000, 4: 7000 };
export const AC_EXTRA = 1500;
export const SHARING_TYPES = [1, 2, 3, 4];

export const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash', icon: 'cash' },
  { value: 'upi', label: 'UPI', icon: 'mobile' },
  { value: 'bank', label: 'Bank', icon: 'bank' },
];
export const MODE_LABEL = { cash: 'Cash', upi: 'UPI', bank: 'Bank transfer', online: 'Online' };

export const DOC_TYPES = [
  { key: 'idProof', label: 'Aadhaar / ID proof' },
  { key: 'photo', label: 'Photo' },
  { key: 'workId', label: 'Office / college ID' },
];

export const FLOOR_NAMES = [
  'Ground floor', 'First floor', 'Second floor', 'Third floor',
  'Fourth floor', 'Fifth floor', 'Sixth floor',
];

export const defaultRent = (sharing, ac) => (DEFAULT_RENT[sharing] ?? 8000) + (ac ? AC_EXTRA : 0);
export const isActive = (tenancy) => !tenancy.moveOut;
const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);

/** Next unused bed letters for a room: existing [A, C] + 2 -> [B, D] */
export function nextBedLabels(existingLabels, count) {
  const used = new Set(existingLabels);
  const out = [];
  for (let i = 0; out.length < count && i < 26; i++) {
    const l = String.fromCharCode(65 + i);
    if (!used.has(l)) out.push(l);
  }
  return out;
}

/** Bed status is derived from tenancies; called after every change. */
export function syncBedStatuses(db) {
  for (const bed of db.beds) {
    const t = db.tenancies.find((x) => x.bedId === bed.id && isActive(x));
    bed.status = t ? (t.leavingOn ? 'notice' : 'occupied') : 'empty';
  }
}

/**
 * Plan a sharing-type change without touching occupied beds.
 * Removes empty beds from the end; never removes a bed with a current tenant.
 */
export function planBedResize(beds, occupiedBedIds, newCount) {
  const current = beds.length;
  if (newCount >= current) return { removeIds: [], addCount: newCount - current };
  const need = current - newCount;
  const removable = [...beds].reverse().filter((b) => !occupiedBedIds.has(b.id));
  if (removable.length < need) {
    const occupied = current - removable.length;
    return {
      error: `${occupied} bed${occupied > 1 ? 's are' : ' is'} occupied in this room. Move a tenant out before making it ${newCount} sharing.`,
    };
  }
  return { removeIds: removable.slice(0, need).map((b) => b.id), addCount: 0 };
}

// ---------- Rent ----------

/** Rent is due every month on the move-in day (clamped to month length). */
export function dueDateFor(tenancy, key) {
  const day = parseISO(tenancy.moveIn).getDate();
  const [y, m] = key.split('-').map(Number);
  return `${key}-${String(Math.min(day, daysInMonth(y, m - 1))).padStart(2, '0')}`;
}

/** Rent months from move-in up to the one due within the next DUE_SOON_DAYS. */
export function rentCycles(tenancy, todayISO) {
  const horizon = addDays(todayISO, DUE_SOON_DAYS);
  const cycles = [];
  let key = monthKey(tenancy.moveIn);
  for (let guard = 0; guard < 240; guard++) {
    const dueDate = dueDateFor(tenancy, key);
    if (dueDate > horizon) break;
    if (tenancy.moveOut && dueDate >= tenancy.moveOut) break;
    cycles.push({ forMonth: key, dueDate });
    key = nextMonthKey(key);
  }
  return cycles;
}

export function nextDueDate(tenancy, todayISO) {
  if (tenancy.moveIn > todayISO) return tenancy.moveIn;
  let key = monthKey(todayISO);
  let due = dueDateFor(tenancy, key);
  if (due <= todayISO) due = dueDateFor(tenancy, nextMonthKey(key));
  return due;
}

/**
 * One item per rent month that needs attention, plus the latest paid month.
 * status: 'overdue' | 'dueSoon' | 'paid'
 */
export function rentItemsForTenancy(db, tenancy, todayISO) {
  const pays = db.payments.filter((p) => p.tenancyId === tenancy.id && !p.rejected);
  const cycles = rentCycles(tenancy, todayISO);
  const items = [];
  cycles.forEach((c, i) => {
    const monthPays = pays.filter((p) => p.forMonth === c.forMonth);
    const confirmed = monthPays.filter((p) => p.confirmedByOwner);
    const awaiting = monthPays.filter((p) => !p.confirmedByOwner);
    const paid = sum(confirmed, (p) => p.amount);
    const balance = Math.max(0, tenancy.rent - paid);
    const isLatest = i === cycles.length - 1;
    let status;
    if (balance === 0) status = 'paid';
    else if (c.dueDate < todayISO) status = 'overdue';
    else status = 'dueSoon';
    if (status === 'paid' && !isLatest) return; // older paid months are just history
    const lastPayment = [...confirmed].sort((a, b) => b.paidOn.localeCompare(a.paidOn))[0];
    items.push({
      id: `${tenancy.id}:${c.forMonth}`,
      tenancyId: tenancy.id,
      tenantId: tenancy.tenantId,
      bedId: tenancy.bedId,
      forMonth: c.forMonth,
      dueDate: c.dueDate,
      rent: tenancy.rent,
      paid,
      balance,
      status,
      awaiting,
      lastPayment,
      daysLate: status === 'overdue' ? diffDays(todayISO, c.dueDate) : 0,
      daysLeft: status === 'dueSoon' ? diffDays(c.dueDate, todayISO) : 0,
    });
  });
  return items;
}

const STATUS_ORDER = { overdue: 0, dueSoon: 1, paid: 2 };

export function rentItems(db, todayISO) {
  const items = db.tenancies
    .filter(isActive)
    .flatMap((t) => rentItemsForTenancy(db, t, todayISO));
  return items.sort((a, b) =>
    STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
    (a.status === 'overdue' ? b.daysLate - a.daysLate : a.dueDate.localeCompare(b.dueDate)),
  );
}

export function tenancyRentState(db, tenancy, todayISO) {
  const items = isActive(tenancy) ? rentItemsForTenancy(db, tenancy, todayISO) : [];
  const unpaid = items.filter((i) => i.status !== 'paid');
  const worst = unpaid.some((i) => i.status === 'overdue') ? 'overdue' : unpaid.length ? 'dueSoon' : 'paid';
  return {
    items,
    unpaid,
    worst,
    balance: sum(unpaid, (i) => i.balance),
    nextDue: isActive(tenancy) ? nextDueDate(tenancy, todayISO) : null,
  };
}

export function propertySummary(db, todayISO) {
  const beds = db.beds.filter((b) => !b.archived);
  const count = (s) => beds.filter((b) => b.status === s).length;
  const items = rentItems(db, todayISO);
  const unpaid = items.filter((i) => i.status !== 'paid');
  const overdue = unpaid.filter((i) => i.status === 'overdue');
  const month = monthKey(todayISO);
  return {
    totalBeds: beds.length,
    emptyBeds: count('empty'),
    occupiedBeds: count('occupied'),
    noticeBeds: count('notice'),
    dueThisWeek: sum(unpaid, (i) => i.balance),
    dueThisWeekCount: unpaid.length,
    overdueCount: overdue.length,
    overdueAmount: sum(overdue, (i) => i.balance),
    collectedThisMonth: sum(
      db.payments.filter((p) => p.confirmedByOwner && !p.rejected && monthKey(p.paidOn) === month),
      (p) => p.amount,
    ),
    awaitingConfirmation: db.payments.filter((p) => !p.confirmedByOwner && !p.rejected).length,
  };
}

/** Suggest the next room number on a floor: "101" -> "102", "G02" -> "G03". */
export function suggestRoomNo(existingRoomNos, floorOrder) {
  const last = [...existingRoomNos].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).pop();
  if (last) {
    const m = last.match(/^(.*?)(\d+)$/);
    if (m) return m[1] + String(Number(m[2]) + 1).padStart(m[2].length, '0');
  }
  return floorOrder === 0 ? 'G01' : `${floorOrder}01`;
}
