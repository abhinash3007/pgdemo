// Sample PG, generated relative to today so dues always look realistic on demo day.

import { addDays, addMonths } from '../lib/dates';
import { defaultRent, rentCycles, syncBedStatuses } from './logic';

export const SCHEMA = 1;

export function createEmptyData(name = 'My PG', address = '') {
  return {
    schema: SCHEMA,
    property: { id: 'p1', name, address, ownerId: 'o1' },
    floors: [],
    rooms: [],
    beds: [],
    tenants: [],
    tenancies: [],
    payments: [],
  };
}

const FLOORS = ['Ground floor', 'First floor', 'Second floor'];

// [floorIndex, roomNo, sharing, ac, attachedBath]
const ROOMS = [
  [0, 'G01', 2, false, true],
  [0, 'G02', 3, false, false],
  [0, 'G03', 1, true, true],
  [1, '101', 2, true, true],
  [1, '102', 3, false, true],
  [1, '103', 4, false, false],
  [2, '201', 2, false, true],
  [2, '202', 1, true, true],
];

// [room, bed, name, phone, monthsStayed, dueInDays (this month's due date vs today), rent scenario, docs]
//  scenario: paid | dueSoon | overdue | overdue2 (two months) | partial | reported (tenant says paid by UPI)
//  docs: all | none | sent | some
const PEOPLE = [
  ['G01', 'A', 'Rahul Sharma', '9845012345', 14, -3, 'paid', 'all'],
  ['G01', 'B', 'Arjun Reddy', '9900123456', 5, 3, 'dueSoon', 'all'],
  ['G02', 'A', 'Vikram Singh', '9731245678', 9, -12, 'overdue2', 'some'],
  ['G02', 'B', 'Karthik Gowda', '9886034567', 3, 10, 'paid', 'all'],
  ['G03', 'A', 'Nikhil Jain', '9008765432', 7, -6, 'partial', 'all'],
  ['101', 'A', 'Rohit Verma', '9845098765', 11, -2, 'reported', 'all'],
  ['101', 'B', 'Aditya Rao', '9611223344', 2, 1, 'dueSoon', 'none'],
  ['102', 'A', 'Sanjay Patil', '9535667788', 8, -9, 'overdue', 'all'],
  ['102', 'B', 'Manoj Kumar', '9742556677', 6, 15, 'paid', 'all'],
  ['103', 'A', 'Abdul Rahman', '9880445566', 4, -1, 'paid', 'all'],
  ['103', 'B', 'Pradeep Shetty', '9164778899', 10, 20, 'paid', 'all'],
  ['103', 'C', 'Deepak Yadav', '9019887766', 0, -4, 'paid', 'sent'],
  ['201', 'A', 'Suresh Babu', '9448332211', 13, -18, 'paid', 'all'],
  ['202', 'A', 'Harish Murthy', '9972115599', 5, 12, 'paid', 'all'],
];

const MODES = ['upi', 'cash', 'upi', 'cash', 'bank', 'upi'];

export function createSampleData(todayISO) {
  const db = createEmptyData('Sri Sai Comforts PG for Gents', '4th Cross, BTM Layout 2nd Stage, Bengaluru');
  let n = 0;
  const id = (p) => `${p}_s${++n}`;

  FLOORS.forEach((name, order) => db.floors.push({ id: id('fl'), propertyId: 'p1', name, order }));

  for (const [fi, roomNo, sharing, ac, attachedBath] of ROOMS) {
    const room = { id: id('rm'), floorId: db.floors[fi].id, roomNo, sharingType: sharing, ac, attachedBath };
    db.rooms.push(room);
    for (let i = 0; i < sharing; i++) {
      db.beds.push({
        id: id('bd'), roomId: room.id, label: String.fromCharCode(65 + i),
        rent: defaultRent(sharing, ac), status: 'empty',
      });
    }
  }

  const bedFor = (roomNo, label) => {
    const room = db.rooms.find((r) => r.roomNo === roomNo);
    return db.beds.find((b) => b.roomId === room.id && b.label === label);
  };

  const docFiles = (kind) => {
    const all = {
      idProof: { name: 'aadhaar.jpg' },
      photo: { name: 'photo.jpg' },
      workId: { name: 'office-id.jpg' },
    };
    if (kind === 'all') return all;
    if (kind === 'some') return { idProof: all.idProof };
    return {};
  };

  // A past tenant, to show that history is kept after move-out.
  const pastBed = bedFor('G02', 'C');
  const past = { id: id('tn'), name: 'Kiran Desai', phone: '9845543210', documents: { linkSentOn: null, consentOn: null, files: {} } };
  const pastStay = {
    id: id('ty'), bedId: pastBed.id, tenantId: past.id,
    moveIn: addMonths(todayISO, -10), moveOut: addDays(todayISO, -45),
    rent: pastBed.rent, deposit: pastBed.rent, noticeOn: addDays(todayISO, -75), leavingOn: addDays(todayISO, -45),
    depositRefund: pastBed.rent - 1000, moveOutNote: '₹1,000 kept for broken cupboard lock',
  };
  db.tenants.push(past);
  db.tenancies.push(pastStay);
  rentCycles(pastStay, todayISO).forEach((c, i) =>
    db.payments.push(payment(id, pastStay, c, pastStay.rent, MODES[i % MODES.length], c.dueDate)),
  );

  PEOPLE.forEach(([roomNo, label, name, phone, months, dueIn, scenario, docs], idx) => {
    const bed = bedFor(roomNo, label);
    const thisDue = addDays(todayISO, dueIn);
    const moveIn = addMonths(thisDue, -months);
    const uploadedOn = addDays(moveIn, 1);
    const files = docFiles(docs);
    for (const f of Object.values(files)) f.uploadedOn = uploadedOn;
    const tenant = {
      id: id('tn'), name, phone,
      documents: {
        linkSentOn: docs === 'none' ? null : moveIn,
        consentOn: Object.keys(files).length ? uploadedOn : null,
        files,
      },
    };
    const deposit = idx % 3 === 0 ? bed.rent * 2 : bed.rent;
    const tenancy = {
      id: id('ty'), bedId: bed.id, tenantId: tenant.id, moveIn, moveOut: null,
      rent: bed.rent, deposit, noticeOn: null, leavingOn: null, depositRefund: null,
    };
    if (name === 'Manoj Kumar') {
      tenancy.noticeOn = addDays(todayISO, -8);
      tenancy.leavingOn = addDays(todayISO, 13);
    }
    db.tenants.push(tenant);
    db.tenancies.push(tenancy);

    const cycles = rentCycles(tenancy, todayISO);
    cycles.forEach((c, i) => {
      const fromEnd = cycles.length - 1 - i;
      const mode = MODES[(idx + i) % MODES.length];
      const paidOn = c.dueDate > todayISO ? todayISO : addDays(c.dueDate, (idx + i) % 3);
      const onTime = paidOn > todayISO ? todayISO : paidOn;
      if (fromEnd === 0) {
        if (scenario === 'dueSoon' || scenario === 'overdue' || scenario === 'overdue2') return;
        if (scenario === 'partial') {
          db.payments.push(payment(id, tenancy, c, Math.round(tenancy.rent / 2 / 500) * 500, 'cash', addDays(c.dueDate, 1), 'Rest by month end'));
          return;
        }
        if (scenario === 'reported') {
          db.payments.push({
            ...payment(id, tenancy, c, tenancy.rent, 'upi', addDays(todayISO, -1)),
            confirmedByOwner: false, reportedByTenant: true, note: 'UPI ref 4521 8876 1203',
          });
          return;
        }
      }
      if (fromEnd === 1 && scenario === 'overdue2') return;
      db.payments.push(payment(id, tenancy, c, tenancy.rent, mode, onTime, i === 0 ? 'First month rent' : ''));
    });
  });

  syncBedStatuses(db);
  return db;
}

function payment(id, tenancy, cycle, amount, mode, paidOn, note = '') {
  return {
    id: id('pay'), tenancyId: tenancy.id, amount, mode, paidOn,
    forMonth: cycle.forMonth, note, confirmedByOwner: true, reportedByTenant: false,
  };
}
