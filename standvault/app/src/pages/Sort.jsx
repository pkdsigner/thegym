// Quick sort: confirm each project's category (stand, event, activation...) in bulk, before the detailed review.
// A page of cards shows the app's guess. Click the wrong ones, press a category key; Enter saves the page.
import { useCallback, useEffect, useState } from 'react';
import { Ban, CircleCheck, Layers, PartyPopper, Undo2 } from 'lucide-react';
import StandImage from '../components/StandImage.jsx';
import { Button, EmptyState, Kbd, cx } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useStore } from '../state/store.jsx';
import { useToast } from '../state/toast.jsx';

const PAGE = 24;
const NOT_PROJECT = '__not';

export default function Sort() {
  const { taxonomy, openStand, openId, standChanged } = useStore();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [choice, setChoice] = useState({}); // stand id -> category code (or NOT_PROJECT), starts as the guess
  const [selected, setSelected] = useState(new Set());
  const [lastSaved, setLastSaved] = useState(null);
  const [busy, setBusy] = useState(false);
  const types = taxonomy?.projectTypes ?? [];

  const load = useCallback(async () => {
    const d = await api.sortQueue(PAGE);
    setData(d);
    setChoice(Object.fromEntries(d.items.map((s) => [s.id, s.project_type || 'ExhibitionStand'])));
    setSelected(new Set());
  }, []);
  useEffect(() => {
    load().catch((e) => toast(e.message, { tone: 'info' }));
  }, [load, toast]);

  const assign = useCallback(
    (code) => {
      if (!selected.size) return toast('Click the cards to change first', { tone: 'info' });
      setChoice((c) => ({ ...c, ...Object.fromEntries([...selected].map((id) => [id, code])) }));
      setSelected(new Set());
    },
    [selected, toast],
  );

  const savePage = useCallback(async () => {
    if (!data?.items.length || busy) return;
    setBusy(true);
    try {
      const changes = data.items.map((s) => (choice[s.id] === NOT_PROJECT ? { id: s.id, notProject: true } : { id: s.id, project_type: choice[s.id] }));
      const r = await api.sortSave(changes);
      setLastSaved(r.previous);
      standChanged();
      toast(`${r.done} projects sorted`);
      await load();
    } catch (e) {
      toast(e.message, { tone: 'info' });
    } finally {
      setBusy(false);
    }
  }, [data, choice, busy, load, standChanged, toast]);

  const undo = useCallback(async () => {
    if (!lastSaved) return;
    await api.sortUndo(lastSaved);
    setLastSaved(null);
    standChanged();
    toast('Last page put back');
    await load();
  }, [lastSaved, load, standChanged, toast]);

  // 1-7 categories, N not a project, Enter save the page, Esc clear the selection, Ctrl+Z undo.
  useEffect(() => {
    const onKey = (e) => {
      if (openId || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') return void (e.preventDefault(), undo());
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= types.length) return void assign(types[n - 1].code);
      if (e.key === 'n' || e.key === 'N') return void assign(NOT_PROJECT);
      if (e.key === 'Enter') return void (e.preventDefault(), savePage());
      if (e.key === 'Escape') setSelected(new Set());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId, types, assign, savePage, undo]);

  const toggle = (id) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const label = (code) => (code === NOT_PROJECT ? 'Not a project' : types.find((t) => t.code === code)?.label ?? code);

  if (!data) return <div className="skeleton h-[70vh] rounded-2xl" />;

  return (
    <div>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">Quick sort</h1>
          <p className="mt-0.5 text-sm text-muted">
            {data.left.toLocaleString('en-GB')} projects to sort · {data.sortedToday} sorted today. Check the category on each card; fix the wrong ones, then save the page.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" icon={Undo2} onClick={undo} disabled={!lastSaved} title="Ctrl+Z">
            Undo last page
          </Button>
          <Button variant="primary" icon={CircleCheck} onClick={savePage} disabled={busy || !data.items.length} title="Enter">
            Save this page
          </Button>
        </div>
      </div>

      {/* Category keys: they apply to the selected cards */}
      <div className="sticky top-14 z-20 -mx-4 mt-4 flex flex-wrap items-center gap-2 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <span className="mr-1 text-xs text-faint">{selected.size ? `${selected.size} selected - set to:` : 'Click cards to select, then:'}</span>
        {types.map((t, i) => (
          <button
            key={t.code}
            type="button"
            onClick={() => assign(t.code)}
            className="flex h-8 items-center gap-2 rounded-lg border border-line bg-panel px-2.5 text-sm hover:border-accent/60"
          >
            <Kbd>{i + 1}</Kbd>
            {t.label}
          </button>
        ))}
        <button type="button" onClick={() => assign(NOT_PROJECT)} className="flex h-8 items-center gap-2 rounded-lg border border-line bg-panel px-2.5 text-sm text-danger hover:border-danger/60">
          <Kbd>N</Kbd>
          Not a project
        </button>
        <span className="ml-auto hidden text-[11px] text-faint lg:inline">Enter save page · Esc clear · double-click to look closer</span>
      </div>

      <div className="mt-5">
        {!data.items.length ? (
          <EmptyState icon={PartyPopper} title="Everything is sorted">
            Now do the detailed review category by category: Daily review, then choose a category.
          </EmptyState>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
            {data.items.map((s) => {
              const code = choice[s.id];
              const changed = code !== (s.project_type || 'ExhibitionStand');
              const isSelected = selected.has(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggle(s.id)}
                  onDoubleClick={() => openStand(s.id)}
                  aria-pressed={isSelected}
                  className={cx(
                    'group overflow-hidden rounded-xl border bg-panel text-left transition',
                    isSelected ? 'border-accent ring-2 ring-accent' : 'border-line hover:border-faint',
                    code === NOT_PROJECT && 'opacity-50',
                  )}
                >
                  <div className="relative aspect-[4/3] bg-raised">
                    <StandImage path={s.preview} width={400} />
                    {s.versions > 1 && (
                      <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] text-white backdrop-blur">
                        <Layers size={11} /> {s.versions}
                      </span>
                    )}
                  </div>
                  <div className="px-3 py-2.5">
                    <div className="truncate text-[13px] font-medium" title={s.title}>
                      {s.title}
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-faint" title={s.scan_project}>
                      {s.scan_project?.split('\\').slice(-2).join(' \\ ')}
                    </div>
                    <div
                      className={cx(
                        'mt-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium',
                        code === NOT_PROJECT ? 'bg-danger/10 text-danger' : changed ? 'bg-accent/15 text-accent' : 'bg-raised text-muted',
                      )}
                    >
                      {code === NOT_PROJECT && <Ban size={11} />}
                      {label(code)}
                      {!changed && code !== NOT_PROJECT && <span className="font-normal text-faint">· guess</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
