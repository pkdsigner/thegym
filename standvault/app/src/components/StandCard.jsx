import { memo } from 'react';
import { CircleCheck, FileWarning, Heart, Layers, ListPlus } from 'lucide-react';
import StandImage from './StandImage.jsx';
import { RendererBadge, cx } from './ui.jsx';
import { sizeLabel } from '../lib/api.js';
import { spaced } from '../lib/naming.js';

function StandCard({ stand, selected, onSelect, onOpen, onFavourite, onShortlist }) {
  const size = sizeLabel(stand);
  const showYear = [stand.show || stand.venue, stand.year].filter(Boolean).join(' ');
  return (
    <div
      role="gridcell"
      tabIndex={selected ? 0 : -1}
      aria-selected={selected}
      data-stand-id={stand.id}
      onClick={() => onOpen(stand.id)}
      onFocus={() => onSelect(stand.id)}
      className="group cursor-pointer outline-none"
    >
      <div
        className={cx(
          'relative aspect-[4/3] overflow-hidden rounded-xl bg-raised transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lift',
          selected ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : 'ring-1 ring-line/60',
        )}
      >
        <StandImage path={stand.preview} />
        <span
          className={cx(
            'absolute left-2 top-2 rounded-lg px-2 py-1 text-[13px] font-semibold tabular-nums backdrop-blur',
            size ? 'bg-black/60 text-white' : 'bg-black/35 text-white/60',
          )}
          title={size ? (stand.size_source === 'user' ? 'Size you entered' : 'Size read from the file name - check it') : 'Size not known yet'}
        >
          {size || 'Size ?'}
        </span>
        <div className="absolute right-2 top-2 flex gap-1">
          <button
            type="button"
            title="Add to shortlist"
            aria-label="Add to shortlist"
            onClick={(e) => {
              e.stopPropagation();
              onShortlist(stand);
            }}
            className="flex size-8 items-center justify-center rounded-lg bg-black/40 text-white/90 opacity-0 backdrop-blur transition hover:bg-black/60 group-hover:opacity-100"
          >
            <ListPlus size={15} />
          </button>
          <button
            type="button"
            title={stand.favourite ? 'Remove from favourites (F)' : 'Add to favourites (F)'}
            aria-label="Favourite"
            aria-pressed={!!stand.favourite}
            onClick={(e) => {
              e.stopPropagation();
              onFavourite(stand);
            }}
            className={cx(
              'flex size-8 items-center justify-center rounded-lg bg-black/40 backdrop-blur transition',
              stand.favourite ? 'text-accent' : 'text-white/90 opacity-0 hover:bg-black/60 group-hover:opacity-100',
            )}
          >
            <Heart size={15} fill={stand.favourite ? 'currentColor' : 'none'} />
          </button>
        </div>
        <div className="absolute bottom-2 left-2 flex gap-1">
          {stand.versions > 1 && (
            <span className="flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur" title={`${stand.versions} versions`}>
              <Layers size={11} />
              {stand.versions}
            </span>
          )}
          {stand.textures_missing > 0 && (
            <span className="flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur" title={`${stand.textures_missing} missing textures`}>
              <FileWarning size={11} className="text-[#ff8a7a]" />
              {stand.textures_missing}
            </span>
          )}
        </div>
        {stand.status === 'approved' && (
          <span className="absolute bottom-2 right-2 flex size-6 items-center justify-center rounded-full bg-accent text-accent-fg" title="Reviewed and approved">
            <CircleCheck size={15} />
          </span>
        )}
      </div>
      <div className="mt-2.5 px-0.5">
        <div className="truncate text-[13.5px] font-medium tracking-tight" title={stand.title}>
          {stand.client && stand.show ? stand.client : stand.title}
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
          {stand.project_type && stand.project_type !== 'ExhibitionStand' && (
            <span className="shrink-0 rounded bg-raised px-1.5 py-0.5 text-[10.5px] font-medium">{spaced(stand.project_type)}</span>
          )}
          <span className="truncate">{showYear || (stand.year ? stand.year : stand.project_type === 'ExhibitionStand' ? 'Show ?' : '')}</span>
          <span className="ml-auto shrink-0">
            <RendererBadge renderer={stand.renderer} />
          </span>
        </div>
        {stand.asset_id && <div className="mt-1 truncate text-[11px] text-faint" title={stand.asset_id}>{stand.asset_id}</div>}
      </div>
    </div>
  );
}

export default memo(StandCard);
