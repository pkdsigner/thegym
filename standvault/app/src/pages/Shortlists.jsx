import { useEffect, useState } from 'react';
import { Download, ListChecks, Plus, Printer, Trash2, X } from 'lucide-react';
import StandImage from '../components/StandImage.jsx';
import { Button, EmptyState, IconButton, RendererBadge, cx } from '../components/ui.jsx';
import { useStore } from '../state/store.jsx';
import { useToast } from '../state/toast.jsx';
import { api, sizeLabel } from '../lib/api.js';
import { date, downloadText, rendererLabel, toCsv } from '../lib/format.js';

export default function Shortlists() {
  const { shortlists, activeShortlist: list, setActiveShortlistId, refreshShortlists, openStand } = useStore();
  const toast = useToast();
  const [name, setName] = useState('');
  const [title, setTitle] = useState(list?.name ?? '');

  useEffect(() => setTitle(list?.name ?? ''), [list?.id, list?.name]);

  const create = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const created = await api.createShortlist(name);
    setActiveShortlistId(created.id);
    await refreshShortlists();
    setName('');
  };
  const rename = async () => {
    if (list && title.trim() && title !== list.name) {
      await api.renameShortlist(list.id, title);
      refreshShortlists();
    }
  };
  const remove = async (standId) => {
    await api.removeFromShortlist(list.id, standId);
    refreshShortlists();
  };

  const items = list?.items ?? [];
  const exportCsv = () => {
    const rows = [
      ['Asset ID', 'Title', 'Size', 'Show', 'Year', 'Client', 'Open sides', 'Renderer', 'Status'],
      ...items.map((s) => [s.asset_id, s.title, sizeLabel(s), s.show, s.year, s.client, s.open_sides, rendererLabel(s.renderer), s.status]),
    ];
    downloadText(`${list.name.replace(/[\\/:*?"<>|]+/g, '-')}.csv`, toCsv(rows));
    toast('Shortlist exported', { detail: `${items.length} stands` });
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[280px_1fr] print:block">
      <aside className="no-print">
        <h1 className="text-[22px] font-semibold tracking-tight">Shortlists</h1>
        <p className="mt-1 text-sm text-muted">A concept board per job. Add stands from the Library.</p>
        <form onSubmit={create} className="mt-5 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Brand X – GITEX 2026"
            aria-label="New shortlist name"
            className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-panel px-3 text-sm outline-none placeholder:text-faint focus:border-accent"
          />
          <Button type="submit" variant="primary" icon={Plus} disabled={!name.trim()} aria-label="Create shortlist" />
        </form>
        <ul className="mt-4 space-y-1">
          {shortlists.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => setActiveShortlistId(l.id)}
                className={cx(
                  'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition',
                  list?.id === l.id ? 'bg-raised font-medium' : 'text-muted hover:bg-raised/60 hover:text-fg',
                )}
              >
                <span className="truncate">{l.name}</span>
                <span className="text-xs tabular-nums text-faint">{l.items.length}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section>
        {!list ? (
          <EmptyState icon={ListChecks} title="No shortlists yet">
            Create one for the job you're working on, then use the <span className="font-medium text-fg">+</span> on any stand in the Library.
          </EmptyState>
        ) : (
          <>
            <div className="no-print flex flex-wrap items-center gap-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={rename}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                aria-label="Shortlist name"
                className="min-w-0 flex-1 bg-transparent text-[22px] font-semibold tracking-tight outline-none"
              />
              <Button icon={Download} onClick={exportCsv} disabled={!items.length}>
                Export CSV
              </Button>
              <Button icon={Printer} onClick={() => window.print()} disabled={!items.length}>
                Print
              </Button>
              <IconButton
                icon={Trash2}
                label="Delete shortlist"
                onClick={async () => {
                  if (!window.confirm(`Delete “${list.name}”? The stands themselves are not affected.`)) return;
                  await api.deleteShortlist(list.id);
                  setActiveShortlistId(null);
                  refreshShortlists();
                }}
              />
            </div>
            <div className="no-print mt-1 text-sm text-muted">
              Created {date(list.created_at)} · {items.length} stands
            </div>

            {!items.length ? (
              <div className="no-print mt-6">
                <EmptyState icon={ListChecks} title="This shortlist is empty">
                  Go to the Library and click <span className="font-medium text-fg">+</span> on a stand, or use “Shortlist” in its panel.
                </EmptyState>
              </div>
            ) : (
              <div className="no-print mt-6 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                {items.map((s) => (
                  <div key={s.id} className="group relative">
                    <button type="button" onClick={() => openStand(s.id)} className="block w-full text-left">
                      <div className="relative aspect-[4/3] overflow-hidden rounded-xl ring-1 ring-line transition group-hover:ring-accent">
                        <StandImage path={s.preview} />
                        {sizeLabel(s) && <span className="absolute left-2 top-2 rounded-lg bg-black/60 px-2 py-1 text-xs font-semibold text-white">{sizeLabel(s)}</span>}
                      </div>
                      <div className="mt-2 truncate text-[13px] font-medium">{s.asset_id || s.title}</div>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                        <span className="truncate">{[s.show, s.year].filter(Boolean).join(' ')}</span>
                        <span className="ml-auto">
                          <RendererBadge renderer={s.renderer} />
                        </span>
                      </div>
                    </button>
                    <button
                      type="button"
                      aria-label="Remove from shortlist"
                      title="Remove from shortlist"
                      onClick={() => remove(s.id)}
                      className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-lg bg-black/50 text-white opacity-0 backdrop-blur transition group-hover:opacity-100"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <PrintSheet list={list} items={items} />
          </>
        )}
      </section>
    </div>
  );
}

// Only visible when printing: a clean A4 concept board.
function PrintSheet({ list, items }) {
  return (
    <div className="print-sheet hidden text-black">
      <div className="flex items-end justify-between border-b border-black/20 pb-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-black/50">StandVault shortlist</div>
          <div className="text-2xl font-semibold">{list.name}</div>
        </div>
        <div className="text-xs text-black/50">{date(new Date().toISOString())}</div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {items.map((s) => (
          <div key={s.id} className="break-inside-avoid">
            <div className="aspect-[4/3] overflow-hidden rounded-md">
              <StandImage path={s.preview} width={800} eager />
            </div>
            <div className="mt-1 break-all text-[10px] font-semibold">{s.asset_id || s.title}</div>
            <div className="text-[10px] text-black/60">
              {[sizeLabel(s), [s.show, s.year].filter(Boolean).join(' '), s.client, rendererLabel(s.renderer)].filter(Boolean).join(' · ')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
