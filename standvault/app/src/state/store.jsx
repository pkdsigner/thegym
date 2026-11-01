// App-wide state: config (taxonomy), library stats, shortlists and which stand's panel is open.
// Stand lists themselves are fetched by each screen from the server.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const Store = createContext(null);

export function StoreProvider({ children }) {
  const [config, setConfig] = useState(null);
  const [stats, setStats] = useState(null);
  const [shortlists, setShortlists] = useState([]);
  const [activeShortlistId, setActiveShortlistId] = useState(() => {
    try {
      return Number(localStorage.getItem('sv.activeShortlist')) || null;
    } catch {
      return null;
    }
  });
  const [openId, setOpenId] = useState(null);
  const [openAssetId, setOpenAssetId] = useState(null);
  const [error, setError] = useState(null);
  // Bumped after any change to a stand, so open lists refresh.
  const [version, setVersion] = useState(0);

  const refreshStats = useCallback(() => api.stats().then(setStats).catch((e) => setError(e.message)), []);
  const refreshShortlists = useCallback(() => api.shortlists().then(setShortlists).catch(() => {}), []);
  const refreshConfig = useCallback(() => api.config().then(setConfig).catch((e) => setError(e.message)), []);

  useEffect(() => {
    refreshConfig();
    refreshStats();
    refreshShortlists();
  }, [refreshConfig, refreshStats, refreshShortlists]);

  useEffect(() => {
    try {
      if (activeShortlistId) localStorage.setItem('sv.activeShortlist', String(activeShortlistId));
    } catch {}
  }, [activeShortlistId]);

  const standChanged = useCallback(() => {
    setVersion((v) => v + 1);
    refreshStats();
    refreshShortlists();
  }, [refreshStats, refreshShortlists]);

  const activeShortlist = shortlists.find((l) => l.id === activeShortlistId) || shortlists[0] || null;

  const value = {
    config,
    taxonomy: config?.taxonomy,
    stats,
    error,
    version,
    standChanged,
    refreshConfig,
    refreshShortlists,
    shortlists,
    activeShortlist,
    setActiveShortlistId,
    openId,
    openStand: (id) => {
      setOpenAssetId(null);
      setOpenId(id);
    },
    closeStand: () => setOpenId(null),
    openAssetId,
    openAsset: setOpenAssetId,
    closeAsset: () => setOpenAssetId(null),
  };
  return <Store.Provider value={value}>{children}</Store.Provider>;
}

export const useStore = () => useContext(Store);
