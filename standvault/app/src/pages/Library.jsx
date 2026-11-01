import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileWarning, Heart, ImageOff, ImagePlus, Ruler, Search, SearchX, X } from 'lucide-react';
import StandCard from '../components/StandCard.jsx';
import AssetLibrary from './AssetLibrary.jsx';
import { Button, EmptyState, FilterChip, Kbd, Segmented, Select, SkeletonCard, cx } from '../components/ui.jsx';
import { useStore } from '../state/store.jsx';
import { useToast } from '../state/toast.jsx';
import { api } from '../lib/api.js';
import { spaced } from '../lib/naming.js';

const SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'small', label: 'Smallest first' },
  { value: 'large', label: 'Largest first' },
  { value: 'used', label: 'Most used' },
  { value: 'favourites', label: 'Favourites first' },
  { value: 'name', label: 'Name A–Z' },
];
// Area bands in m² (a 6x6 stand is 36 m²).
const AREAS = [
  { key: 'xs', label: 'up to 36 m²', max: 36 },
  { key: 's', label: '36–100 m²', min: 36, max: 100 },
  { key: 'm', label: '100–300 m²', min: 100, max: 300 },
  { key: 'l', label: '300+ m²', min: 300 },
  { key: 'none', label: 'Size unknown' },
];
const NO_FILTERS = { status: 'all', w: '', d: '', tol: '1', area: '', projectType: '', style: '', venue: '', show: '', year: '', renderer: '', favourites: false, missing: false, noPreview: false };
const PAGE = 60;

function usePref(key, initial) {
  const [v, setV] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {}
  }, [key, v]);
  return [v, setV];
}

export default function Library() {
  const { stats, taxonomy, openId, openStand, version, activeShortlist, setActiveShortlistId, refreshShortlists } = useStore();
  const toast = useToast();
  const [size, setSize] = usePref('sv.cardSize', 260);
  const [level, setLevel] = usePref('sv.libraryLevel', 'ST');
  const [sort, setSort] = usePref('sv.sort', 'newest');
  const [savedFilters, setFilters] = usePref('sv.filters', NO_FILTERS);
  const filters = { ...NO_FILTERS, ...savedFilters };
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const searchRef = useRef(null);
  const gridRef = useRef(null);
  const moreRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  const params = useMemo(() => {
    const band = AREAS.find((a) => a.key === filters.area);
    return {
      q: debounced,
      status: filters.status,
      w: filters.w && filters.d ? filters.w : '',
      d: filters.w && filters.d ? filters.d : '',
      tol: filters.tol,
      minArea: band?.min ?? '',
      maxArea: band?.max ?? '',
      noSize: filters.area === 'none',
      show: filters.show,
      year: filters.year,
      renderer: filters.renderer,
      projectType: filters.projectType,
      style: filters.style,
      venue: filters.venue,
      favourites: filters.favourites,
      missing: filters.missing,
      noPreview: filters.noPreview,
      sort,
    };
  }, [debounced, JSON.stringify(filters), sort]); // filters is rebuilt every render; compare its contents

  // First page whenever the search, filters or data change; more pages as you scroll.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .stands({ ...params, page: 0, pageSize: PAGE })
      .then((r) => {
        if (!alive) return;
        setItems(r.items);
        setTotal(r.total);
        setPage(0);
      })
      .catch((e) => toast(e.message, { tone: 'info' }))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [params, version, toast]);

  const loadMore = useCallback(() => {
    if (loading || items.length >= (total ?? 0)) return;
    const next = page + 1;
    setLoading(true);
    api
      .stands({ ...params, page: next, pageSize: PAGE })
      .then((r) => {
        setItems((list) => [...list, ...r.items]);
        setPage(next);
      })
      .finally(() => setLoading(false));
  }, [loading, items.length, total, page, params]);

  useEffect(() => {
    const el = moreRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && loadMore(), { rootMargin: '800px' });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  const setFilter = (k) => (v) => setFilters((f) => ({ ...f, [k]: v }));
  const filtered = query || Object.entries(filters).some(([k, v]) => v !== NO_FILTERS[k]);
  const clearAll = () => {
    setFilters(NO_FILTERS);
    setQuery('');
  };

  const favourite = useCallback(
    async (stand) => {
      await api.updateStand(stand.id, { favourite: !stand.favourite });
      setItems((list) => list.map((s) => (s.id === stand.id ? { ...s, favourite: stand.favourite ? 0 : 1 } : s)));
    },
    [],
  );
  const shortlist = useCallback(
    async (stand) => {
      const list = activeShortlist || (await api.createShortlist(`Shortlist ${new Date().toLocaleDateString('en-GB')}`));
      await api.addToShortlist(list.id, stand.id);
      setActiveShortlistId(list.id);
      refreshShortlists();
      toast(`Added to “${list.name}”`, { detail: stand.title });
    },
    [activeShortlist, setActiveShortlistId, refreshShortlists, toast],
  );

  // Keyboard: "/" search, arrows move, Enter opens, F favourites. The panel handles its own keys.
  useEffect(() => {
    const focusCard = (id) => {
      setSelectedId(id);
      const el = gridRef.current?.querySelector(`[data-stand-id="${id}"]`);
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };
    const onKey = (e) => {
      if (level !== 'ST' || openId || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      const typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable;
      if (typing) {
        if (t === searchRef.current && e.key === 'ArrowDown' && items.length) {
          e.preventDefault();
          focusCard(items[0].id);
        } else if (e.key === 'Escape') t.blur();
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      const index = items.findIndex((s) => s.id === selectedId);
      if ((e.key === 'f' || e.key === 'F') && index >= 0) return void favourite(items[index]);
      if (e.key === 'Enter' && index >= 0) return void openStand(selectedId);
      const cards = gridRef.current ? [...gridRef.current.children] : [];
      const cols = Math.max(1, cards.filter((c) => c.offsetTop === cards[0]?.offsetTop).length);
      const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
      if (!step || !items.length) return;
      e.preventDefault();
      focusCard(items[index < 0 ? 0 : Math.min(items.length - 1, Math.max(0, index + step))].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items, selectedId, openId, openStand, favourite, level]);

  const statusOptions = [
    { value: 'all', label: `All ${stats ? stats.stands.toLocaleString('en-GB') : ''}` },
    { value: 'unreviewed', label: `To review ${stats ? stats.unreviewed.toLocaleString('en-GB') : ''}` },
    { value: 'approved', label: `Approved ${stats ? stats.approved.toLocaleString('en-GB') : ''}` },
  ];

  const tabs = [
    { code: 'ST', label: 'Stands', n: stats?.stands },
    { code: 'ZN', label: 'Zones', n: stats?.zones },
    { code: 'OB', label: 'Objects', n: stats?.objects },
  ];
  const header = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div role="tablist" aria-label="Level" className="flex gap-1">
        {tabs.map((t) => (
          <button
            key={t.code}
            role="tab"
            type="button"
            aria-selected={level === t.code}
            onClick={() => setLevel(t.code)}
            className={cx(
              'relative flex items-baseline gap-2 px-3 pb-3 pt-1 text-[22px] font-semibold tracking-tight transition',
              level === t.code ? 'text-fg' : 'text-faint hover:text-muted',
            )}
          >
            {t.label}
            <span className="text-sm font-medium tabular-nums text-faint">{t.n?.toLocaleString('en-GB') ?? ''}</span>
            {level === t.code && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent" />}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 pb-2">
        {level === 'ST' && (
          <>
            <Segmented value={filters.status} onChange={setFilter('status')} options={statusOptions} label="Review status" />
            <Select value={sort} onChange={setSort} options={SORTS} label="Sort" />
          </>
        )}
        <label className="flex items-center gap-2 text-xs text-muted" title="Card size">
          <ImagePlus size={14} />
          <input type="range" min={180} max={440} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-24" aria-label="Card size" />
        </label>
      </div>
    </div>
  );

  if (level !== 'ST')
    return (
      <div>
        {header}
        <div className="mt-4">
          <AssetLibrary level={level} size={size} />
        </div>
      </div>
    );

  // Category first: stands, events, activations... each with its own count.
  const categories = (
    <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Category">
      {[{ code: '', label: 'All', n: stats?.stands }, ...(taxonomy?.projectTypes ?? []).map((t) => ({ ...t, n: stats?.projectTypes?.find((p) => p.project_type === t.code)?.n ?? 0 }))].map((t) => (
        <button
          key={t.code || 'all'}
          type="button"
          role="radio"
          aria-checked={filters.projectType === t.code}
          onClick={() => setFilter('projectType')(t.code)}
          className={cx(
            'flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm transition',
            filters.projectType === t.code ? 'border-accent bg-accent/15 font-medium text-accent' : 'border-line bg-panel text-muted hover:border-faint hover:text-fg',
          )}
        >
          {t.label}
          <span className="text-xs tabular-nums opacity-70">{t.n?.toLocaleString('en-GB') ?? ''}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div>
      {header}
      {categories}

      <div className="relative mt-4">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint" />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by client, show, year, tag, note or Asset ID…"
          className="h-12 w-full rounded-xl border border-line bg-panel pl-11 pr-24 text-[15px] outline-none transition placeholder:text-faint focus:border-accent focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent)_15%,transparent)]"
          aria-label="Search"
        />
        <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
          {query ? (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="rounded-md p-1 text-muted hover:text-fg">
              <X size={16} />
            </button>
          ) : (
            <Kbd>/</Kbd>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <SizeFilter filters={filters} setFilter={setFilter} />
        <Select
          value={filters.area}
          onChange={setFilter('area')}
          label="Area"
          options={[{ value: '', label: 'Any area' }, ...AREAS.map((a) => ({ value: a.key, label: a.label }))]}
        />
        <Select
          value={filters.show}
          onChange={setFilter('show')}
          label="Show"
          options={[{ value: '', label: 'All shows' }, ...(stats?.shows ?? []).map((s) => ({ value: s.show, label: `${s.show} (${s.n})` }))]}
        />
        <Select
          value={filters.year}
          onChange={setFilter('year')}
          label="Year"
          options={[{ value: '', label: 'All years' }, ...(stats?.years ?? []).map((y) => ({ value: String(y.year), label: `${y.year} (${y.n})` }))]}
        />
        <Segmented
          value={filters.renderer}
          onChange={setFilter('renderer')}
          label="Renderer"
          options={[
            { value: '', label: 'All' },
            { value: 'VRay', label: 'V-Ray' },
            { value: 'Corona', label: 'Corona' },
          ]}
        />
        <Select
          value={filters.venue}
          onChange={setFilter('venue')}
          label="Venue"
          options={[{ value: '', label: 'All venues' }, ...(stats?.venues ?? []).map((v) => ({ value: v.venue, label: `${v.venue} (${v.n})` }))]}
        />
        <Select
          value={filters.style}
          onChange={setFilter('style')}
          label="Style"
          options={[{ value: '', label: 'Any style' }, ...(taxonomy?.styles ?? []).map((t) => ({ value: t, label: spaced(t) }))]}
        />
        <FilterChip icon={Heart} active={filters.favourites} onClick={() => setFilter('favourites')(!filters.favourites)}>
          Favourites
        </FilterChip>
        <FilterChip icon={FileWarning} active={filters.missing} onClick={() => setFilter('missing')(!filters.missing)}>
          Missing textures
        </FilterChip>
        <FilterChip icon={ImageOff} active={filters.noPreview} onClick={() => setFilter('noPreview')(!filters.noPreview)}>
          No preview
        </FilterChip>
        {filtered && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            Clear all
          </Button>
        )}
        <span className="ml-auto text-sm tabular-nums text-faint">{total == null ? '' : `${total.toLocaleString('en-GB')} stands`}</span>
      </div>

      <div className="mt-6">
        {loading && !items.length ? (
          <Grid size={size}>
            {Array.from({ length: 12 }, (_, i) => (
              <SkeletonCard key={i} />
            ))}
          </Grid>
        ) : items.length ? (
          <>
            <Grid size={size} innerRef={gridRef}>
              {items.map((s) => (
                <StandCard key={s.id} stand={s} selected={s.id === selectedId} onSelect={setSelectedId} onOpen={openStand} onFavourite={favourite} onShortlist={shortlist} />
              ))}
            </Grid>
            <div ref={moreRef} className="flex h-16 items-center justify-center text-sm text-faint">
              {items.length < (total ?? 0) ? (loading ? 'Loading more…' : '') : `All ${total} shown`}
            </div>
          </>
        ) : stats && stats.stands === 0 ? (
          <EmptyState icon={ImagePlus} title="No stands yet">
            Run the scan and then <span className="font-medium text-fg">npm run import</span> to load your stands.
          </EmptyState>
        ) : (
          <EmptyState icon={SearchX} title="Nothing matches" action={<Button onClick={clearAll}>Clear search and filters</Button>}>
            Try fewer words, a bigger size tolerance, or loosen the filters.
          </EmptyState>
        )}
      </div>
    </div>
  );
}

// "I have a brief for a 10 x 10": width x depth with a tolerance, either way round.
function SizeFilter({ filters, setFilter }) {
  const active = filters.w && filters.d;
  return (
    <div
      className={cx(
        'flex h-9 items-center gap-1 rounded-lg border bg-panel pl-2.5 pr-1 text-sm',
        active ? 'border-accent/60' : 'border-line',
      )}
      title="Find stands of this size (either way round), give or take the tolerance"
    >
      <Ruler size={14} className={active ? 'text-accent' : 'text-muted'} />
      <input
        type="number"
        min="1"
        value={filters.w}
        onChange={(e) => setFilter('w')(e.target.value)}
        placeholder="W"
        aria-label="Width in metres"
        className="w-11 bg-transparent text-center outline-none placeholder:text-faint"
      />
      <span className="text-faint">×</span>
      <input
        type="number"
        min="1"
        value={filters.d}
        onChange={(e) => setFilter('d')(e.target.value)}
        placeholder="D"
        aria-label="Depth in metres"
        className="w-11 bg-transparent text-center outline-none placeholder:text-faint"
      />
      <span className="text-faint">m ±</span>
      <select value={filters.tol} onChange={(e) => setFilter('tol')(e.target.value)} aria-label="Tolerance" className="cursor-pointer bg-transparent text-muted outline-none">
        {['0', '0.5', '1', '2', '3'].map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      {active && (
        <button
          type="button"
          onClick={() => {
            setFilter('w')('');
            setFilter('d')('');
          }}
          aria-label="Clear size"
          className="rounded p-1 text-muted hover:text-fg"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

function Grid({ size, innerRef, children }) {
  return (
    <div ref={innerRef} role="grid" className="grid gap-x-5 gap-y-7" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${size}px, 1fr))` }}>
      {children}
    </div>
  );
}
