import { Component } from 'react';
import { useRoute, navigate } from './router';
import * as api from './services/api';
import { useData } from './services/api';
import { ConfirmHost, ToastHost } from './components/feedback';
import { Icon } from './components/ui';
import Home from './screens/Home';
import Rent from './screens/Rent';
import Tenants from './screens/Tenants';
import WhatsApp from './screens/WhatsApp';
import AddTenant from './screens/AddTenant';
import TenantProfile from './screens/TenantProfile';
import TenantUpload from './screens/TenantUpload';

const TABS = [
  { path: '/', key: '', label: 'My PG', icon: 'home' },
  { path: '/rent', key: 'rent', label: 'Rent', icon: 'rupee' },
  { path: '/tenants', key: 'tenants', label: 'Tenants', icon: 'users' },
  { path: '/whatsapp', key: 'whatsapp', label: 'WhatsApp', icon: 'chat' },
];

export default function App() {
  const route = useRoute();
  const [section = '', id] = route.segments;
  const key = route.path + '?' + route.query.toString();

  let screen;
  let nav = true;
  switch (section) {
    case '':
      screen = <Home />;
      break;
    case 'rent':
      screen = <Rent key={key} query={route.query} />;
      break;
    case 'tenants':
      screen = <Tenants />;
      break;
    case 'whatsapp':
      screen = <WhatsApp key={key} query={route.query} />;
      break;
    case 'add-tenant':
      screen = <AddTenant key={key} query={route.query} />;
      nav = false;
      break;
    case 'tenant':
      screen = <TenantProfile key={id} id={id} />;
      break;
    case 'upload':
      screen = <TenantUpload key={id} tenantId={id} />;
      nav = false;
      break;
    default:
      screen = <Home />;
  }

  return (
    <ErrorBoundary>
      <div className={`app${nav ? ' has-nav' : ''}`}>
        {screen}
        {nav && <BottomNav active={section === 'tenant' ? 'tenants' : section} />}
      </div>
      <ToastHost />
      <ConfirmHost />
    </ErrorBoundary>
  );
}

function BottomNav({ active }) {
  const s = useData(api.getSummary);
  const badges = { rent: s.overdueCount + s.awaitingConfirmation };
  return (
    <nav className="bottom-nav">
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          className={active === t.key ? 'active' : ''}
          aria-current={active === t.key ? 'page' : undefined}
          onClick={() => active !== t.key && navigate(t.path)}
        >
          <span className="nav-icon">
            <Icon name={t.icon} size={23} />
            {badges[t.key] > 0 && <span className="nav-badge">{badges[t.key]}</span>}
          </span>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

/** If saved data ever breaks a screen mid-demo, offer a one-tap recovery. */
class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="app">
        <div className="empty-state" style={{ paddingTop: 80 }}>
          <span className="empty-icon"><Icon name="alert" size={28} /></span>
          <h3>Something went wrong</h3>
          <p>Reset the demo to continue.</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={async () => {
              await api.resetDemo();
              window.location.hash = '/';
              this.setState({ error: null });
            }}
          >
            Reset demo
          </button>
        </div>
      </div>
    );
  }
}
