import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles/index.css';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { startVisitBeacon } from './lib/visits';

// /co and /wy are separate state pages with their own data; they load on demand.
const CoApp = lazy(() => import('./co/CoApp').then((module) => ({ default: module.CoApp })));
const WyApp = lazy(() => import('./wy/WyApp').then((module) => ({ default: module.WyApp })));

function statePage(): 'ca' | 'co' | 'wy' {
  const path = window.location.hash.startsWith('#/') ? window.location.hash.slice(1) : window.location.pathname;
  if (/^\/co(\/|$)/.test(path)) return 'co';
  if (/^\/wy(\/|$)/.test(path)) return 'wy';
  return 'ca';
}

const page = statePage();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      {page === 'ca' ? (
        <App />
      ) : (
        <Suspense fallback={null}>{page === 'co' ? <CoApp /> : <WyApp />}</Suspense>
      )}
    </ErrorBoundary>
  </React.StrictMode>
);

// The state apps are chosen once at load, so crossing between them (e.g. preview hash
// links like #/co) reloads the page.
const reloadOnStateChange = () => {
  if (statePage() !== page) window.location.reload();
};
window.addEventListener('hashchange', reloadOnStateChange);
window.addEventListener('popstate', reloadOnStateChange);

startVisitBeacon();
