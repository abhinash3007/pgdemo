import { useState } from 'react';
import * as api from '../services/api';
import { useData } from '../services/api';
import { MODE_LABEL } from '../services/logic';
import { fmtDate, fmtMonth, monthKey, relDays, today } from '../lib/dates';
import { rupees } from '../lib/format';
import { navigate } from '../router';
import { MarkPaidSheet } from '../components/MarkPaidSheet';
import { Avatar, Button, EmptyState, Icon, Segmented } from '../components/ui';
import { AwaitingPayment } from './TenantProfile';

export default function Rent({ query }) {
  const items = useData(api.getRentItems);
  const s = useData(api.getSummary);
  const awaiting = useData(api.getPaymentsAwaitingConfirmation);
  const counts = {
    overdue: items.filter((i) => i.status === 'overdue').length,
    dueSoon: items.filter((i) => i.status === 'dueSoon').length,
    paid: items.filter((i) => i.status === 'paid').length,
  };
  const [tab, setTab] = useState(() => query.get('tab') || (counts.overdue ? 'overdue' : counts.dueSoon ? 'dueSoon' : 'paid'));
  const [paying, setPaying] = useState(null);
  const shown = items.filter((i) => i.status === tab);

  return (
    <div className="screen">
      <header className="page-header">
        <h1>Rent</h1>
        <p className="muted">{fmtMonth(monthKey(today()), { long: true, year: true })}</p>
      </header>

      <div className="money-strip">
        <div>
          <span className="muted">Collected this month</span>
          <strong className="text-green">{rupees(s.collectedThisMonth)}</strong>
        </div>
        <div>
          <span className="muted">To collect this week</span>
          <strong className={s.dueThisWeek ? 'text-red' : ''}>{rupees(s.dueThisWeek)}</strong>
        </div>
      </div>

      {awaiting.length > 0 && (
        <section className="confirm-box">
          <h2>
            <Icon name="bell" size={18} /> Please confirm ({awaiting.length})
          </h2>
          {awaiting.map((p) => {
            const tenancy = api.getTenancy(p.tenancyId);
            return <AwaitingPayment key={p.id} payment={p} tenant={api.getTenant(tenancy.tenantId)} showName />;
          })}
        </section>
      )}

      <div className="tabs-sticky">
        <Segmented
          label="Filter"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'overdue', label: `Overdue ${counts.overdue}` },
            { value: 'dueSoon', label: `Due soon ${counts.dueSoon}` },
            { value: 'paid', label: `Paid ${counts.paid}` },
          ]}
        />
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={tab === 'paid' ? 'rupee' : 'checkCircle'}
          title={tab === 'overdue' ? 'Nothing overdue' : tab === 'dueSoon' ? 'Nothing due this week' : 'No payments yet'}
          text={tab === 'overdue' ? 'Everyone has paid on time. 🎉' : null}
        />
      ) : (
        <ul className="rent-list">
          {shown.map((item) => (
            <RentRow key={item.id} item={item} onPay={() => setPaying(item)} />
          ))}
        </ul>
      )}

      {paying && <MarkPaidSheet item={paying} onClose={() => setPaying(null)} />}
    </div>
  );
}

function RentRow({ item, onPay }) {
  const tenant = api.getTenant(item.tenantId);
  const place = api.getBedPlace(item.bedId);
  const t = today();

  let statusText;
  if (item.status === 'overdue') statusText = `${item.daysLate} day${item.daysLate > 1 ? 's' : ''} late`;
  else if (item.status === 'dueSoon') statusText = `Due ${relDays(item.dueDate, t)}`;
  else statusText = `Paid ${fmtDate(item.lastPayment?.paidOn)} · ${MODE_LABEL[item.lastPayment?.mode] ?? ''}`;

  return (
    <li className={`rent-row ${item.status}`}>
      <button type="button" className="rent-row-main" onClick={() => navigate(`/tenant/${tenant.id}`)}>
        <Avatar name={tenant.name} size={42} />
        <div className="rent-row-text">
          <strong>{tenant.name}</strong>
          <span className="muted">
            {place.short} · {fmtMonth(item.forMonth)} rent
          </span>
          <span className={`rent-status ${item.status}`}>
            {statusText}
            {item.status !== 'paid' && item.paid > 0 && ` · ${rupees(item.paid)} of ${rupees(item.rent)} paid`}
            {item.awaiting.length > 0 && ' · says paid'}
          </span>
        </div>
        <div className="rent-amt">
          <strong>{rupees(item.status === 'paid' ? item.paid : item.balance)}</strong>
          {item.status !== 'paid' && item.paid > 0 && <span className="muted small">balance</span>}
        </div>
      </button>
      <div className="rent-row-actions">
        {item.status === 'paid' ? (
          <Button
            size="sm"
            variant="ghost"
            icon="chat"
            onClick={() => navigate(`/whatsapp?type=receipt&tenant=${tenant.id}&payment=${item.lastPayment?.id ?? ''}`)}
          >
            Send receipt
          </Button>
        ) : (
          <>
            <Button size="sm" variant="ghost" icon="chat" onClick={() => navigate(`/whatsapp?type=reminder&tenant=${tenant.id}`)}>
              Remind
            </Button>
            <Button size="sm" icon="check" onClick={onPay}>
              Mark paid
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
