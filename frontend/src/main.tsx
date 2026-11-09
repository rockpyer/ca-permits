import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles/index.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { legacyRedirect, pageFor, routePath } from './lib/routes';
import { startVisitBeacon } from './lib/visits';

// / lists the states; /ca, /co and /wy are separate apps with their own data, loaded on demand.
const StatesPage = lazy(() => import('./home/StatesPage').then((module) => ({ default: module.StatesPage })));
const AboutPage = lazy(() => import('./home/AboutPage').then((module) => ({ default: module.AboutPage })));
const CaApp = lazy(() => import('./App').then((module) => ({ default: module.App })));
const CoApp = lazy(() => import('./co/CoApp').then((module) => ({ default: module.CoApp })));
const WyApp = lazy(() => import('./wy/WyApp').then((module) => ({ default: module.WyApp })));

const APPS = { home: StatesPage, about: AboutPage, ca: CaApp, co: CoApp, wy: WyApp };

// Old California links: rewrite the address in place and render the /ca view, no extra page load.
const redirect = legacyRedirect();
if (redirect) window.history.replaceState(null, '', redirect);
render();

function render() {
  const page = pageFor(routePath());
  const Page = APPS[page];

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <Suspense fallback={null}>
          <Page />
        </Suspense>
      </ErrorBoundary>
    </React.StrictMode>
  );

  // Each app is chosen once at load, so crossing between them (e.g. preview hash links like #/co)
  // reloads the page. Old California hash links (#/drilling) are sent to their /ca view.
  const onRouteChange = () => {
    const next = legacyRedirect();
    if (next) {
      window.history.replaceState(null, '', next);
      window.location.reload();
    } else if (pageFor(routePath()) !== page) window.location.reload();
  };
  window.addEventListener('hashchange', onRouteChange);
  window.addEventListener('popstate', onRouteChange);

  startVisitBeacon();
}
