// Tiny hash router: works on any static host with no server config.
import { useEffect, useState } from 'react';

let inAppSteps = 0;

function parse() {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  return { path, segments: path.split('/').filter(Boolean), query: new URLSearchParams(qs) };
}

export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onChange = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(path, { replace = false } = {}) {
  if (replace) {
    window.history.replaceState(null, '', '#' + path);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    inAppSteps += 1;
    window.location.hash = path;
  }
}

/** Go back if we navigated inside the app, otherwise to a sensible page. */
export function goBack(fallback = '/') {
  if (inAppSteps > 0) {
    inAppSteps -= 1;
    window.history.back();
  } else {
    navigate(fallback, { replace: true });
  }
}
