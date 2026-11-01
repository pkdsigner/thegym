// A stand's picture, served (and thumbnailed) by the local server. Falls back to a "No preview" state.
import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { imageUrl } from '../lib/api.js';
import { cx } from './ui.jsx';

// Keyed by path so switching pictures starts fresh (loading shimmer, no stale "failed" state).
export default function StandImage(props) {
  return <Picture key={props.path || 'none'} {...props} />;
}

function Picture({ path, width = 480, className, compact = false, fit = 'cover', eager = false }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const url = imageUrl(path, width);
  if (!url || failed) {
    return (
      <div
        className={cx('flex h-full w-full flex-col items-center justify-center gap-1.5 bg-raised text-faint', className)}
        style={{ backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 10px, color-mix(in srgb, var(--line) 60%, transparent) 10px 11px)' }}
      >
        <ImageOff size={compact ? 14 : 22} />
        {!compact && <span className="text-xs font-medium">No preview</span>}
      </div>
    );
  }
  return (
    <div className={cx('relative h-full w-full overflow-hidden bg-raised', !loaded && 'skeleton', className)}>
      <img
        key={url}
        src={url}
        alt=""
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={cx('h-full w-full transition-opacity duration-300', fit === 'contain' ? 'object-contain' : 'object-cover', loaded ? 'opacity-100' : 'opacity-0')}
      />
    </div>
  );
}
