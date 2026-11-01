// Zones or objects harvested with "Save to Library" in 3ds Max.
import { useEffect, useState } from 'react';
import { Heart, Search, Sofa, X } from 'lucide-react';
import StandImage from '../components/StandImage.jsx';
import { EmptyState, FilterChip, Select, SkeletonCard, cx } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { spaced } from '../lib/naming.js';
import { useStore } from '../state/store.jsx';

export default function AssetLibrary({ level, size }) {
  const { taxonomy, openAsset, version } = useStore();
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [theme, setTheme] = useState('');
  const [favourites, setFavourites] = useState(false);
  const [items, setItems] = useState(null);
  const types = (level === 'ZN' ? taxonomy?.zoneTypes : taxonomy?.objectTypes) ?? [];
  const many = level === 'ZN' ? 'zones' : 'objects';

  useEffect(() => setType(''), [level]);
  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => api.assets({ level, q: query, type, theme, favourites }).then((r) => alive && setItems(r.items)), 150);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [level, query, type, theme, favourites, version]);

  return (
    <div>
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${many} by name, type, theme or tag…`}
          aria-label="Search"
          className="h-12 w-full rounded-xl border border-line bg-panel pl-11 pr-12 text-[15px] outline-none placeholder:text-faint focus:border-accent"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-fg">
            <X size={16} />
          </button>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Select value={type} onChange={setType} label="Type" options={[{ value: '', label: 'All types' }, ...types.map((t) => ({ value: t, label: spaced(t) }))]} />
        <Select
          value={theme}
          onChange={setTheme}
          label="Theme"
          options={[{ value: '', label: 'All themes' }, ...(taxonomy?.themes ?? []).map((t) => ({ value: t, label: spaced(t) }))]}
        />
        <FilterChip icon={Heart} active={favourites} onClick={() => setFavourites(!favourites)}>
          Favourites
        </FilterChip>
        <span className="ml-auto text-sm text-faint">{items ? `${items.length} ${many}` : ''}</span>
      </div>

      <div className="mt-6">
        {!items ? (
          <div className="grid gap-x-5 gap-y-7" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${size}px, 1fr))` }}>
            {Array.from({ length: 6 }, (_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={Sofa} title={`No ${type ? spaced(type).toLowerCase() + ' ' : ''}${many} yet`}>
            Harvest one from a stand scene: select the objects in 3ds Max, then StandVault &gt; Save to Library.
          </EmptyState>
        ) : (
          <div className="grid gap-x-5 gap-y-7" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${size}px, 1fr))` }}>
            {items.map((a) => (
              <button key={a.asset_id} type="button" onClick={() => openAsset(a.asset_id)} className="group text-left">
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-raised ring-1 ring-line/60 transition group-hover:-translate-y-0.5 group-hover:shadow-lift">
                  <StandImage path={a.preview_path} />
                  {a.favourite ? <Heart size={15} fill="currentColor" className="absolute right-3 top-3 text-accent" /> : null}
                </div>
                <div className="mt-2.5 truncate text-[13px] font-medium" title={a.asset_id}>
                  {a.asset_id}
                </div>
                <div className={cx('mt-1 flex gap-1.5 text-xs text-muted')}>
                  <span className="rounded bg-raised px-1.5 py-0.5">{spaced(a.type)}</span>
                  <span className="truncate">{spaced(a.theme)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
