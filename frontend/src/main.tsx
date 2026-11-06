import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles/index.css';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { startVisitBeacon } from './lib/visits';

// /co is a separate state page with its own data; it loads on demand.
const CoApp = lazy(() => import('./co/CoApp').then((module) => ({ default: module.CoApp })));

function isColoradoPath() {
  const path = window.location.hash.startsWith('#/') ? window.location.hash.slice(1) : window.location.pathname;
  return /^\/co(\/|$)/.test(path);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      {isColoradoPath() ? (
        <Suspense fallback={null}>
          <CoApp />
        </Suspense>
      ) : (
        <App />
      )}
    </ErrorBoundary>
  </React.StrictMode>
);

startVisitBeacon();
