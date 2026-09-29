// The single data-access layer for every screen.
// Today it reads/writes the local store. Later, the internals of these functions
// become calls to the Spring Boot API; the screens do not change.
// Reads are synchronous (from the cached copy); writes are async like real API calls.

import { monthKey, today } from '../lib/dates';
import * as logic from './logic';
import { createEmptyData, createSampleData } from './sampleData';
import { commit, getState, replaceState, useData } from './store';

export { useData };

const db = getState;
const uid = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const byRoomNo = (a, b) => a.roomNo.localeCompare(b.roomNo, undefined, { numeric: true });
const clean = (s) => (s || '').trim().replace(/\s+/g, ' ');

// ---------- Reads ----------

export const getProperty = () => db().property;

export const getFloors = () => db().floors.filter((f) => !f.archived).sort((a, b) => a.order - b.order);
export const getFloor = (id) => db().floors.find((f) => f.id === id);

export const getRooms = (floorId) =>
  db().rooms.filter((r) => !r.archived && (!floorId || r.floorId === floorId)).sort(byRoomNo);
export const getRoom = (id) => db().rooms.find((r) => r.id === id);

export const getBeds = (roomId) =>
  db().beds.filter((b) => b.roomId === roomId && !b.archived).sort((a, b) => a.label.localeCompare(b.label));
export const getBed = (id) => db().beds.find((b) => b.id === id);

export const getTenant = (id) => db().tenants.find((t) => t.id === id);
export const getTenancy = (id) => db().tenancies.find((t) => t.id === id);

export const getActiveTenancyForBed = (bedId) =>
  db().tenancies.find((t) => t.bedId === bedId && logic.isActive(t));

export const getTenanciesForTenant = (tenantId) =>
  db().tenancies.filter((t) => t.tenantId === tenantId).sort((a, b) => b.moveIn.localeCompare(a.moveIn));

/** Current stay if any, otherwise the most recent one. */
export function getCurrentTenancy(tenantId) {
  const all = getTenanciesForTenant(tenantId);
  return all.find(logic.isActive) ?? all[0];
}

/** Tenants with their current stay, newest move-in first. */
export function getTenantList() {
  return db()
    .tenants.map((tenant) => ({ tenant, tenancy: getCurrentTenancy(tenant.id) }))
    .filter((x) => x.tenancy)
    .sort((a, b) => b.tenancy.moveIn.localeCompare(a.tenancy.moveIn));
}

export function getBedPlace(bedId) {
  const bed = getBed(bedId);
  const room = bed && getRoom(bed.roomId);
  const floor = room && getFloor(room.floorId);
  return {
    bed, room, floor,
    short: room ? `${room.roomNo}-${bed.label}` : '',
    label: room ? `Room ${room.roomNo} · Bed ${bed.label}` : 'Unknown bed',
  };
}

export const getPaymentsForTenancy = (tenancyId) =>
  db().payments.filter((p) => p.tenancyId === tenancyId).sort((a, b) => b.paidOn.localeCompare(a.paidOn));

export function getPaymentsForTenant(tenantId) {
  const ids = new Set(getTenanciesForTenant(tenantId).map((t) => t.id));
  return db().payments.filter((p) => ids.has(p.tenancyId)).sort((a, b) => b.paidOn.localeCompare(a.paidOn));
}

export const getPayment = (id) => db().payments.find((p) => p.id === id);

export const getPaymentsAwaitingConfirmation = () =>
  db().payments.filter((p) => !p.confirmedByOwner && !p.rejected);

export const getRentItems = () => logic.rentItems(db(), today());
export const getTenancyRentState = (tenancyId) => logic.tenancyRentState(db(), getTenancy(tenancyId), today());
export const getSummary = () => logic.propertySummary(db(), today());

/** Beds per status for a set of beds. */
export const countEmpty = (beds) => beds.filter((b) => b.status === 'empty').length;

// ---------- Property & floors ----------

export async function updateProperty({ name, address }) {
  commit((d) => {
    if (!clean(name)) throw new Error('Please enter the PG name');
    d.property.name = clean(name);
    d.property.address = clean(address);
  });
}

export async function addFloor(name) {
  return commit((d) => {
    if (!clean(name)) throw new Error('Please enter a floor name');
    const order = Math.max(-1, ...d.floors.map((f) => f.order)) + 1;
    const floor = { id: uid('fl'), propertyId: d.property.id, name: clean(name), order };
    d.floors.push(floor);
    return floor;
  });
}

export async function renameFloor(id, name) {
  commit((d) => {
    if (!clean(name)) throw new Error('Please enter a floor name');
    d.floors.find((f) => f.id === id).name = clean(name);
  });
}

export async function deleteFloor(id) {
  commit((d) => {
    const rooms = d.rooms.filter((r) => r.floorId === id && !r.archived);
    for (const r of rooms) removeRoomIn(d, r.id);
    const floor = d.floors.find((f) => f.id === id);
    if (d.rooms.some((r) => r.floorId === id)) floor.archived = true;
    else d.floors = d.floors.filter((f) => f.id !== id);
  });
}

// ---------- Rooms & beds ----------

function assertRoomNoFree(d, roomNo, exceptId) {
  const taken = d.rooms.some(
    (r) => !r.archived && r.id !== exceptId && r.roomNo.toLowerCase() === roomNo.toLowerCase(),
  );
  if (taken) throw new Error(`Room ${roomNo} already exists`);
}

export async function addRoom({ floorId, roomNo, sharingType, ac, attachedBath, rent }) {
  return commit((d) => {
    roomNo = clean(roomNo);
    if (!roomNo) throw new Error('Please enter a room number');
    assertRoomNoFree(d, roomNo);
    const room = { id: uid('rm'), floorId, roomNo, sharingType, ac, attachedBath };
    d.rooms.push(room);
    logic.nextBedLabels([], sharingType).forEach((label) =>
      d.beds.push({ id: uid('bd'), roomId: room.id, label, rent, status: 'empty' }),
    );
    return room;
  });
}

/** Changing sharing adds beds or removes empty ones; tenant history is never lost. */
export async function updateRoom(id, { floorId, roomNo, sharingType, ac, attachedBath, bedRents = {}, newBedRent }) {
  commit((d) => {
    const room = d.rooms.find((r) => r.id === id);
    roomNo = clean(roomNo);
    if (!roomNo) throw new Error('Please enter a room number');
    assertRoomNoFree(d, roomNo, id);
    const beds = d.beds.filter((b) => b.roomId === id && !b.archived).sort((a, b) => a.label.localeCompare(b.label));
    const occupied = new Set(d.tenancies.filter(logic.isActive).map((t) => t.bedId));
    const plan = logic.planBedResize(beds, occupied, sharingType);
    if (plan.error) throw new Error(plan.error);
    for (const bedId of plan.removeIds) removeBedIn(d, bedId);
    logic.nextBedLabels(beds.map((b) => b.label), plan.addCount).forEach((label) =>
      d.beds.push({ id: uid('bd'), roomId: id, label, rent: newBedRent, status: 'empty' }),
    );
    for (const [bedId, rent] of Object.entries(bedRents)) {
      const bed = d.beds.find((b) => b.id === bedId);
      if (bed && !bed.archived && rent > 0) bed.rent = rent;
    }
    Object.assign(room, { floorId, roomNo, sharingType, ac, attachedBath });
  });
}

function removeBedIn(d, bedId) {
  const hasHistory = d.tenancies.some((t) => t.bedId === bedId);
  if (hasHistory) d.beds.find((b) => b.id === bedId).archived = true;
  else d.beds = d.beds.filter((b) => b.id !== bedId);
}

function removeRoomIn(d, roomId) {
  const room = d.rooms.find((r) => r.id === roomId);
  const beds = d.beds.filter((b) => b.roomId === roomId && !b.archived);
  if (beds.some((b) => d.tenancies.some((t) => t.bedId === b.id && logic.isActive(t)))) {
    throw new Error(`Room ${room.roomNo} has tenants. Move them out first.`);
  }
  beds.forEach((b) => removeBedIn(d, b.id));
  if (d.beds.some((b) => b.roomId === roomId)) room.archived = true;
  else d.rooms = d.rooms.filter((r) => r.id !== roomId);
}

export async function deleteRoom(id) {
  commit((d) => removeRoomIn(d, id));
}

// ---------- Tenants & stays ----------

export async function addTenant({ name, phone, bedId, rent, deposit, moveIn, firstRentMode, sendDocLink }) {
  return commit((d) => {
    name = clean(name);
    if (!name) throw new Error("Please enter the tenant's name");
    if (!bedId) throw new Error('Please pick a bed');
    const bed = d.beds.find((b) => b.id === bedId && !b.archived);
    if (!bed) throw new Error('This bed no longer exists');
    if (d.tenancies.some((t) => t.bedId === bedId && logic.isActive(t))) {
      throw new Error('Someone is already staying in this bed');
    }
    const tenant = {
      id: uid('tn'), name, phone,
      documents: { linkSentOn: sendDocLink ? today() : null, consentOn: null, files: {} },
    };
    const tenancy = {
      id: uid('ty'), bedId, tenantId: tenant.id, moveIn, moveOut: null,
      rent, deposit, noticeOn: null, leavingOn: null, depositRefund: null,
    };
    d.tenants.push(tenant);
    d.tenancies.push(tenancy);
    if (firstRentMode) {
      d.payments.push({
        id: uid('pay'), tenancyId: tenancy.id, amount: rent, mode: firstRentMode, paidOn: today(),
        forMonth: monthKey(moveIn), note: 'First month rent', confirmedByOwner: true, reportedByTenant: false,
      });
    }
    return { tenant, tenancy };
  });
}

export async function updateTenant(tenantId, { name, phone }) {
  commit((d) => {
    if (!clean(name)) throw new Error("Please enter the tenant's name");
    const t = d.tenants.find((x) => x.id === tenantId);
    t.name = clean(name);
    t.phone = phone;
  });
}

export async function updateTenancy(tenancyId, { rent, deposit }) {
  commit((d) => {
    const t = d.tenancies.find((x) => x.id === tenancyId);
    if (rent > 0) t.rent = rent;
    if (deposit >= 0) t.deposit = deposit;
  });
}

export async function giveNotice(tenancyId, leavingOn) {
  commit((d) => {
    const t = d.tenancies.find((x) => x.id === tenancyId);
    t.noticeOn = today();
    t.leavingOn = leavingOn;
  });
}

export async function cancelNotice(tenancyId) {
  commit((d) => {
    const t = d.tenancies.find((x) => x.id === tenancyId);
    t.noticeOn = null;
    t.leavingOn = null;
  });
}

/** The stay is closed, never deleted, so the history stays. */
export async function moveOut(tenancyId, { date, depositRefund, note }) {
  commit((d) => {
    const t = d.tenancies.find((x) => x.id === tenancyId);
    t.moveOut = date;
    t.leavingOn = t.leavingOn ?? date;
    t.depositRefund = depositRefund;
    t.moveOutNote = clean(note);
  });
}

// ---------- Payments (a record of money received, not payment processing) ----------

export async function markPaid({ tenancyId, forMonth, amount, mode, paidOn, note }) {
  return commit((d) => {
    if (!(amount > 0)) throw new Error('Please enter the amount received');
    const p = {
      id: uid('pay'), tenancyId, amount, mode, paidOn, forMonth,
      note: clean(note), confirmedByOwner: true, reportedByTenant: false,
    };
    d.payments.push(p);
    return p;
  });
}

/** Tenant taps "I've paid" on WhatsApp; the owner confirms later. */
export async function reportPayment({ tenancyId, forMonth, amount, mode }) {
  return commit((d) => {
    const p = {
      id: uid('pay'), tenancyId, amount, mode, paidOn: today(), forMonth,
      note: '', confirmedByOwner: false, reportedByTenant: true,
    };
    d.payments.push(p);
    return p;
  });
}

export async function confirmPayment(paymentId) {
  commit((d) => {
    d.payments.find((p) => p.id === paymentId).confirmedByOwner = true;
  });
}

export async function rejectPayment(paymentId) {
  commit((d) => {
    d.payments.find((p) => p.id === paymentId).rejected = true;
  });
}

export async function deletePayment(paymentId) {
  commit((d) => {
    d.payments = d.payments.filter((p) => p.id !== paymentId);
  });
}

// ---------- Documents (mock: only file names are kept, never the files) ----------

export async function sendDocumentLink(tenantId) {
  commit((d) => {
    d.tenants.find((t) => t.id === tenantId).documents.linkSentOn = today();
  });
}

export async function giveDocumentConsent(tenantId) {
  commit((d) => {
    d.tenants.find((t) => t.id === tenantId).documents.consentOn = today();
  });
}

export async function uploadDocument(tenantId, docKey, fileName) {
  commit((d) => {
    const docs = d.tenants.find((t) => t.id === tenantId).documents;
    docs.files[docKey] = { name: fileName, uploadedOn: today() };
  });
}

// ---------- Demo ----------

export async function resetDemo() {
  replaceState(createSampleData(today()));
}

export async function startFresh(name, address) {
  replaceState(createEmptyData(clean(name) || 'My PG', clean(address)));
}
