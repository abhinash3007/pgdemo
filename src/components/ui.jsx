import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { goBack } from '../router';
import { initials } from '../lib/format';
import { Icon } from './Icon';

export { Icon };

let scrollLocks = 0;
function lockScroll() {
  if (scrollLocks++ === 0) document.body.classList.add('no-scroll');
}
function unlockScroll() {
  if (--scrollLocks === 0) document.body.classList.remove('no-scroll');
}

export function Sheet({ onClose, title, subtitle, children, footer }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    lockScroll();
    const onKey = (e) => e.key === 'Escape' && closeRef.current?.();
    document.addEventListener('keydown', onKey);
    return () => {
      unlockScroll();
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return createPortal(
    <div className="sheet-backdrop" onClick={() => closeRef.current?.()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        {title && (
          <div className="sheet-header">
            <div>
              <h2>{title}</h2>
              {subtitle && <p className="muted">{subtitle}</p>}
            </div>
            <button type="button" className="icon-btn" onClick={() => closeRef.current?.()} aria-label="Close">
              <Icon name="x" />
            </button>
          </div>
        )}
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Button({ variant = 'primary', size, icon, block, children, className = '', ...rest }) {
  const cls = ['btn', `btn-${variant}`, size && `btn-${size}`, block && 'btn-block', className].filter(Boolean).join(' ');
  return (
    <button type="button" className={cls} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 17 : 20} />}
      {children != null && <span>{children}</span>}
    </button>
  );
}

export function TopBar({ title, subtitle, onBack, backTo = '/', right }) {
  return (
    <header className="topbar">
      <button type="button" className="icon-btn" onClick={onBack ?? (() => goBack(backTo))} aria-label="Back">
        <Icon name="arrowLeft" />
      </button>
      <div className="topbar-title">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="topbar-right">{right}</div>
    </header>
  );
}

export function Field({ label, htmlFor, hint, error, children, optional }) {
  return (
    <div className="field">
      {label && (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
          {optional && <span className="field-optional"> (optional)</span>}
        </label>
      )}
      {children}
      {error ? <p className="field-error">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

export function TextInput({ className = '', ...rest }) {
  return <input className={`input ${className}`} {...rest} />;
}

export function MoneyInput({ value, onChange, id, ...rest }) {
  return (
    <div className="input-wrap">
      <span className="input-prefix">₹</span>
      <input
        id={id}
        className="input has-prefix"
        inputMode="numeric"
        autoComplete="off"
        value={value ? Number(value).toLocaleString('en-IN') : ''}
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/\D/g, ''), 10);
          onChange(Number.isNaN(n) ? 0 : Math.min(n, 9999999));
        }}
        {...rest}
      />
    </div>
  );
}

export function PhoneInput({ value, onChange, id, ...rest }) {
  return (
    <div className="input-wrap">
      <span className="input-prefix">+91</span>
      <input
        id={id}
        className="input has-prefix wide-prefix"
        type="tel"
        inputMode="numeric"
        autoComplete="off"
        placeholder="10-digit mobile number"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(-10))}
        {...rest}
      />
    </div>
  );
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.icon && <Icon name={o.icon} size={18} />}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Chip({ active, disabled, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      className={`chip${active ? ' active' : ''} ${className}`}
      disabled={disabled}
      aria-pressed={!!active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function Switch({ label, sublabel, checked, onChange }) {
  return (
    <button type="button" className="switch-row" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
      <span className="switch-text">
        <span>{label}</span>
        {sublabel && <small>{sublabel}</small>}
      </span>
      <span className={`switch${checked ? ' on' : ''}`} />
    </button>
  );
}

export function Pill({ tone = 'grey', children, icon }) {
  return (
    <span className={`pill pill-${tone}`}>
      {icon && <Icon name={icon} size={13} stroke={2.5} />}
      {children}
    </span>
  );
}

const AVATAR_TONES = ['#4338CA', '#0E7490', '#B45309', '#7C3AED', '#BE185D', '#15803D', '#1D4ED8', '#9A3412'];

export function Avatar({ name, size = 44 }) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const bg = AVATAR_TONES[h % AVATAR_TONES.length];
  return (
    <span className="avatar" style={{ width: size, height: size, background: bg, fontSize: size * 0.38 }}>
      {initials(name)}
    </span>
  );
}

export function Card({ title, action, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="card-head">
          <h3>{title}</h3>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ icon = 'info', title, text, action }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={28} />
      </span>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function BedDot({ bed, size }) {
  const title = { empty: 'Empty', occupied: 'Occupied', notice: 'On notice' }[bed.status];
  return (
    <span className={`bed-dot ${bed.status}${size ? ' ' + size : ''}`} title={`Bed ${bed.label}: ${title}`}>
      {bed.label}
    </span>
  );
}
