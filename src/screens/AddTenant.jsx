import { useMemo, useState } from 'react';
import * as api from '../services/api';
import { PAYMENT_MODES } from '../services/logic';
import { addDays, fmtDate, today } from '../lib/dates';
import { firstName, isValidPhone, phoneDisplay, plural, rupees } from '../lib/format';
import { navigate } from '../router';
import { toastError } from '../components/feedback';
import { BedDot, Button, Chip, EmptyState, Field, Icon, MoneyInput, PhoneInput, Segmented, Sheet, Switch, TextInput, TopBar } from '../components/ui';

export default function AddTenant({ query }) {
  const floors = api.getFloors();
  const preBed = query.get('bed') ? api.getBed(query.get('bed')) : null;
  const prePlace = preBed && preBed.status === 'empty' ? api.getBedPlace(preBed.id) : null;

  // Only floors/rooms with at least one empty bed are worth offering first.
  const layout = useMemo(
    () =>
      floors.map((floor) => {
        const rooms = api.getRooms(floor.id).map((room) => ({ room, beds: api.getBeds(room.id) }));
        return { floor, rooms, empty: rooms.reduce((n, r) => n + api.countEmpty(r.beds), 0) };
      }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const firstWithEmpty = layout.find((f) => f.empty > 0);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [floorId, setFloorId] = useState(prePlace?.floor.id ?? firstWithEmpty?.floor.id ?? floors[0]?.id);
  const [roomId, setRoomId] = useState(prePlace?.room.id ?? null);
  const [bedId, setBedId] = useState(prePlace?.bed.id ?? null);
  const [rent, setRent] = useState(prePlace?.bed.rent ?? 0);
  const [deposit, setDeposit] = useState(prePlace?.bed.rent ?? 0);
  const [depositTouched, setDepositTouched] = useState(false);
  const [moveIn, setMoveIn] = useState(today());
  const [collectFirst, setCollectFirst] = useState(true);
  const [mode, setMode] = useState('cash');
  const [sendLink, setSendLink] = useState(true);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);

  const floorData = layout.find((f) => f.floor.id === floorId);
  const roomData = floorData?.rooms.find((r) => r.room.id === roomId);
  const totalEmpty = layout.reduce((n, f) => n + f.empty, 0);
  const t = today();

  function pickFloor(id) {
    setFloorId(id);
    const f = layout.find((x) => x.floor.id === id);
    const onlyRoom = f.rooms.filter((r) => api.countEmpty(r.beds) > 0);
    pickRoom(onlyRoom.length === 1 ? onlyRoom[0] : null);
  }

  function pickRoom(rd) {
    setRoomId(rd?.room.id ?? null);
    const empties = rd ? rd.beds.filter((b) => b.status === 'empty') : [];
    pickBed(empties.length === 1 ? empties[0] : null);
  }

  function pickBed(bed) {
    setBedId(bed?.id ?? null);
    if (bed) {
      setRent(bed.rent);
      if (!depositTouched) setDeposit(bed.rent);
    }
    setErrors((e) => ({ ...e, bed: undefined }));
  }

  async function save() {
    const errs = {};
    if (!name.trim()) errs.name = "Please enter the tenant's name";
    if (!isValidPhone(phone)) errs.phone = 'Please enter a 10-digit mobile number';
    if (!bedId) errs.bed = 'Please pick a bed';
    if (!rent) errs.rent = 'Please enter the rent';
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.querySelector('.field-error, .form-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSaving(true);
    try {
      const res = await api.addTenant({
        name, phone, bedId, rent, deposit, moveIn,
        firstRentMode: collectFirst ? mode : null,
        sendDocLink: sendLink,
      });
      setDone(res);
    } catch (e) {
      toastError(e);
      setSaving(false);
    }
  }

  if (floors.length === 0 || totalEmpty === 0) {
    return (
      <div className="screen">
        <TopBar title="Add tenant" />
        <EmptyState
          icon="bed"
          title={floors.length === 0 ? 'No rooms yet' : 'All beds are full'}
          text={floors.length === 0 ? 'Add floors and rooms first, then add tenants.' : 'Add a room, or mark someone as moved out to free a bed.'}
          action={<Button onClick={() => navigate('/', { replace: true })}>Go to my PG</Button>}
        />
      </div>
    );
  }

  return (
    <div className="screen with-footer">
      <TopBar title="Add tenant" subtitle={plural(totalEmpty, 'empty bed')} />

      <div className="form">
        <Field label="Name" htmlFor="name" error={errors.name}>
          <TextInput id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoCapitalize="words" autoComplete="off" />
        </Field>

        <Field label="Mobile number" htmlFor="phone" error={errors.phone} hint="Rent reminders and receipts go to this WhatsApp number.">
          <PhoneInput id="phone" value={phone} onChange={setPhone} />
        </Field>

        <div className="field">
          <span className="field-label">Bed</span>
          <div className="picker">
            <div className="picker-step">
              <span className="picker-label">Floor</span>
              <div className="chip-row scroll">
                {layout.map((f) => (
                  <Chip key={f.floor.id} active={floorId === f.floor.id} onClick={() => pickFloor(f.floor.id)}>
                    {f.floor.name} <span className={f.empty ? 'chip-count green' : 'chip-count'}>{f.empty}</span>
                  </Chip>
                ))}
              </div>
            </div>
            {floorData && (
              <div className="picker-step">
                <span className="picker-label">Room</span>
                {floorData.rooms.length === 0 ? (
                  <p className="muted small">No rooms on this floor</p>
                ) : (
                  <div className="chip-row">
                    {floorData.rooms.map((rd) => {
                      const e = api.countEmpty(rd.beds);
                      return (
                        <Chip key={rd.room.id} active={roomId === rd.room.id} disabled={!e} onClick={() => pickRoom(rd)}>
                          {rd.room.roomNo}
                          <span className="chip-sub">{e ? `${e} empty` : 'Full'}</span>
                        </Chip>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {roomData && (
              <div className="picker-step">
                <span className="picker-label">Bed</span>
                <div className="bed-pick-row">
                  {roomData.beds.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      className={`bed-pick${bedId === b.id ? ' active' : ''}`}
                      disabled={b.status !== 'empty'}
                      onClick={() => pickBed(b)}
                      aria-pressed={bedId === b.id}
                    >
                      <BedDot bed={b} />
                      <span>{b.status === 'empty' ? rupees(b.rent) : 'Taken'}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {errors.bed && <p className="field-error">{errors.bed}</p>}
        </div>

        <div className="form-grid-2">
          <Field label="Monthly rent" htmlFor="rent" error={errors.rent}>
            <MoneyInput id="rent" value={rent} onChange={setRent} />
          </Field>
          <Field label="Deposit" htmlFor="deposit">
            <MoneyInput id="deposit" value={deposit} onChange={(v) => { setDeposit(v); setDepositTouched(true); }} />
          </Field>
        </div>

        <Field label="Move-in date" htmlFor="moveIn" hint={`Rent will be due on day ${Number(moveIn.slice(8))} of every month.`}>
          <div className="chip-row">
            <Chip active={moveIn === t} onClick={() => setMoveIn(t)}>Today</Chip>
            <Chip active={moveIn === addDays(t, 1)} onClick={() => setMoveIn(addDays(t, 1))}>Tomorrow</Chip>
            <input id="moveIn" type="date" className="input input-date" value={moveIn} onChange={(e) => e.target.value && setMoveIn(e.target.value)} aria-label="Pick move-in date" />
          </div>
          {moveIn !== t && moveIn !== addDays(t, 1) && <p className="field-hint strong">{fmtDate(moveIn, { year: true })}</p>}
        </Field>

        <div className="switch-group">
          <Switch
            label="First month's rent received"
            sublabel={rent ? `${rupees(rent)} will be saved as paid` : null}
            checked={collectFirst}
            onChange={setCollectFirst}
          />
          {collectFirst && (
            <div className="switch-extra">
              <Segmented label="Payment mode" options={PAYMENT_MODES} value={mode} onChange={setMode} />
            </div>
          )}
          <Switch
            label="Send document upload link"
            sublabel="Tenant uploads Aadhaar and photo themselves on WhatsApp"
            checked={sendLink}
            onChange={setSendLink}
          />
        </div>
      </div>

      <div className="footer-bar">
        <Button block size="lg" icon="check" onClick={save} disabled={saving}>
          Save tenant
        </Button>
      </div>

      {done && <SuccessSheet result={done} sentLink={sendLink} />}
    </div>
  );
}

function SuccessSheet({ result, sentLink }) {
  const { tenant, tenancy } = result;
  const place = api.getBedPlace(tenancy.bedId);
  const goProfile = () => navigate(`/tenant/${tenant.id}`, { replace: true });
  return (
    <Sheet onClose={goProfile}>
      <div className="success">
        <span className="success-icon">
          <Icon name="check" size={34} stroke={3} />
        </span>
        <h2>{firstName(tenant.name)} is added</h2>
        <p>
          {place.floor.name} · {place.label} is now <strong>occupied</strong>.
        </p>
        {sentLink && (
          <p className="success-note">
            <Icon name="chat" size={16} /> Document link sent to {phoneDisplay(tenant.phone)}
          </p>
        )}
        <div className="stack">
          {sentLink ? (
            <Button block variant="secondary" icon="eye" onClick={() => navigate(`/whatsapp?type=docs&tenant=${tenant.id}`, { replace: true })}>
              See the WhatsApp message
            </Button>
          ) : (
            <Button
              block
              variant="secondary"
              icon="send"
              onClick={async () => {
                await api.sendDocumentLink(tenant.id);
                navigate(`/whatsapp?type=docs&tenant=${tenant.id}`, { replace: true });
              }}
            >
              Send document link
            </Button>
          )}
          <Button block onClick={goProfile}>Open {firstName(tenant.name)}'s profile</Button>
          <button type="button" className="link-btn" onClick={() => navigate('/', { replace: true })}>Back to my PG</button>
        </div>
      </div>
    </Sheet>
  );
}
