import { useState } from 'react';
import * as api from '../services/api';
import { useData } from '../services/api';
import { DOC_TYPES } from '../services/logic';
import { fmtDate } from '../lib/dates';
import { rupees } from '../lib/format';
import { navigate } from '../router';
import { Avatar, Chip, EmptyState, Icon, Pill } from '../components/ui';

const FILTERS = [
  { key: 'staying', label: 'Staying' },
  { key: 'docs', label: 'Documents pending' },
  { key: 'notice', label: 'On notice' },
  { key: 'left', label: 'Moved out' },
];

export default function Tenants() {
  const list = useData(api.getTenantList);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('staying');

  const rows = list.map(({ tenant, tenancy }) => ({
    tenant,
    tenancy,
    place: api.getBedPlace(tenancy.bedId),
    rent: api.getTenancyRentState(tenancy.id),
    docsPending: DOC_TYPES.some((d) => !tenant.documents.files[d.key]),
  }));

  const test = {
    staying: (r) => !r.tenancy.moveOut,
    docs: (r) => !r.tenancy.moveOut && r.docsPending,
    notice: (r) => !r.tenancy.moveOut && r.tenancy.leavingOn,
    left: (r) => r.tenancy.moveOut,
  };
  const needle = q.trim().toLowerCase();
  const shown = rows.filter(
    (r) =>
      test[filter](r) &&
      (!needle ||
        r.tenant.name.toLowerCase().includes(needle) ||
        r.tenant.phone.includes(needle) ||
        r.place.short.toLowerCase().includes(needle)),
  );
  const count = (k) => rows.filter(test[k]).length;

  return (
    <div className="screen">
      <header className="page-header">
        <h1>Tenants</h1>
        <p className="muted">{count('staying')} staying now</p>
      </header>

      <div className="search">
        <Icon name="search" size={20} />
        <input type="search" placeholder="Search name, phone or room" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="chip-row scroll filters">
        {FILTERS.map((f) => (
          <Chip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label} <span className="chip-count">{count(f.key)}</span>
          </Chip>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState icon="users" title={needle ? 'No match' : 'No one here'} text={needle ? 'Try a different name or room number.' : null} />
      ) : (
        <ul className="tenant-list">
          {shown.map(({ tenant, tenancy, place, rent, docsPending }) => (
            <li key={tenant.id}>
              <button type="button" className="tenant-row" onClick={() => navigate(`/tenant/${tenant.id}`)}>
                <Avatar name={tenant.name} size={44} />
                <div className="tenant-row-main">
                  <strong>{tenant.name}</strong>
                  <span className="muted">
                    {place.label} · {rupees(tenancy.rent)}
                  </span>
                  <span className="pill-line">
                    {tenancy.moveOut && <Pill tone="grey">Left {fmtDate(tenancy.moveOut)}</Pill>}
                    {!tenancy.moveOut && tenancy.leavingOn && <Pill tone="orange">Leaving {fmtDate(tenancy.leavingOn)}</Pill>}
                    {rent.worst === 'overdue' && <Pill tone="red">Overdue</Pill>}
                    {rent.worst === 'dueSoon' && <Pill tone="amber">Due soon</Pill>}
                    {!tenancy.moveOut && docsPending && <Pill tone="blue">Docs pending</Pill>}
                  </span>
                </div>
                <Icon name="chevronRight" size={20} className="muted" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="fab" onClick={() => navigate('/add-tenant')}>
        <Icon name="plus" size={22} stroke={2.5} /> Add tenant
      </button>
    </div>
  );
}
