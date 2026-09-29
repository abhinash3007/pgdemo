import { useState } from 'react';
import * as api from '../services/api';
import { useData } from '../services/api';
import { defaultRent, FLOOR_NAMES, planBedResize, SHARING_TYPES, suggestRoomNo } from '../services/logic';
import { fmtDate } from '../lib/dates';
import { plural, rupees } from '../lib/format';
import { navigate } from '../router';
import { confirm, toast, toastError } from '../components/feedback';
import { Avatar, BedDot, Button, Chip, EmptyState, Field, Icon, MoneyInput, Pill, Segmented, Sheet, Switch, TextInput } from '../components/ui';

export default function Home() {
  const property = useData(api.getProperty);
  const floors = useData(api.getFloors);
  const s = useData(api.getSummary);
  const [onlyEmpty, setOnlyEmpty] = useState(false);
  const [sheet, setSheet] = useState(null); // { type, ...props }
  const close = () => setSheet(null);

  return (
    <div className="screen home">
      <header className="home-header">
        <button type="button" className="home-title" onClick={() => setSheet({ type: 'property' })}>
          <span className="eyebrow">
            <Icon name="building" size={14} /> Your PG
          </span>
          <h1>{property.name}</h1>
          {property.address && <p>{property.address}</p>}
        </button>
        <button type="button" className="icon-btn on-dark" onClick={() => setSheet({ type: 'menu' })} aria-label="More options">
          <Icon name="more" />
        </button>
      </header>

      <div className="stats">
        <div className="stat">
          <span className="stat-value">{s.totalBeds}</span>
          <span className="stat-label">Total beds</span>
          <span className="stat-sub">{s.occupiedBeds + s.noticeBeds} filled</span>
        </div>
        <button type="button" className={`stat stat-green${onlyEmpty ? ' selected' : ''}`} onClick={() => setOnlyEmpty(!onlyEmpty)}>
          <span className="stat-value">{s.emptyBeds}</span>
          <span className="stat-label">Empty beds</span>
          <span className="stat-sub">{onlyEmpty ? 'Showing only these' : 'Tap to see'}</span>
        </button>
        <button type="button" className={`stat${s.dueThisWeek ? ' stat-warn' : ''}`} onClick={() => navigate('/rent')}>
          <span className="stat-value">{rupees(s.dueThisWeek)}</span>
          <span className="stat-label">Rent due this week</span>
          <span className="stat-sub">{s.overdueCount ? `${s.overdueCount} overdue` : 'None overdue'}</span>
        </button>
      </div>

      <div className="legend-row">
        <span className="legend"><i className="bed-dot empty mini" /> Empty</span>
        <span className="legend"><i className="bed-dot occupied mini" /> Occupied</span>
        <span className="legend"><i className="bed-dot notice mini" /> On notice</span>
        {onlyEmpty && (
          <Chip active onClick={() => setOnlyEmpty(false)}>
            Only empty <Icon name="x" size={14} />
          </Chip>
        )}
      </div>

      {floors.length === 0 && (
        <EmptyState
          icon="layers"
          title="Let's set up your PG"
          text="Start by adding your floors. Then add rooms on each floor."
          action={<Button icon="plus" onClick={() => setSheet({ type: 'floor' })}>Add first floor</Button>}
        />
      )}

      {floors.map((floor) => (
        <FloorSection
          key={floor.id}
          floor={floor}
          onlyEmpty={onlyEmpty}
          onOpenRoom={(roomId) => setSheet({ type: 'room', roomId })}
          onAddRoom={() => setSheet({ type: 'roomForm', floorId: floor.id })}
          onEditFloor={() => setSheet({ type: 'floor', floorId: floor.id })}
        />
      ))}

      {floors.length > 0 && !onlyEmpty && (
        <button type="button" className="add-floor" onClick={() => setSheet({ type: 'floor' })}>
          <Icon name="plus" size={18} /> Add floor
        </button>
      )}

      <button type="button" className="fab" onClick={() => navigate('/add-tenant')}>
        <Icon name="plus" size={22} stroke={2.5} /> Add tenant
      </button>

      {sheet?.type === 'menu' && <MenuSheet onClose={close} onPick={setSheet} />}
      {sheet?.type === 'property' && <PropertySheet onClose={close} />}
      {sheet?.type === 'floor' && <FloorSheet floorId={sheet.floorId} onClose={close} />}
      {sheet?.type === 'room' && (
        <RoomSheet roomId={sheet.roomId} onClose={close} onEdit={() => setSheet({ type: 'roomForm', roomId: sheet.roomId })} />
      )}
      {sheet?.type === 'roomForm' && <RoomFormSheet roomId={sheet.roomId} floorId={sheet.floorId} onClose={close} onSaved={(roomId) => setSheet(roomId ? { type: 'room', roomId } : null)} />}
    </div>
  );
}

function FloorSection({ floor, onlyEmpty, onOpenRoom, onAddRoom, onEditFloor }) {
  const rooms = useData(() => api.getRooms(floor.id));
  const withBeds = rooms.map((room) => ({ room, beds: api.getBeds(room.id) }));
  const empty = withBeds.reduce((n, r) => n + api.countEmpty(r.beds), 0);
  const shown = onlyEmpty ? withBeds.filter((r) => api.countEmpty(r.beds) > 0) : withBeds;
  if (onlyEmpty && shown.length === 0) return null;

  return (
    <section className="floor">
      <div className="floor-head">
        <div>
          <h2>{floor.name}</h2>
          <span className={empty ? 'text-green' : 'muted'}>
            {rooms.length === 0 ? 'No rooms yet' : empty ? `${plural(empty, 'empty bed')}` : 'All beds full'}
          </span>
        </div>
        <button type="button" className="icon-btn" onClick={onEditFloor} aria-label={`Edit ${floor.name}`}>
          <Icon name="edit" size={19} />
        </button>
      </div>
      <div className="room-grid">
        {shown.map(({ room, beds }) => (
          <RoomCard key={room.id} room={room} beds={beds} onClick={() => onOpenRoom(room.id)} />
        ))}
        {!onlyEmpty && (
          <button type="button" className="room-card add" onClick={onAddRoom}>
            <Icon name="plus" size={22} />
            <span>Add room</span>
          </button>
        )}
      </div>
    </section>
  );
}

function RoomCard({ room, beds, onClick }) {
  const empty = api.countEmpty(beds);
  return (
    <button type="button" className={`room-card${empty ? ' has-empty' : ''}`} onClick={onClick}>
      <div className="room-top">
        <span className="room-no">
          <small>Room</small> {room.roomNo}
        </span>
        {room.ac && <span className="tag">AC</span>}
      </div>
      <div className="room-meta">
        {room.sharingType} sharing{room.attachedBath ? ' · Bath' : ''}
      </div>
      <div className="bed-dots">
        {beds.map((b) => (
          <BedDot key={b.id} bed={b} />
        ))}
      </div>
    </button>
  );
}

// ---------- Room details ----------

function RoomSheet({ roomId, onClose, onEdit }) {
  const room = useData(() => api.getRoom(roomId));
  if (!room || room.archived) return null;
  const beds = api.getBeds(roomId);
  const floor = api.getFloor(room.floorId);
  const empty = api.countEmpty(beds);

  return (
    <Sheet
      onClose={onClose}
      title={`Room ${room.roomNo}`}
      subtitle={`${floor?.name} · ${room.sharingType} sharing · ${room.ac ? 'AC' : 'Non-AC'} · ${room.attachedBath ? 'Attached bath' : 'Common bath'}`}
      footer={<Button variant="secondary" block icon="edit" onClick={onEdit}>Edit room</Button>}
    >
      <p className="section-note">{empty ? `${plural(empty, 'bed')} empty` : 'All beds are taken'}</p>
      <ul className="bed-list">
        {beds.map((bed) => (
          <BedRow key={bed.id} bed={bed} />
        ))}
      </ul>
    </Sheet>
  );
}

function BedRow({ bed }) {
  const tenancy = api.getActiveTenancyForBed(bed.id);
  if (!tenancy) {
    return (
      <li className="bed-row">
        <BedDot bed={bed} size="lg" />
        <div className="bed-row-main">
          <strong>Bed {bed.label} is empty</strong>
          <span className="muted">{rupees(bed.rent)} / month</span>
        </div>
        <Button size="sm" icon="plus" onClick={() => navigate(`/add-tenant?bed=${bed.id}`)}>Add tenant</Button>
      </li>
    );
  }
  const tenant = api.getTenant(tenancy.tenantId);
  const rent = api.getTenancyRentState(tenancy.id);
  return (
    <li>
      <button type="button" className="bed-row link" onClick={() => navigate(`/tenant/${tenant.id}`)}>
        <span className="bed-avatar">
          <Avatar name={tenant.name} size={40} />
          <BedDot bed={bed} size="badge" />
        </span>
        <div className="bed-row-main">
          <strong>{tenant.name}</strong>
          <span className="muted">
            Bed {bed.label} · {rupees(tenancy.rent)} / month
          </span>
          <span className="pill-line">
            {tenancy.leavingOn && <Pill tone="orange">Leaving {fmtDate(tenancy.leavingOn)}</Pill>}
            {rent.worst === 'overdue' && <Pill tone="red">Rent overdue</Pill>}
            {rent.worst === 'dueSoon' && <Pill tone="amber">Rent due soon</Pill>}
          </span>
        </div>
        <Icon name="chevronRight" size={20} className="muted" />
      </button>
    </li>
  );
}

// ---------- Add / edit room ----------

function RoomFormSheet({ roomId, floorId, onClose, onSaved }) {
  const existing = roomId ? api.getRoom(roomId) : null;
  const floors = api.getFloors();
  const startFloor = existing?.floorId ?? floorId ?? floors[0]?.id;
  const beds = existing ? api.getBeds(roomId) : [];

  const [form, setForm] = useState(() => ({
    floorId: startFloor,
    roomNo: existing?.roomNo ?? suggestRoomNo(api.getRooms(startFloor).map((r) => r.roomNo), api.getFloor(startFloor)?.order ?? 0),
    sharingType: existing?.sharingType ?? 2,
    ac: existing?.ac ?? false,
    attachedBath: existing?.attachedBath ?? true,
  }));
  const [rent, setRent] = useState(defaultRent(form.sharingType, form.ac));
  const [rentTouched, setRentTouched] = useState(false);
  const [bedRents, setBedRents] = useState(() => Object.fromEntries(beds.map((b) => [b.id, b.rent])));
  const [error, setError] = useState('');

  const set = (patch) => {
    const next = { ...form, ...patch };
    setForm(next);
    setError('');
    if (!rentTouched) setRent(defaultRent(next.sharingType, next.ac));
  };

  const plan = existing
    ? planBedResize(beds, new Set(beds.filter((b) => b.status !== 'empty').map((b) => b.id)), form.sharingType)
    : { removeIds: [], addCount: 0 };
  const addedBeds = plan.addCount ?? 0;
  const removing = new Set(plan.removeIds ?? []);

  async function save() {
    try {
      if (existing) {
        await api.updateRoom(roomId, { ...form, bedRents, newBedRent: rent });
        toast(`Room ${form.roomNo} saved`);
        onSaved(roomId);
      } else {
        const room = await api.addRoom({ ...form, rent });
        toast(`Room ${room.roomNo} added with ${plural(form.sharingType, 'bed')}`);
        onSaved(null);
      }
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: `Delete room ${existing.roomNo}?`,
      message: 'Past tenant records for this room are kept.',
      confirmText: 'Delete room',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteRoom(roomId);
      toast(`Room ${existing.roomNo} deleted`);
      onClose();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <Sheet
      onClose={onClose}
      title={existing ? `Edit room ${existing.roomNo}` : 'Add room'}
      footer={<Button block size="lg" icon="check" onClick={save} disabled={!!plan.error}>{existing ? 'Save room' : 'Add room'}</Button>}
    >
      <div className="form-grid-2">
        <Field label="Room number" htmlFor="roomNo">
          <TextInput id="roomNo" value={form.roomNo} onChange={(e) => set({ roomNo: e.target.value })} autoComplete="off" />
        </Field>
        <Field label="Floor" htmlFor="floor">
          <select id="floor" className="input" value={form.floorId} onChange={(e) => set({ floorId: e.target.value })}>
            {floors.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Sharing">
        <Segmented
          label="Sharing"
          options={SHARING_TYPES.map((n) => ({ value: n, label: `${n} bed${n > 1 ? 's' : ''}` }))}
          value={form.sharingType}
          onChange={(n) => set({ sharingType: n })}
        />
        {plan.error && <p className="form-error inline"><Icon name="alert" size={18} /> {plan.error}</p>}
      </Field>

      <div className="switch-group">
        <Switch label="AC room" checked={form.ac} onChange={(ac) => set({ ac })} />
        <Switch label="Attached bathroom" checked={form.attachedBath} onChange={(attachedBath) => set({ attachedBath })} />
      </div>

      {!existing && (
        <Field label="Rent per bed (monthly)" htmlFor="rent" hint="You can change rent for a single bed later.">
          <MoneyInput id="rent" value={rent} onChange={(v) => { setRent(v); setRentTouched(true); }} />
        </Field>
      )}

      {existing && (
        <Field label="Rent for each bed (monthly)">
          <div className="bed-rent-list">
            {beds.map((b) => (
              <div key={b.id} className={`bed-rent-row${removing.has(b.id) ? ' removing' : ''}`}>
                <BedDot bed={b} />
                {removing.has(b.id) ? (
                  <span className="muted">Bed {b.label} will be removed</span>
                ) : (
                  <MoneyInput value={bedRents[b.id]} onChange={(v) => setBedRents({ ...bedRents, [b.id]: v })} aria-label={`Rent for bed ${b.label}`} />
                )}
              </div>
            ))}
          </div>
          {addedBeds > 0 && (
            <div className="bed-rent-row new">
              <span className="muted small">{plural(addedBeds, 'new bed')} at</span>
              <MoneyInput value={rent} onChange={(v) => { setRent(v); setRentTouched(true); }} aria-label="Rent for new beds" />
            </div>
          )}
        </Field>
      )}

      {error && <p className="form-error"><Icon name="alert" size={18} /> {error}</p>}

      {existing && (
        <button type="button" className="link-btn danger" onClick={remove}>
          <Icon name="trash" size={16} /> Delete this room
        </button>
      )}
    </Sheet>
  );
}

// ---------- Floors ----------

function FloorSheet({ floorId, onClose }) {
  const floors = api.getFloors();
  const existing = floorId ? api.getFloor(floorId) : null;
  const usedNames = new Set(floors.map((f) => f.name));
  const suggestions = FLOOR_NAMES.filter((n) => !usedNames.has(n)).slice(0, 4);
  const [name, setName] = useState(existing?.name ?? suggestions[0] ?? '');
  const [error, setError] = useState('');

  async function save() {
    try {
      if (existing) await api.renameFloor(floorId, name);
      else await api.addFloor(name);
      toast(existing ? 'Floor renamed' : `${name.trim()} added`);
      onClose();
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: `Delete ${existing.name}?`,
      message: 'All rooms on this floor will be removed. Floors with tenants cannot be deleted.',
      confirmText: 'Delete floor',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteFloor(floorId);
      toast(`${existing.name} deleted`);
      onClose();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <Sheet
      onClose={onClose}
      title={existing ? 'Rename floor' : 'Add floor'}
      footer={<Button block size="lg" icon="check" onClick={save}>{existing ? 'Save' : 'Add floor'}</Button>}
    >
      <Field label="Floor name" htmlFor="floorName" error={error}>
        <TextInput id="floorName" value={name} onChange={(e) => { setName(e.target.value); setError(''); }} autoComplete="off" />
      </Field>
      {!existing && suggestions.length > 0 && (
        <div className="chip-row">
          {suggestions.map((n) => (
            <Chip key={n} active={name === n} onClick={() => setName(n)}>{n}</Chip>
          ))}
        </div>
      )}
      {existing && (
        <button type="button" className="link-btn danger" onClick={remove}>
          <Icon name="trash" size={16} /> Delete this floor
        </button>
      )}
    </Sheet>
  );
}

// ---------- PG details & menu ----------

function PropertySheet({ onClose }) {
  const p = api.getProperty();
  const [name, setName] = useState(p.name);
  const [address, setAddress] = useState(p.address);
  const [error, setError] = useState('');

  async function save() {
    try {
      await api.updateProperty({ name, address });
      toast('PG details saved');
      onClose();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <Sheet onClose={onClose} title="PG details" footer={<Button block size="lg" icon="check" onClick={save}>Save</Button>}>
      <Field label="PG name" htmlFor="pgName" error={error}>
        <TextInput id="pgName" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Address" htmlFor="pgAddr" optional>
        <TextInput id="pgAddr" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Area, city" />
      </Field>
    </Sheet>
  );
}

function MenuSheet({ onClose, onPick }) {
  const [fresh, setFresh] = useState(false);
  const [name, setName] = useState('');

  async function reset() {
    const ok = await confirm({
      title: 'Reset demo data?',
      message: 'All changes will be lost and the sample PG will come back.',
      confirmText: 'Reset',
      danger: true,
    });
    if (!ok) return;
    await api.resetDemo();
    onClose();
    toast('Sample PG restored');
  }

  async function startFresh() {
    await api.startFresh(name);
    onClose();
    toast('Empty PG ready. Add your first floor.');
  }

  if (fresh) {
    return (
      <Sheet
        onClose={onClose}
        title="Set up a new PG"
        subtitle="Starts with an empty PG, so you can enter the owner's own floors and rooms."
        footer={<Button block size="lg" icon="check" onClick={startFresh}>Start</Button>}
      >
        <Field label="PG name" htmlFor="freshName">
          <TextInput id="freshName" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lakshmi Ladies PG" autoFocus />
        </Field>
        <p className="field-hint">You can always bring back the sample PG with "Reset demo data".</p>
      </Sheet>
    );
  }

  const Item = ({ icon, label, sub, onClick, danger }) => (
    <button type="button" className={`menu-item${danger ? ' danger' : ''}`} onClick={onClick}>
      <span className="menu-icon"><Icon name={icon} size={20} /></span>
      <span className="menu-text">
        <span>{label}</span>
        {sub && <small>{sub}</small>}
      </span>
      <Icon name="chevronRight" size={18} className="muted" />
    </button>
  );

  return (
    <Sheet onClose={onClose} title="Options">
      <div className="menu">
        <Item icon="building" label="Edit PG name & address" onClick={() => onPick({ type: 'property' })} />
        <Item icon="layers" label="Add floor" onClick={() => onPick({ type: 'floor' })} />
        <Item icon="plus" label="Set up a new PG" sub="Start empty and enter your own rooms" onClick={() => setFresh(true)} />
        <Item icon="refresh" label="Reset demo data" sub="Bring back the sample PG" onClick={reset} danger />
      </div>
    </Sheet>
  );
}
