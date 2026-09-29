import { useState } from 'react';
import * as api from '../services/api';
import { useData } from '../services/api';
import { DOC_TYPES, MODE_LABEL } from '../services/logic';
import { addDays, durationBetween, fmtDate, fmtMonth, relDays, today } from '../lib/dates';
import { firstName, isValidPhone, phoneDisplay, rupees } from '../lib/format';
import { navigate } from '../router';
import { confirm, toast, toastError } from '../components/feedback';
import { MarkPaidSheet } from '../components/MarkPaidSheet';
import { Avatar, Button, Card, Chip, EmptyState, Field, Icon, MoneyInput, PhoneInput, Pill, Sheet, TextInput, TopBar } from '../components/ui';

export default function TenantProfile({ id }) {
  const tenant = useData(() => api.getTenant(id));
  const [sheet, setSheet] = useState(null);
  const close = () => setSheet(null);

  if (!tenant) {
    return (
      <div className="screen">
        <TopBar title="Tenant" backTo="/tenants" />
        <EmptyState icon="user" title="Tenant not found" text="This record may have been removed after a demo reset." />
      </div>
    );
  }

  const tenancy = api.getCurrentTenancy(id);
  const stays = api.getTenanciesForTenant(id);
  const place = api.getBedPlace(tenancy.bedId);
  const rent = api.getTenancyRentState(tenancy.id);
  const payments = api.getPaymentsForTenant(id);
  const active = !tenancy.moveOut;
  const t = today();

  return (
    <div className="screen profile">
      <TopBar
        title=""
        backTo="/tenants"
        right={
          <button type="button" className="icon-btn" onClick={() => setSheet({ type: 'edit' })} aria-label="Edit details">
            <Icon name="edit" size={20} />
          </button>
        }
      />

      <div className="profile-hero">
        <Avatar name={tenant.name} size={72} />
        <h1>{tenant.name}</h1>
        <p className="muted">{phoneDisplay(tenant.phone)}</p>
        <div className="pill-line center">
          {!active ? (
            <Pill tone="grey">Moved out {fmtDate(tenancy.moveOut)}</Pill>
          ) : tenancy.leavingOn ? (
            <Pill tone="orange" icon="clock">Leaving {fmtDate(tenancy.leavingOn)}</Pill>
          ) : (
            <Pill tone="green">Staying</Pill>
          )}
          {rent.worst === 'overdue' && <Pill tone="red">Rent overdue</Pill>}
        </div>
        <div className="quick-actions">
          <a className="quick-action" href={`tel:+91${tenant.phone}`}>
            <span><Icon name="phone" size={20} /></span>Call
          </a>
          <button type="button" className="quick-action wa" onClick={() => navigate(`/whatsapp?type=reminder&tenant=${id}`)}>
            <span><Icon name="chat" size={20} /></span>WhatsApp
          </button>
          {active && (
            <button type="button" className="quick-action" disabled={!rent.unpaid.length} onClick={() => setSheet({ type: 'pay', item: rent.unpaid[0] })}>
              <span><Icon name="rupee" size={20} /></span>Mark paid
            </button>
          )}
        </div>
      </div>

      <Card>
        <div className="info-grid">
          <Info label="Room" value={place.room ? `${place.room.roomNo} · Bed ${place.bed.label}` : '—'} sub={place.floor?.name} />
          <Info label={active ? 'Staying for' : 'Stayed'} value={durationBetween(tenancy.moveIn, tenancy.moveOut ?? t)} sub={`Since ${fmtDate(tenancy.moveIn, { year: true })}`} />
          <Info label="Rent" value={rupees(tenancy.rent)} sub={active ? `Due on day ${Number(tenancy.moveIn.slice(8))}` : 'per month'} />
          <Info label="Deposit" value={rupees(tenancy.deposit)} sub={tenancy.depositRefund != null ? `Returned ${rupees(tenancy.depositRefund)}` : 'Held by you'} />
        </div>
      </Card>

      {active && (
        <Card title="Rent">
          {rent.items
            .flatMap((i) => i.awaiting)
            .map((p) => (
              <AwaitingPayment key={p.id} payment={p} tenant={tenant} />
            ))}
          {rent.unpaid.length === 0 ? (
            <div className="rent-ok">
              <Icon name="checkCircle" size={22} />
              <div>
                <strong>All rent paid</strong>
                <span className="muted">Next {rupees(tenancy.rent)} due {fmtDate(rent.nextDue)} ({relDays(rent.nextDue, t)})</span>
              </div>
            </div>
          ) : (
            rent.unpaid.map((item) => (
              <div key={item.id} className={`due-line ${item.status}`}>
                <div>
                  <strong>{fmtMonth(item.forMonth, { long: true })} rent · {rupees(item.balance)}</strong>
                  <span>
                    {item.status === 'overdue' ? `Overdue by ${item.daysLate} day${item.daysLate > 1 ? 's' : ''}` : `Due ${relDays(item.dueDate, t)}`}
                    {item.paid > 0 && ` · ${rupees(item.paid)} paid`}
                  </span>
                </div>
                <Button size="sm" onClick={() => setSheet({ type: 'pay', item })}>Mark paid</Button>
              </div>
            ))
          )}
        </Card>
      )}

      <DocumentsCard tenant={tenant} active={active} />

      <Card title="Payment history" action={payments.length > 0 && <span className="muted small">{payments.filter((p) => p.confirmedByOwner).length} payments</span>}>
        {payments.length === 0 ? (
          <p className="muted">No payments yet.</p>
        ) : (
          <ul className="history">
            {payments.map((p) => (
              <li key={p.id} className={p.rejected ? 'rejected' : ''}>
                <div>
                  <strong>{fmtMonth(p.forMonth)} rent</strong>
                  <span className="muted">
                    {fmtDate(p.paidOn)} · {MODE_LABEL[p.mode]}
                    {p.note && ` · ${p.note}`}
                  </span>
                </div>
                <div className="history-amt">
                  <strong>{rupees(p.amount)}</strong>
                  {p.rejected ? <Pill tone="grey">Not received</Pill> : !p.confirmedByOwner && <Pill tone="blue">To confirm</Pill>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Stay history">
        <ul className="timeline">
          {stays.map((s) => {
            const p = api.getBedPlace(s.bedId);
            return (
              <li key={s.id}>
                <strong>{p.label}</strong>
                <span className="muted">
                  {fmtDate(s.moveIn, { year: true })} – {s.moveOut ? fmtDate(s.moveOut, { year: true }) : 'now'} · {rupees(s.rent)}/month
                </span>
                {s.moveOutNote && <span className="muted small">{s.moveOutNote}</span>}
              </li>
            );
          })}
        </ul>
      </Card>

      {active && (
        <div className="profile-actions">
          {tenancy.leavingOn ? (
            <Button
              variant="secondary"
              block
              icon="x"
              onClick={async () => {
                await api.cancelNotice(tenancy.id);
                toast(`${firstName(tenant.name)} is staying`);
              }}
            >
              Cancel notice
            </Button>
          ) : (
            <Button variant="secondary" block icon="clock" onClick={() => setSheet({ type: 'notice' })}>
              Give notice
            </Button>
          )}
          <Button variant="danger-outline" block icon="logout" onClick={() => setSheet({ type: 'moveOut' })}>
            Mark moved out
          </Button>
        </div>
      )}

      {sheet?.type === 'pay' && <MarkPaidSheet item={sheet.item} onClose={close} />}
      {sheet?.type === 'edit' && <EditSheet tenant={tenant} tenancy={tenancy} onClose={close} />}
      {sheet?.type === 'notice' && <NoticeSheet tenant={tenant} tenancy={tenancy} onClose={close} />}
      {sheet?.type === 'moveOut' && <MoveOutSheet tenant={tenant} tenancy={tenancy} balance={rent.balance} onClose={close} />}
    </div>
  );
}

function Info({ label, value, sub }) {
  return (
    <div className="info">
      <span className="info-label">{label}</span>
      <strong>{value}</strong>
      {sub && <span className="muted small">{sub}</span>}
    </div>
  );
}

export function AwaitingPayment({ payment, tenant, showName }) {
  return (
    <div className="awaiting">
      <div className="awaiting-text">
        <Icon name="bell" size={18} />
        <span>
          {showName ? <strong>{tenant.name}</strong> : firstName(tenant.name)} says {fmtMonth(payment.forMonth)} rent of{' '}
          <strong>{rupees(payment.amount)}</strong> was paid by {MODE_LABEL[payment.mode]} on {fmtDate(payment.paidOn)}
          {payment.note && <span className="muted"> · {payment.note}</span>}
        </span>
      </div>
      <div className="awaiting-actions">
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            await api.rejectPayment(payment.id);
            toast('Marked as not received', { tone: 'error' });
          }}
        >
          Not received
        </Button>
        <Button
          size="sm"
          icon="check"
          onClick={async () => {
            await api.confirmPayment(payment.id);
            toast(`${rupees(payment.amount)} confirmed`);
          }}
        >
          Confirm
        </Button>
      </div>
    </div>
  );
}

function DocumentsCard({ tenant, active }) {
  const docs = tenant.documents;
  const uploaded = DOC_TYPES.filter((d) => docs.files[d.key]).length;
  const allDone = uploaded === DOC_TYPES.length;

  return (
    <Card
      title="Documents"
      action={<Pill tone={allDone ? 'green' : 'amber'}>{uploaded} of {DOC_TYPES.length} received</Pill>}
    >
      <ul className="doc-list">
        {DOC_TYPES.map((d) => {
          const f = docs.files[d.key];
          return (
            <li key={d.key} className={f ? 'done' : ''}>
              <span className="doc-icon">
                <Icon name={f ? 'check' : 'file'} size={18} stroke={f ? 3 : 2} />
              </span>
              <span className="doc-name">{d.label}</span>
              <span className="muted small">{f ? `Received ${fmtDate(f.uploadedOn)}` : 'Waiting'}</span>
            </li>
          );
        })}
      </ul>
      {!allDone && active && (
        <div className="doc-actions">
          {docs.linkSentOn && <p className="muted small">Link sent {fmtDate(docs.linkSentOn)}. </p>}
          <Button
            variant="secondary"
            block
            icon="send"
            onClick={async () => {
              await api.sendDocumentLink(tenant.id);
              navigate(`/whatsapp?type=docs&tenant=${tenant.id}`);
            }}
          >
            {docs.linkSentOn ? 'Send link again' : 'Send document link'}
          </Button>
          <button type="button" className="link-btn" onClick={() => navigate(`/upload/${tenant.id}`)}>
            See what {firstName(tenant.name)} sees <Icon name="chevronRight" size={16} />
          </button>
        </div>
      )}
      <p className="privacy-note">
        <Icon name="lock" size={14} /> Only you can see these. They are deleted after the tenant moves out.
      </p>
    </Card>
  );
}

function EditSheet({ tenant, tenancy, onClose }) {
  const [name, setName] = useState(tenant.name);
  const [phone, setPhone] = useState(tenant.phone);
  const [rent, setRent] = useState(tenancy.rent);
  const [deposit, setDeposit] = useState(tenancy.deposit);
  const [error, setError] = useState('');

  async function save() {
    if (!isValidPhone(phone)) return setError('Please enter a 10-digit mobile number');
    try {
      await api.updateTenant(tenant.id, { name, phone });
      await api.updateTenancy(tenancy.id, { rent, deposit });
      toast('Details saved');
      onClose();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <Sheet onClose={onClose} title="Edit details" footer={<Button block size="lg" icon="check" onClick={save}>Save</Button>}>
      <Field label="Name" htmlFor="eName">
        <TextInput id="eName" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Mobile number" htmlFor="ePhone">
        <PhoneInput id="ePhone" value={phone} onChange={setPhone} />
      </Field>
      <div className="form-grid-2">
        <Field label="Monthly rent" htmlFor="eRent">
          <MoneyInput id="eRent" value={rent} onChange={setRent} />
        </Field>
        <Field label="Deposit" htmlFor="eDep">
          <MoneyInput id="eDep" value={deposit} onChange={setDeposit} />
        </Field>
      </div>
      {error && <p className="form-error"><Icon name="alert" size={18} /> {error}</p>}
    </Sheet>
  );
}

function NoticeSheet({ tenant, tenancy, onClose }) {
  const t = today();
  const [date, setDate] = useState(addDays(t, 30));
  async function save() {
    await api.giveNotice(tenancy.id, date);
    toast(`${firstName(tenant.name)} is leaving on ${fmtDate(date)}`);
    onClose();
  }
  return (
    <Sheet
      onClose={onClose}
      title={`When is ${firstName(tenant.name)} leaving?`}
      subtitle="The bed will show orange so you know it will be free soon."
      footer={<Button block size="lg" icon="check" onClick={save}>Save notice</Button>}
    >
      <div className="chip-row">
        {[7, 15, 30].map((n) => (
          <Chip key={n} active={date === addDays(t, n)} onClick={() => setDate(addDays(t, n))}>In {n} days</Chip>
        ))}
      </div>
      <Field label="Leaving on" htmlFor="leave">
        <input id="leave" type="date" className="input" value={date} min={t} onChange={(e) => e.target.value && setDate(e.target.value)} />
      </Field>
    </Sheet>
  );
}

function MoveOutSheet({ tenant, tenancy, balance, onClose }) {
  const t = today();
  const [date, setDate] = useState(tenancy.leavingOn && tenancy.leavingOn <= t ? tenancy.leavingOn : t);
  const [refund, setRefund] = useState(Math.max(0, tenancy.deposit - balance));
  const [note, setNote] = useState(balance ? `${rupees(Math.min(balance, tenancy.deposit))} adjusted against pending rent` : '');

  async function save() {
    const ok = await confirm({
      title: `Mark ${firstName(tenant.name)} as moved out?`,
      message: 'The bed becomes empty. Their records stay in history.',
      confirmText: 'Yes, moved out',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.moveOut(tenancy.id, { date, depositRefund: refund, note });
      toast(`${api.getBedPlace(tenancy.bedId).label} is now empty`);
      onClose();
    } catch (e) {
      toastError(e);
    }
  }

  return (
    <Sheet
      onClose={onClose}
      title="Move out"
      subtitle={`${tenant.name} · ${api.getBedPlace(tenancy.bedId).label}`}
      footer={<Button variant="danger" block size="lg" icon="logout" onClick={save}>Mark moved out</Button>}
    >
      <Field label="Moved out on" htmlFor="mo">
        <input id="mo" type="date" className="input" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
      </Field>
      <div className="due-banner compact">
        <div>
          <span className="muted">Deposit held</span>
          <strong>{rupees(tenancy.deposit)}</strong>
        </div>
        <div>
          <span className="muted">Rent pending</span>
          <strong className={balance ? 'text-red' : ''}>{rupees(balance)}</strong>
        </div>
      </div>
      <Field label="Deposit returned" htmlFor="refund">
        <MoneyInput id="refund" value={refund} onChange={setRefund} />
      </Field>
      <Field label="Note" htmlFor="moNote" optional>
        <TextInput id="moNote" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. ₹500 kept for damage" />
      </Field>
    </Sheet>
  );
}
