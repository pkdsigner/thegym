// Pieces of a stand's detail view, shared by the slide-in panel and the daily review.
import { useMemo, useState } from 'react';
import { Check, Copy, FileWarning, FolderOpen, ImageIcon, Package } from 'lucide-react';
import StandImage from './StandImage.jsx';
import { Button, IconButton, SectionTitle, cx } from './ui.jsx';
import { api } from '../lib/api.js';
import { bytes, date, number } from '../lib/format.js';
import { useStore } from '../state/store.jsx';
import { useToast } from '../state/toast.jsx';

// Every picture we have for a stand: the chosen cover, the renders, then each version's Max thumbnail.
export function useStandPictures(stand) {
  return useMemo(() => {
    const seen = new Set();
    const list = [];
    const add = (path, kind, label) => {
      if (!path || seen.has(path.toLowerCase())) return;
      seen.add(path.toLowerCase());
      list.push({ path, kind, label });
    };
    add(stand.preview_path, 'cover', 'Cover');
    stand.renders.forEach((p, i) => add(p, 'render', `Render ${i + 1}`));
    stand.versions.forEach((v) => add(v.thumbnail, 'thumbnail', `Max thumbnail · ${v.name}`));
    return list;
  }, [stand]);
}

export function Gallery({ stand, onCover, tall = false }) {
  const pictures = useStandPictures(stand);
  const [index, setIndex] = useState(0);
  const current = pictures[Math.min(index, pictures.length - 1)];
  const isCover = current && (stand.preview_path ? current.path === stand.preview_path : index === 0);
  return (
    <div>
      <div className={cx('relative overflow-hidden rounded-xl bg-black ring-1 ring-line', tall ? 'aspect-[16/10]' : 'aspect-[16/10]')}>
        <StandImage path={current?.path} width={1400} fit="contain" />
        {current && (
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6 text-[11px] text-white/80">
            <span className="truncate">{current.label}</span>
            {current.kind === 'thumbnail' && <span className="rounded bg-white/15 px-1.5 py-0.5">small viewport capture</span>}
            {onCover && !isCover && (
              <button
                type="button"
                onClick={() => {
                  onCover(current.path);
                  setIndex(0);
                }}
                className="ml-auto shrink-0 rounded-md bg-white/15 px-2 py-1 font-medium text-white hover:bg-white/25">
                Use as cover
              </button>
            )}
            {isCover && <span className="ml-auto shrink-0 rounded-md bg-accent px-2 py-1 font-medium text-accent-fg">Cover</span>}
          </div>
        )}
      </div>
      {pictures.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {pictures.map((p, i) => (
            <button
              key={p.path}
              type="button"
              title={p.label}
              onClick={() => setIndex(i)}
              className={cx('h-14 w-20 shrink-0 overflow-hidden rounded-lg transition', index === i ? 'ring-2 ring-accent' : 'opacity-70 ring-1 ring-line hover:opacity-100')}
            >
              <StandImage path={p.path} width={200} compact />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function VersionsList({ stand, onBest }) {
  const toast = useToast();
  const best = stand.best_file_id || stand.versions[0]?.file_id;
  const open = async (path) => {
    try {
      await api.openFolder(path);
      toast('Opened in Explorer', { detail: path });
    } catch (e) {
      toast(e.message, { tone: 'info' });
    }
  };
  return (
    <div>
      <SectionTitle right={<span className="text-xs text-muted">newest first · pick the good one</span>}>Versions ({stand.versions.length})</SectionTitle>
      <ul className="max-h-72 overflow-y-auto rounded-xl border border-line">
        {stand.versions.map((v) => (
          <li key={v.file_id} className={cx('flex items-center gap-3 border-b border-line px-3 py-2 text-xs last:border-0', v.file_id === best && 'bg-accent/5')}>
            <button
              type="button"
              onClick={() => onBest?.(v.file_id)}
              title={v.file_id === best ? 'The version used for this stand' : 'Use this version'}
              className={cx(
                'flex size-5 shrink-0 items-center justify-center rounded-full border transition',
                v.file_id === best ? 'border-accent bg-accent text-accent-fg' : 'border-line text-transparent hover:border-accent',
              )}
            >
              <Check size={12} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-fg" title={v.path}>
                {v.archive && <Package size={11} className="mr-1 inline text-faint" />}
                {v.name}
              </div>
              <div className="mt-0.5 truncate text-faint">
                {date(v.modified)} · Max {v.saved_as_year ?? '?'} · {v.renderer ?? '?'} · {number(v.objects)} objects · {bytes(v.size_bytes)}
                {v.textures_missing > 0 && <span className="text-danger"> · {v.textures_missing} textures missing</span>}
              </div>
            </div>
            {v.preview_source === 'none' && <ImageIcon size={13} className="shrink-0 text-faint" title="No picture" />}
            <IconButton icon={FolderOpen} label="Show in Explorer" onClick={() => open(v.path)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

const STATUS_LABEL = {
  missing: 'missing',
  elsewhere: 'same name elsewhere on the drive',
  nearby: 'copy next to the scene (relink)',
  ok: 'found',
};

export function TexturesList({ stand }) {
  const [showAll, setShowAll] = useState(false);
  const counts = stand.textures.reduce((m, t) => ((m[t.status] = (m[t.status] || 0) + 1), m), {});
  const list = showAll ? stand.textures : stand.textures.filter((t) => t.status !== 'ok').slice(0, 40);
  const version = stand.versions.find((v) => v.file_id === stand.textureFileId);
  return (
    <div>
      <SectionTitle right={version && <span className="truncate text-xs text-muted">of {version.name}</span>}>Textures ({stand.textures.length})</SectionTitle>
      <div className="mb-2 flex flex-wrap gap-1.5 text-[11px]">
        {['missing', 'elsewhere', 'nearby', 'ok'].map(
          (k) =>
            counts[k] > 0 && (
              <span key={k} className={cx('rounded-md px-1.5 py-0.5', k === 'missing' ? 'bg-danger/10 text-danger' : 'bg-raised text-muted')}>
                {counts[k]} {STATUS_LABEL[k]}
              </span>
            ),
        )}
      </div>
      {list.length > 0 && (
        <ul className="max-h-56 overflow-y-auto rounded-xl border border-line text-xs">
          {list.map((t, i) => (
            <li key={i} className={cx('flex items-center gap-2 border-b border-line px-3 py-1.5 last:border-0', t.status === 'missing' && 'text-danger')}>
              {t.status === 'missing' ? <FileWarning size={12} className="shrink-0" /> : <Check size={12} className="shrink-0 text-faint" />}
              <span className="truncate" title={t.found_at ? `${t.path}\nfound at ${t.found_at}` : t.path}>
                {t.path}
              </span>
              {t.reason && t.status === 'missing' && <span className="ml-auto shrink-0 text-[10px] text-faint">{t.reason}</span>}
            </li>
          ))}
        </ul>
      )}
      {stand.textures.length > list.length && (
        <Button variant="ghost" size="sm" className="mt-1" onClick={() => setShowAll(true)}>
          Show all {stand.textures.length}
        </Button>
      )}
    </div>
  );
}

export function StandActions({ stand, extra }) {
  const toast = useToast();
  const path = (stand.versions.find((v) => v.file_id === stand.best_file_id) || stand.versions[0])?.path;
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        icon={FolderOpen}
        disabled={!path}
        onClick={async () => {
          try {
            await api.openFolder(path);
            toast('Opened in Explorer', { detail: path });
          } catch (e) {
            toast(e.message, { tone: 'info' });
          }
        }}
      >
        Open Folder
      </Button>
      <Button
        icon={Copy}
        disabled={!path}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(path);
            toast('Path copied', { detail: path });
          } catch {
            toast('Could not copy the path', { tone: 'info' });
          }
        }}
      >
        Copy Path
      </Button>
      {extra}
    </div>
  );
}

export function ShortlistMenu({ stand }) {
  const { shortlists, refreshShortlists, setActiveShortlistId } = useStore();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const add = async (list) => {
    await api.addToShortlist(list.id, stand.id);
    setActiveShortlistId(list.id);
    refreshShortlists();
    toast(`Added to “${list.name}”`);
    setOpen(false);
  };
  return (
    <div className="relative">
      <Button onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        Shortlist
      </Button>
      {open && (
        <div className="animate-fade-up absolute left-0 top-11 z-10 w-64 rounded-xl border border-line bg-panel p-1.5 shadow-lift">
          {shortlists.map((l) => (
            <button key={l.id} type="button" onClick={() => add(l)} className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm hover:bg-raised">
              <span className="truncate">{l.name}</span>
              {l.items.some((i) => i.id === stand.id) && <Check size={14} className="text-accent" />}
            </button>
          ))}
          <button
            type="button"
            onClick={async () => {
              const name = window.prompt('Name the shortlist (e.g. Brand X - GITEX 2026)');
              if (name) add(await api.createShortlist(name));
            }}
            className="mt-1 w-full rounded-lg border-t border-line px-2.5 py-2 text-left text-sm text-accent hover:bg-raised"
          >
            + New shortlist…
          </button>
        </div>
      )}
    </div>
  );
}
