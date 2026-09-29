import { useState } from 'react';
import * as api from '../services/api';
import { PAYMENT_MODES } from '../services/logic';
import { addDays, fmtDate, fmtMonth, today } from '../lib/dates';
import { firstName, rupees } from '../lib/format';
import { navigate } from '../router';
import { toast, toastError } from './feedback';
import { Button, Chip, Field, MoneyInput, Segmented, Sheet, TextInput } from './ui';

/** Record money received for one rent month. Partial amounts are fine. */
export function MarkPaidSheet({ item, onClose }) {
  const tenant = api.getTenant(item.tenantId);
  const place = api.getBedPlace(item.bedId);
  const [amount, setAmount] = useState(item.balance);
  const [mode, setMode] = useState('cash');
  const [paidOn, setPaidOn] = useState(today());
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [saving, setSaving] = useState(false);

  const isPartial = amount > 0 && amount < item.balance;
  const t = today();

  async function save() {
    setSaving(true);
    try {
      const p = await api.markPaid({ tenancyId: item.tenancyId, forMonth: item.forMonth, amount, mode, paidOn, note });
      onClose();
      toast(`${rupees(amount)} received from ${firstName(tenant.name)}`, {
        actions: [
          { label: 'Undo', onClick: () => api.deletePayment(p.id).then(() => toast('Payment removed')) },
          { label: 'Send receipt', onClick: () => navigate(`/whatsapp?type=receipt&tenant=${tenant.id}&payment=${p.id}`) },
        ],
        duration: 7000,
      });
    } catch (e) {
      toastError(e);
      setSaving(false);
    }
  }

  return (
    <Sheet
      onClose={onClose}
      title="Mark rent paid"
      subtitle={`${tenant.name} · ${place.label}`}
      footer={
        <Button block size="lg" icon="check" onClick={save} disabled={saving || !amount}>
          {isPartial ? `Save part payment ${rupees(amount)}` : `Save ${rupees(amount)}`}
        </Button>
      }
    >
      <div className="due-banner">
        <div>
          <span className="muted">{fmtMonth(item.forMonth, { long: true })} rent</span>
          <strong>{rupees(item.balance)} to collect</strong>
        </div>
        {item.paid > 0 && <span className="muted small">Already paid {rupees(item.paid)} of {rupees(item.rent)}</span>}
      </div>

      <Field label="Amount received" htmlFor="amt" hint={isPartial ? `Part payment. ${rupees(item.balance - amount)} will still be due.` : null}>
        <MoneyInput id="amt" value={amount} onChange={setAmount} className="input input-lg has-prefix" />
        <div className="chip-row">
          <Chip active={amount === item.balance} onClick={() => setAmount(item.balance)}>Full {rupees(item.balance)}</Chip>
          {item.balance >= 1000 && (
            <Chip active={amount === Math.round(item.balance / 2)} onClick={() => setAmount(Math.round(item.balance / 2))}>
              Half {rupees(Math.round(item.balance / 2))}
            </Chip>
          )}
        </div>
      </Field>

      <Field label="How did they pay?">
        <Segmented label="Payment mode" options={PAYMENT_MODES} value={mode} onChange={setMode} />
      </Field>

      <Field label="Received on" htmlFor="paidOn">
        <div className="chip-row">
          <Chip active={paidOn === t} onClick={() => setPaidOn(t)}>Today</Chip>
          <Chip active={paidOn === addDays(t, -1)} onClick={() => setPaidOn(addDays(t, -1))}>Yesterday</Chip>
          <input id="paidOn" type="date" className="input input-date" value={paidOn} max={t} onChange={(e) => e.target.value && setPaidOn(e.target.value)} aria-label="Pick date" />
        </div>
        {paidOn !== t && paidOn !== addDays(t, -1) && <p className="field-hint">{fmtDate(paidOn, { year: true })}</p>}
      </Field>

      {showNote ? (
        <Field label="Note" htmlFor="note" optional>
          <TextInput id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. rest by 15th" autoFocus />
        </Field>
      ) : (
        <button type="button" className="link-btn" onClick={() => setShowNote(true)}>+ Add a note</button>
      )}
    </Sheet>
  );
}
