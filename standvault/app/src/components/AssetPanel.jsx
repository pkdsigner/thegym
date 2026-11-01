// Slide-in panel for one zone or object from the library.
import { useEffect, useState } from 'react';
import { Copy, FolderOpen, Heart, RefreshCw, Send, X } from 'lucide-react';
import StandImage from './StandImage.jsx';
import TagInput from './TagInput.jsx';
import { Button, IconButton, SectionTitle } from './ui.jsx';
import { api } from '../lib/api.js';
import { date, number } from '../lib/format.js';
import { spaced } from '../lib/naming.js';
import { useStore } from '../state/store.jsx';
import { useToast } from '../state/toast.jsx';

export default function AssetPanel() {
  const { openAssetId, closeAsset } = useStore();
  useEffect(() => {
    if (!openAssetId) return;
    const onKey = (e) => e.key === 'Escape' && closeAsset();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openAssetId, closeAsset]);
  if (!openAssetId) return null;
  return (
    <div className="no-print fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={closeAsset} />
      <aside className="animate-slide-in relative flex h-full w-full max-w-[620px] flex-col border-l border-line bg-panel shadow-2xl">
        <Body key={openAssetId} id={openAssetId} />
      </aside>
    </div>
  );
}

function Body({ id }) {
  const { closeAsset, openStand, standChanged } = useStore();
  const toast = useToast();
  const [asset, setAsset] = useState(null);
  const [tags, setTags] = useState([]);
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.asset(id).then((a) => {
      setAsset(a);
      setTags(a.tags);
      setNotes(a.notes);
    });
  }, [id]);
  if (!asset) return <div className="skeleton m-5 h-72 rounded-xl" />;

  const save = async (patch, message) => {
    const a = await api.updateAsset(id, patch);
    setAsset(a);
    standChanged();
    if (message) toast(message);
  };
  const run = async (fn, ok) => {
    try {
      await fn();
      if (ok) toast(ok);
    } catch (e) {
      toast(e.message, { tone: 'info' });
    }
  };
  const send = async () => {
    setSending(true);
    toast('Sending to 3ds Max…', { tone: 'info', detail: asset.asset_id });
    try {
      const r = await api.sendAssetToMax(id);
      toast(`In 3ds Max on layer ${r.layer}`, { detail: `${r.merged} objects · ${r.copied} textures copied, ${r.reused} already there, ${r.missing} missing` });
      standChanged();
    } catch (e) {
      toast(e.message, { tone: 'info' });
    } finally {
      setSending(false);
    }
  };
  const dirty = notes !== asset.notes || tags.join() !== asset.tags.join();

  return (
    <>
      <header className="flex items-center gap-2 border-b border-line px-5 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium uppercase tracking-wider text-faint">
            {asset.level === 'ZN' ? 'Zone' : 'Object'} · {spaced(asset.type)}
          </div>
          <h2 className="truncate text-[15px] font-semibold tracking-tight" title={asset.asset_id}>
            {asset.asset_id}
          </h2>
        </div>
        <IconButton icon={Heart} label="Favourite" active={!!asset.favourite} filled={!!asset.favourite} onClick={() => save({ favourite: !asset.favourite })} />
        <IconButton icon={X} label="Close (Esc)" onClick={closeAsset} />
      </header>
      <div className="flex-1 overflow-y-auto p-5">
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-black ring-1 ring-line">
          <StandImage path={asset.preview_path} width={1000} fit="contain" />
          {!asset.preview_path && (
            <span className="absolute bottom-3 left-3 rounded-md bg-black/60 px-2 py-1 text-xs text-white/80">The preview renders in the background - check back in a minute</span>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button icon={FolderOpen} onClick={() => run(() => api.openFolder(asset.max_path), 'Opened in Explorer')}>
            Open Folder
          </Button>
          <Button icon={Copy} onClick={() => run(() => navigator.clipboard.writeText(asset.max_path), 'Path copied')}>
            Copy Path
          </Button>
          <Button icon={RefreshCw} variant="ghost" onClick={() => run(() => api.renderAssetPreview(id), 'Rendering a new preview…')}>
            New preview
          </Button>
          <Button variant="primary" icon={Send} className="ml-auto" onClick={send} disabled={sending}>
            {sending ? 'Sending…' : 'Send to Max'}
          </Button>
        </div>

        <section className="mt-7">
          <SectionTitle>Details</SectionTitle>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            <Fact label="Theme">{spaced(asset.theme)}</Fact>
            <Fact label="Objects">{number(asset.objects)}</Fact>
            <Fact label="Textures">
              {asset.textures_total ?? '–'}
              {asset.textures_missing ? <span className="text-danger"> · {asset.textures_missing} missing</span> : null}
            </Fact>
            <Fact label="Renderer">{asset.renderer ?? '–'}</Fact>
            <Fact label="Used in">{asset.used_count} projects</Fact>
            <Fact label="Saved">{date(asset.created_at)}</Fact>
          </dl>
          {asset.sourceStand && (
            <button type="button" onClick={() => openStand(asset.sourceStand.id)} className="mt-4 text-sm text-accent hover:underline">
              From the stand: {asset.sourceStand.asset_id || asset.sourceStand.title}
            </button>
          )}
          <div className="mt-3 rounded-lg bg-raised/70 px-3 py-2 text-xs">
            <span className="text-faint">Package </span>
            <span className="break-all text-muted">{asset.package_path}</span>
          </div>
        </section>

        <section className="mt-7">
          <SectionTitle>Tags and notes</SectionTitle>
          <TagInput tags={tags} onChange={setTags} />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Anything worth remembering about this asset"
            className="mt-2 w-full resize-y rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-accent"
          />
          <div className="mt-2 flex justify-end">
            <Button variant="primary" disabled={!dirty} onClick={() => save({ tags, notes }, 'Saved')}>
              Save
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}

function Fact({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="mt-0.5 truncate">{children}</dd>
    </div>
  );
}
