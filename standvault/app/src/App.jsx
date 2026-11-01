import { useEffect, useState } from 'react';
import Navbar from './components/Navbar.jsx';
import StandPanel from './components/StandPanel.jsx';
import AssetPanel from './components/AssetPanel.jsx';
import Library from './pages/Library.jsx';
import Review from './pages/Review.jsx';
import Sort from './pages/Sort.jsx';
import Shortlists from './pages/Shortlists.jsx';
import HealthCheck from './pages/HealthCheck.jsx';
import Settings from './pages/Settings.jsx';
import { useStore } from './state/store.jsx';

const PAGES = { library: Library, sort: Sort, review: Review, shortlists: Shortlists, health: HealthCheck, settings: Settings };

// Hash routes (#/library, #/review...) keep the app a single page.
function useRoute() {
  const read = () => location.hash.replace(/^#\/?/, '').split('/')[0] || 'library';
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return PAGES[route] ? route : 'library';
}

export default function App() {
  const route = useRoute();
  const { error } = useStore();
  const Page = PAGES[route];
  return (
    <div className="min-h-full">
      <Navbar route={route} />
      <main className="mx-auto max-w-[1800px] px-4 pb-16 pt-6 sm:px-6">
        {error ? (
          <div className="rounded-xl border border-danger/40 bg-danger/5 p-5 text-sm">
            <div className="font-medium text-danger">The StandVault server isn't answering.</div>
            <div className="mt-1 text-muted">Start everything with npm run dev in the standvault folder, then reload this page. ({error})</div>
          </div>
        ) : (
          <Page />
        )}
      </main>
      <StandPanel />
      <AssetPanel />
    </div>
  );
}
