import { Fragment, useState } from 'react';
import * as api from '../services/api';
import { useData } from '../services/api';
import { DOC_TYPES, MODE_LABEL } from '../services/logic';
import { fmtDate, fmtMonth, relDays, timeNow, today } from '../lib/dates';
import { firstName, plural, rupees } from '../lib/format';
import { navigate } from '../router';
import { toast } from '../components/feedback';
import { Chip, Icon, Segmented } from '../components/ui';

const TYPES = [
  { value: 'reminder', label: 'Rent reminder' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'docs', label: 'Document link' },
];

export default function WhatsApp({ query }) {
  const property = useData(api.getProperty);
  const staying = useData(() => api.getTenantList().filter((x) => !x.tenancy.moveOut));
  const items = useData(api.getRentItems);

  const defaultTenant = query.get('tenant') || items.find((i) => i.status !== 'paid')?.tenantId || staying[0]?.tenant.id;
  const [view, setView] = useState(query.get('view') || 'tenant');
  const [type, setType] = useState(query.get('type') || 'reminder');
  const [tenantId, setTenantId] = useState(defaultTenant);
  const paymentId = query.get('payment');

  const entry = staying.find((x) => x.tenant.id === tenantId) ?? staying[0];

  return (
    <div className="screen">
      <header className="page-header">
        <h1>WhatsApp messages</h1>
        <p className="muted">Sent automatically. Here is what people receive.</p>
      </header>

      <Segmented
        label="Whose phone"
        value={view}
        onChange={setView}
        options={[
          { value: 'tenant', label: 'Tenant gets', icon: 'user' },
          { value: 'owner', label: 'You get', icon: 'building' },
        ]}
      />

      {view === 'tenant' && (
        <div className="wa-controls">
          <div className="chip-row scroll">
            {TYPES.map((t) => (
              <Chip key={t.value} active={type === t.value} onClick={() => setType(t.value)}>{t.label}</Chip>
            ))}
          </div>
          {staying.length > 0 && (
            <label className="select-wrap">
              <span className="muted small">To</span>
              <select className="input" value={entry?.tenant.id} onChange={(e) => setTenantId(e.target.value)}>
                {staying.map(({ tenant, tenancy }) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name} · {api.getBedPlace(tenancy.bedId).short}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      <Phone
        title={view === 'tenant' ? property.name : 'My PG app'}
        subtitle={view === 'tenant' ? 'Business account' : 'Alerts for you'}
      >
        {view === 'tenant' ? (
          entry ? (
            <TenantMessages type={type} entry={entry} property={property} paymentId={type === 'receipt' ? paymentId : null} onReported={() => setView('owner')} />
          ) : (
            <p className="wa-system">Add a tenant to preview messages</p>
          )
        ) : (
          <OwnerMessages property={property} />
        )}
      </Phone>

      <p className="wa-footnote">
        <Icon name="info" size={15} /> Demo preview. In the real app these go out from your PG's WhatsApp number. Tenants can pay by cash or UPI, whatever you prefer.
      </p>
    </div>
  );
}

function Phone({ title, subtitle, children }) {
  return (
    <div className="wa-phone">
      <div className="wa-header">
        <Icon name="arrowLeft" size={20} />
        <span className="wa-avatar">
          <Icon name="building" size={18} />
        </span>
        <div className="wa-title">
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
        <Icon name="video" size={20} />
        <Icon name="phone" size={18} />
      </div>
      <div className="wa-chat">
        <span className="wa-day">Today</span>
        {children}
      </div>
    </div>
  );
}

/** Renders *bold* like WhatsApp does, and makes the demo link tappable. */
function RichText({ text, onLink }) {
  return text.split('\n').map((line, li) => (
    <Fragment key={li}>
      {li > 0 && <br />}
      {line.split(/(\*[^*]+\*|\[link:[^\]]+\])/).map((part, i) => {
        if (/^\*[^*]+\*$/.test(part)) return <strong key={i}>{part.slice(1, -1)}</strong>;
        const m = part.match(/^\[link:([^\]]+)\]$/);
        if (m) return <a key={i} className="wa-link" onClick={onLink} role="link" tabIndex={0}>{m[1]}</a>;
        return part;
      })}
    </Fragment>
  ));
}

function Bubble({ text, buttons = [], onLink }) {
  return (
    <div className="wa-msg">
      <div className="wa-bubble">
        <RichText text={text} onLink={onLink} />
        <span className="wa-time">{timeNow()}</span>
      </div>
      {buttons.length > 0 && (
        <div className="wa-buttons">
          {buttons.map((b) => (
            <button key={b.label} type="button" onClick={b.onClick}>
              {b.icon && <Icon name={b.icon} size={16} />} {b.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TenantMessages({ type, entry, property, paymentId, onReported }) {
  const { tenant, tenancy } = entry;
  const place = api.getBedPlace(tenancy.bedId);
  const name = firstName(tenant.name);
  const t = today();

  if (type === 'reminder') {
    const rent = api.getTenancyRentState(tenancy.id);
    const item = rent.unpaid[0];
    let text;
    if (item) {
      const when =
        item.status === 'overdue'
          ? `was due on *${fmtDate(item.dueDate)}* (${item.daysLate} day${item.daysLate > 1 ? 's' : ''} ago)`
          : `is due *${relDays(item.dueDate, t)}* (${fmtDate(item.dueDate)})`;
      text =
        `🏠 *${property.name}*\n\nHi ${name}, a gentle reminder 🙏\nYour *${fmtMonth(item.forMonth, { long: true })}* rent ${when}.\n\n` +
        `${place.label}\n` +
        (item.paid > 0 ? `Paid so far: ${rupees(item.paid)}\nBalance: *${rupees(item.balance)}*` : `Amount: *${rupees(item.balance)}*`) +
        (rent.unpaid.length > 1 ? `\n\nTotal pending (${rent.unpaid.length} months): *${rupees(rent.balance)}*` : '') +
        `\n\nPay by cash or UPI to the owner. Already paid? Tap below.`;
    } else {
      text =
        `🏠 *${property.name}*\n\nHi ${name} 👋\nYour next rent of *${rupees(tenancy.rent)}* is due on *${fmtDate(rent.nextDue)}*.\n\n${place.label}\n\nThank you for paying on time! 🙏`;
    }
    return (
      <Bubble
        text={text}
        buttons={[
          {
            label: "I've paid",
            icon: 'check',
            onClick: async () => {
              if (!item) return toast('Nothing is due right now');
              if (item.awaiting.length) return toast('Already reported. Waiting for the owner.');
              await api.reportPayment({ tenancyId: tenancy.id, forMonth: item.forMonth, amount: item.balance, mode: 'upi' });
              toast('Owner has been asked to confirm');
              onReported();
            },
          },
          { label: 'Call owner', icon: 'phone', onClick: () => toast('Opens a call to the owner') },
        ]}
      />
    );
  }

  if (type === 'receipt') {
    const payments = api.getPaymentsForTenancy(tenancy.id).filter((p) => p.confirmedByOwner && !p.rejected);
    const p = payments.find((x) => x.id === paymentId) ?? payments[0];
    if (!p) return <p className="wa-system">No payments recorded for {name} yet</p>;
    const monthPaid = payments.filter((x) => x.forMonth === p.forMonth).reduce((s, x) => s + x.amount, 0);
    const bal = Math.max(0, tenancy.rent - monthPaid);
    const text =
      `✅ *Payment received*\n\nHi ${name}, we have received your rent. Thank you! 🙏\n\n` +
      `Amount: *${rupees(p.amount)}*\nFor: ${fmtMonth(p.forMonth, { long: true, year: true })}\nPaid by: ${MODE_LABEL[p.mode]}\nDate: ${fmtDate(p.paidOn, { year: true })}\n${place.label}\n` +
      `Receipt no: ${p.id.slice(-6).toUpperCase()}\n\n` +
      (bal ? `Balance for ${fmtMonth(p.forMonth)}: *${rupees(bal)}*` : `${fmtMonth(p.forMonth)} rent fully paid ✔️`) +
      `\n\n— ${property.name}`;
    return <Bubble text={text} />;
  }

  // Document link
  const link = `mypg.in/u/${tenant.id.slice(-5)}`;
  const text =
    `Welcome to *${property.name}*, ${name}! 🎉\n\nPlease upload your documents for our stay records:\n` +
    DOC_TYPES.map((d) => `• ${d.label}`).join('\n') +
    `\n\n🔒 Only the PG owner can see these. They are deleted after you move out.\n\n👉 [link:${link}]`;
  return (
    <>
      <Bubble text={text} onLink={() => navigate(`/upload/${tenant.id}`)} />
      <p className="wa-system tap-hint">Tap the link to see the tenant's upload page</p>
    </>
  );
}

function OwnerMessages({ property }) {
  const s = api.getSummary();
  const items = api.getRentItems();
  const overdue = items.filter((i) => i.status === 'overdue');
  const leaving = api.getTenantList().filter((x) => !x.tenancy.moveOut && x.tenancy.leavingOn);
  const awaiting = api.getPaymentsAwaitingConfirmation();

  const who = (tenantId, bedId) => `${api.getTenant(tenantId).name} (${api.getBedPlace(bedId).short})`;

  const summary =
    `☀️ Good morning! Today at *${property.name}*:\n\n` +
    `🛏 ${plural(s.emptyBeds, 'bed')} empty (of ${s.totalBeds})\n` +
    `⏰ ${plural(s.dueThisWeekCount, 'rent')} to collect this week: *${rupees(s.dueThisWeek)}*\n` +
    (overdue.length
      ? `🔴 ${overdue.length} overdue:\n` +
        overdue.slice(0, 4).map((i) => `   • ${who(i.tenantId, i.bedId)} ${rupees(i.balance)}`).join('\n') +
        (overdue.length > 4 ? `\n   • and ${overdue.length - 4} more` : '') +
        '\n'
      : '✅ No overdue rent\n') +
    (leaving.length
      ? `🚪 Leaving soon: ${leaving.map((x) => `${firstName(x.tenant.name)} (${fmtDate(x.tenancy.leavingOn)})`).join(', ')}\n`
      : '') +
    `\nOpen the app to send reminders.`;

  const latestDoc = api
    .getTenantList()
    .flatMap(({ tenant }) =>
      DOC_TYPES.filter((d) => tenant.documents.files[d.key]).map((d) => ({ tenant, doc: d, on: tenant.documents.files[d.key].uploadedOn })),
    )
    .sort((a, b) => b.on.localeCompare(a.on))[0];

  return (
    <>
      <Bubble text={summary} buttons={[{ label: 'Open rent list', icon: 'rupee', onClick: () => navigate('/rent') }]} />
      {awaiting.slice(0, 3).map((p) => {
        const tenancy = api.getTenancy(p.tenancyId);
        return (
          <Bubble
            key={p.id}
            text={`💰 *${who(tenancy.tenantId, tenancy.bedId)}* says ${fmtMonth(p.forMonth)} rent of *${rupees(p.amount)}* is paid by ${MODE_LABEL[p.mode]}.\n\nDid you receive it?`}
            buttons={[
              {
                label: 'Yes, received',
                icon: 'check',
                onClick: async () => {
                  await api.confirmPayment(p.id);
                  toast(`${rupees(p.amount)} confirmed. Receipt sent to ${firstName(api.getTenant(tenancy.tenantId).name)}.`);
                },
              },
              {
                label: 'Not received',
                icon: 'x',
                onClick: async () => {
                  await api.rejectPayment(p.id);
                  toast('Marked as not received', { tone: 'error' });
                },
              },
            ]}
          />
        );
      })}
      {latestDoc && (
        <Bubble
          text={`📄 *${latestDoc.tenant.name}* uploaded ${latestDoc.doc.label} on ${fmtDate(latestDoc.on)}.`}
          buttons={[{ label: 'View profile', icon: 'user', onClick: () => navigate(`/tenant/${latestDoc.tenant.id}`) }]}
        />
      )}
    </>
  );
}

