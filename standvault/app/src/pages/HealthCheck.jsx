import { useEffect, useState } from 'react';
import { ChevronRight, Copy, FileWarning, ImageOff, PartyPopper, Ruler, Image as ImageIcon } from 'lucide-react';
import StandImage from '../components/StandImage.jsx';
import { EmptyState, cx } from '../components/ui.jsx';
import { useStore } from '../state/store.jsx';
import { api, sizeLabel } from '../lib/api.js';
import { bytes } from '../lib/format.js';

const SECTIONS = [
  { key: 'noSize', label: 'Size unknown', icon: Ruler, hint: 'Stands without a width x depth yet. The daily review fills these in.' },
  {
    key: 'missing',
    label: 'Missing textures',
    icon: FileWarning,
    hint: 'Stands whose newest version uses textures that are not on disk. Many are on Z: or other computers.',
    detail: (s) => `${s.textures_missing} of ${s.textures_total} missing`,
  },
  { key: 'thumbnailOnly', label: 'Max thumbnail only', icon: ImageIcon, hint: 'No render found - only the small viewport capture Max saves in the file.' },
  { key: 'noPreview', label: 'No preview', icon: ImageOff, hint: 'No render and no thumbnail at all.' },
  { key: 'duplicates', label: 'Duplicate files', icon: Copy, hint: 'Scene files that are exact copies of another file. Keep one, delete the others when you are ready.' },
];

export default function HealthCheck() {
  const { openStand, version } = useStore();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('noSize');
  useEffect(() => {
    api.health().then(setData);
  }, [version]);
  const section = SECTIONS.find((s) => s.key === tab);
  const rows = data?.[tab] ?? [];

  return (
    <div>
      <h1 className="text-[22px] font-semibold tracking-tight">Health Check</h1>
      <p className="mt-1 text-sm text-muted">What needs fixing in the library. Lists show up to 500 at a time.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {SECTIONS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={cx('rounded-xl border p-4 text-left transition', tab === key ? 'border-accent/60 bg-accent/5' : 'border-line bg-panel hover:border-faint')}
          >
            <div className="flex items-center gap-2 text-sm text-muted">
              <Icon size={15} className={tab === key ? 'text-accent' : ''} />
              {label}
            </div>
            <div className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{data ? (data[key].length >= 500 ? '500+' : data[key].length) : '–'}</div>
          </button>
        ))}
      </div>

      <div className="mt-8">
        <div className="mb-3 text-sm text-muted">{section.hint}</div>
        {!data ? (
          <div className="skeleton h-64 rounded-xl" />
        ) : rows.length === 0 ? (
          <EmptyState icon={PartyPopper} title="Nothing to fix here" />
        ) : tab === 'duplicates' ? (
          <ul className="overflow-hidden rounded-xl border border-line bg-panel text-sm">
            {rows.map((f) => (
              <li key={f.path} className="border-b border-line px-4 py-2.5 last:border-0">
                <div className="truncate font-medium">{f.name}</div>
                <div className="truncate text-xs text-faint" title={f.path}>
                  {f.path} · {bytes(f.size_bytes)}
                </div>
                <div className="truncate text-xs text-muted" title={f.duplicate_of}>
                  same as {f.duplicate_of}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="overflow-hidden rounded-xl border border-line bg-panel">
            {rows.map((s) => (
              <li key={s.id} className="border-b border-line last:border-0">
                <button type="button" onClick={() => openStand(s.id)} className="flex w-full items-center gap-4 px-4 py-2.5 text-left transition hover:bg-raised/60">
                  <div className="h-11 w-14 shrink-0 overflow-hidden rounded-md ring-1 ring-line">
                    <StandImage path={s.preview} width={160} compact />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{s.asset_id || s.title}</div>
                    <div className="truncate text-xs text-faint">{[sizeLabel(s), s.show, s.year, `${s.versions} version${s.versions === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}</div>
                  </div>
                  {section.detail && <div className="hidden text-sm text-muted sm:block">{section.detail(s)}</div>}
                  <ChevronRight size={16} className="shrink-0 text-faint" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
