import { ChevronDown } from 'lucide-react';
import { rendererLabel } from '../lib/format.js';
import { spaced } from '../lib/naming.js';

const cx = (...c) => c.filter(Boolean).join(' ');
export { cx };

const BUTTON = {
  primary: 'bg-accent text-accent-fg hover:brightness-110',
  secondary: 'border border-line bg-raised/60 text-fg hover:bg-raised',
  ghost: 'text-muted hover:bg-raised hover:text-fg',
  danger: 'text-danger hover:bg-danger/10',
};

export function Button({ variant = 'secondary', size = 'md', icon: Icon, children, className, ...props }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-40',
        size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
        BUTTON[variant],
        className,
      )}
      {...props}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  );
}

export function IconButton({ icon: Icon, label, active, filled, className, size = 16, ...props }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cx(
        'inline-flex size-8 items-center justify-center rounded-lg transition',
        active ? 'text-accent' : 'text-muted hover:bg-raised hover:text-fg',
        className,
      )}
      {...props}
    >
      <Icon size={size} fill={filled ? 'currentColor' : 'none'} />
    </button>
  );
}

export function Select({ value, onChange, options, label, className }) {
  return (
    <label className={cx('relative inline-flex items-center', className)}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full cursor-pointer appearance-none rounded-lg border border-line bg-panel pl-3 pr-8 text-sm text-fg outline-none transition hover:border-faint focus:border-accent"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 text-muted" />
    </label>
  );
}

export function Segmented({ value, onChange, options, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex h-9 items-center rounded-lg border border-line bg-panel p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'h-full rounded-md px-3 text-sm transition',
            value === o.value ? 'bg-raised font-medium text-fg' : 'text-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function FilterChip({ active, onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm transition',
        active ? 'border-accent/60 bg-accent/10 text-accent' : 'border-line bg-panel text-muted hover:border-faint hover:text-fg',
      )}
    >
      {Icon && <Icon size={14} />}
      {children}
    </button>
  );
}

export function ThemeChip({ theme }) {
  return <span className="truncate rounded-md bg-raised px-1.5 py-0.5 text-[11px] font-medium text-muted">{spaced(theme)}</span>;
}

export function RendererBadge({ renderer }) {
  return (
    <span className="shrink-0 rounded-md border border-line px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
      {rendererLabel(renderer)}
    </span>
  );
}

export function Kbd({ children }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-raised px-1 font-sans text-[11px] font-medium text-muted">
      {children}
    </kbd>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-20 text-center">
      {Icon && (
        <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-raised text-muted">
          <Icon size={22} />
        </div>
      )}
      <div className="text-base font-medium">{title}</div>
      {children && <div className="mt-1 max-w-sm text-sm text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div>
      <div className="skeleton aspect-[4/3] rounded-xl" />
      <div className="skeleton mt-3 h-3.5 w-4/5 rounded" />
      <div className="skeleton mt-2 h-3 w-2/5 rounded" />
    </div>
  );
}

export function SectionTitle({ children, right }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-faint">{children}</h3>
      {right}
    </div>
  );
}
