// Slide-in panel with everything about one stand: pictures, review form, versions, textures.
import { useCallback, useEffect, useState } from 'react';
import { Heart, Send, X } from 'lucide-react';
import StandEditor from './StandEditor.jsx';
import { Gallery, ShortlistMenu, StandActions, TexturesList, VersionsList } from './StandParts.jsx';
import { Button, IconButton, SectionTitle } from './ui.jsx';
import { api, sizeLabel } from '../lib/api.js';
import { useStore } from '../state/store.jsx';
import { useToast } from '../state/toast.jsx';

export default function StandPanel() {
  const { openId, closeStand } = useStore();
  useEffect(() => {
    if (!openId) return;
    const onKey = (e) => e.key === 'Escape' && closeStand();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId, closeStand]);
  if (!openId) return null;
  return (
    <div className="no-print fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={closeStand} />
      <aside className="animate-slide-in relative flex h-full w-full max-w-[760px] flex-col border-l border-line bg-panel shadow-2xl">
        <PanelBody key={openId} id={openId} />
      </aside>
    </div>
  );
}

function PanelBody({ id }) {
  const { closeStand, standChanged } = useStore();
  const toast = useToast();
  const [stand, setStand] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.stand(id).then(setStand).catch((e) => setError(e.message));
  }, [id]);

  const patch = useCallback(
    async (fields, message) => {
      try {
        const updated = await api.updateStand(id, fields);
        setStand(updated);
        standChanged();
        if (message) toast(message);
      } catch (e) {
        toast(e.message, { tone: 'info' });
      }
    },
    [id, standChanged, toast],
  );

  if (error) return <div className="p-6 text-sm text-danger">{error}</div>;
  if (!stand) return <PanelSkeleton />;
  const size = sizeLabel(stand);

  return (
    <>
      <header className="flex items-center gap-2 border-b border-line px-5 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium uppercase tracking-wider text-faint">
            {stand.status === 'approved' ? 'Approved stand' : stand.status === 'not_stand' ? 'Marked as not a stand' : 'Not reviewed yet'}
            {size && ` · ${size}`}
          </div>
          <h2 className="truncate text-[15px] font-semibold tracking-tight" title={stand.asset_id || stand.title}>
            {stand.asset_id || stand.title}
          </h2>
        </div>
        <IconButton
          icon={Heart}
          label={stand.favourite ? 'Remove from favourites' : 'Add to favourites'}
          active={!!stand.favourite}
          filled={!!stand.favourite}
          onClick={() => patch({ favourite: !stand.favourite })}
        />
        <IconButton icon={X} label="Close (Esc)" onClick={closeStand} />
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="p-5 pb-0">
          <Gallery stand={stand} onCover={(path) => patch({ preview_path: path }, 'Cover picture set')} />
          <div className="mt-4">
            <StandActions
              stand={stand}
              extra={
                <>
                  <ShortlistMenu stand={stand} />
                  <SendToMax stand={stand} onSent={() => api.stand(id).then(setStand)} />
                </>
              }
            />
          </div>
        </div>

        <section className="px-5 pt-7">
          <SectionTitle>Details</SectionTitle>
          <StandEditor stand={stand} onSaved={setStand} />
        </section>

        <section className="px-5 pt-7">
          <VersionsList stand={stand} onBest={(fileId) => patch({ best_file_id: fileId }, 'Version chosen')} />
        </section>

        <section className="px-5 pb-8 pt-7">
          <TexturesList stand={stand} />
          <div className="mt-4 rounded-lg bg-raised/70 px-3 py-2 text-xs">
            <span className="text-faint">Project folder </span>
            <span className="break-all text-muted">{stand.scan_project}</span>
          </div>
        </section>
      </div>
    </>
  );
}

// Merges the chosen version into the scene open in 3ds Max (needs the StandVault tools running in Max).
function SendToMax({ stand, onSent }) {
  const toast = useToast();
  const { standChanged } = useStore();
  const [busy, setBusy] = useState(false);
  const version = stand.versions.find((v) => v.file_id === stand.best_file_id) || stand.versions[0];
  const send = async () => {
    setBusy(true);
    toast('Sending to 3ds Max…', { tone: 'info', detail: version?.name });
    try {
      const r = await api.sendToMax(stand.id);
      toast(`In 3ds Max on layer ${r.layer}`, {
        detail: `${r.merged} objects · ${r.copied} textures copied, ${r.reused} already there, ${r.missing} missing${r.warnings.length ? ' · ' + r.warnings[0] : ''}`,
      });
      standChanged();
      onSent();
    } catch (e) {
      toast(e.message, { tone: 'info' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="ml-auto" title={version ? `Merges ${version.name} into the scene open in 3ds Max` : ''}>
      <Button variant="primary" icon={Send} onClick={send} disabled={busy || !version}>
        {busy ? 'Sending…' : 'Send to Max'}
      </Button>
    </span>
  );
}

function PanelSkeleton() {
  return (
    <div className="p-5">
      <div className="skeleton h-5 w-2/3 rounded" />
      <div className="skeleton mt-5 aspect-[16/10] rounded-xl" />
      <div className="skeleton mt-5 h-9 w-1/2 rounded-lg" />
      <div className="skeleton mt-8 h-40 rounded-xl" />
    </div>
  );
}
