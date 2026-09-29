// Toasts and confirm dialogs, callable from anywhere: toast('Saved'), await confirm({...})
import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

function createSignal(initial) {
  let value = initial;
  const listeners = new Set();
  return {
    get: () => value,
    set: (v) => {
      value = v;
      listeners.forEach((l) => l());
    },
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

const toastSignal = createSignal(null);
let toastTimer;

/** toast('Saved', { tone: 'success', actions: [{ label: 'Undo', onClick }] }) */
export function toast(message, { tone = 'success', actions = [], duration = 4500 } = {}) {
  clearTimeout(toastTimer);
  toastSignal.set({ id: Date.now(), message, tone, actions });
  toastTimer = setTimeout(() => toastSignal.set(null), duration);
}

export const toastError = (err) => toast(err?.message || String(err), { tone: 'error' });

export function ToastHost() {
  const t = useSyncExternalStore(toastSignal.subscribe, toastSignal.get);
  if (!t) return null;
  return createPortal(
    <div className={`toast toast-${t.tone}`} role="status" key={t.id}>
      <Icon name={t.tone === 'error' ? 'alert' : 'checkCircle'} size={20} />
      <span className="toast-msg">{t.message}</span>
      {t.actions.map((a) => (
        <button
          key={a.label}
          type="button"
          className="toast-action"
          onClick={() => {
            toastSignal.set(null);
            a.onClick();
          }}
        >
          {a.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}

const confirmSignal = createSignal(null);

export function confirm({ title, message, confirmText = 'Yes', cancelText = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    confirmSignal.set({ title, message, confirmText, cancelText, danger, resolve });
  });
}

export function ConfirmHost() {
  const c = useSyncExternalStore(confirmSignal.subscribe, confirmSignal.get);
  const [busy, setBusy] = useState(false);
  useEffect(() => setBusy(false), [c]);
  if (!c) return null;
  const close = (answer) => {
    if (busy) return;
    setBusy(true);
    confirmSignal.set(null);
    c.resolve(answer);
  };
  return createPortal(
    <div className="dialog-backdrop" onClick={() => close(false)}>
      <div className="dialog" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>{c.title}</h2>
        {c.message && <p>{c.message}</p>}
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={() => close(false)}>
            {c.cancelText}
          </button>
          <button type="button" className={`btn ${c.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)} autoFocus>
            {c.confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
