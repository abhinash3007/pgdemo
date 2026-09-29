// What a tenant sees after tapping the document link. Mock only: file names are
// recorded, the files themselves are never stored.
import { useRef, useState } from 'react';
import * as api from '../services/api';
import { useData } from '../services/api';
import { DOC_TYPES } from '../services/logic';
import { firstName } from '../lib/format';
import { goBack } from '../router';
import { Button, EmptyState, Icon } from '../components/ui';

export default function TenantUpload({ tenantId }) {
  const tenant = useData(() => api.getTenant(tenantId));
  const property = api.getProperty();
  const [consent, setConsent] = useState(!!tenant?.documents.consentOn);
  const [finished, setFinished] = useState(false);
  const inputs = useRef({});

  const banner = (
    <div className="demo-banner">
      <Icon name="eye" size={16} />
      <span>Preview: what your tenant sees</span>
      <button type="button" onClick={() => goBack(tenant ? `/tenant/${tenantId}` : '/')}>Back to app</button>
    </div>
  );

  if (!tenant) {
    return (
      <div className="upload-page">
        {banner}
        <EmptyState icon="alert" title="This link has expired" />
      </div>
    );
  }

  const files = tenant.documents.files;
  const done = DOC_TYPES.filter((d) => files[d.key]).length;

  async function onPick(key, file) {
    if (!file) return;
    if (!tenant.documents.consentOn) await api.giveDocumentConsent(tenant.id);
    await api.uploadDocument(tenant.id, key, file.name);
  }

  return (
    <div className="upload-page">
      {banner}
      <div className="upload-inner">
        <div className="upload-brand">
          <span className="upload-logo"><Icon name="building" size={22} /></span>
          <div>
            <strong>{property.name}</strong>
            <span>{property.address}</span>
          </div>
        </div>

        {finished ? (
          <div className="success">
            <span className="success-icon"><Icon name="check" size={34} stroke={3} /></span>
            <h2>Thank you, {firstName(tenant.name)}!</h2>
            <p>Your documents have been shared with {property.name}. You can close this page.</p>
          </div>
        ) : (
          <>
            <h1>Hi {firstName(tenant.name)} 👋</h1>
            <p className="muted">Please upload these for your stay records. It takes 2 minutes.</p>

            <label className={`consent${consent ? ' on' : ''}`}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>
                I agree to share these documents with <strong>{property.name}</strong> for stay verification. Only the owner can see
                them, and they are deleted after I move out.
              </span>
            </label>

            <ul className="upload-list">
              {DOC_TYPES.map((d) => {
                const f = files[d.key];
                return (
                  <li key={d.key}>
                    <button
                      type="button"
                      className={`upload-tile${f ? ' done' : ''}`}
                      disabled={!consent}
                      onClick={() => inputs.current[d.key]?.click()}
                    >
                      <span className="upload-icon"><Icon name={f ? 'check' : 'upload'} size={20} stroke={f ? 3 : 2} /></span>
                      <span className="upload-text">
                        <strong>{d.label}</strong>
                        <small>{f ? f.name : 'Tap to take a photo or choose a file'}</small>
                      </span>
                      {f && <span className="muted small">Change</span>}
                    </button>
                    <input
                      ref={(el) => (inputs.current[d.key] = el)}
                      type="file"
                      accept="image/*,.pdf"
                      hidden
                      onChange={(e) => onPick(d.key, e.target.files?.[0])}
                    />
                  </li>
                );
              })}
            </ul>

            <p className="privacy-note">
              <Icon name="lock" size={14} /> Your documents are encrypted and shared only with this PG. Protected under India's DPDP Act.
            </p>

            <Button block size="lg" disabled={!consent || done === 0} onClick={() => setFinished(true)}>
              {done === DOC_TYPES.length ? 'Submit' : `Submit ${done} of ${DOC_TYPES.length}`}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
