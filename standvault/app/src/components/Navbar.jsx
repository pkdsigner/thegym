import { useEffect, useRef, useState } from 'react';
import { ClipboardCheck, HeartPulse, Keyboard, LayoutGrid, ListChecks, Moon, Settings, Shapes, Sun } from 'lucide-react';
import { IconButton, Kbd, cx } from './ui.jsx';
import { useStore } from '../state/store.jsx';

export function Logo() {
  return (
    <a href="#/library" className="flex items-center gap-2.5" aria-label="StandVault home">
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <path d="M16 3.5 27.5 10v12L16 28.5 4.5 22V10z" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M4.5 10 16 16.5 27.5 10M16 16.5v12" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M16 3.5 27.5 10 16 16.5 4.5 10z" fill="var(--accent)" fillOpacity=".25" />
      </svg>
      <span className="text-[17px] font-semibold tracking-tight">
        Stand<span className="text-accent">Vault</span>
      </span>
    </a>
  );
}

const LINKS = [
  { route: 'library', label: 'Library', icon: LayoutGrid },
  { route: 'sort', label: 'Quick sort', icon: Shapes },
  { route: 'review', label: 'Daily review', icon: ClipboardCheck },
  { route: 'shortlists', label: 'Shortlists', icon: ListChecks },
  { route: 'health', label: 'Health Check', icon: HeartPulse },
  { route: 'settings', label: 'Settings', icon: Settings },
];

export default function Navbar({ route }) {
  const { stats, shortlists } = useStore();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));

  const toggleTheme = () => {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('sv.theme', next ? 'dark' : 'light');
    } catch {}
    setDark(next);
  };

  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1800px] items-center gap-6 px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1 overflow-x-auto">
          {LINKS.map(({ route: r, label, icon: Icon }) => (
            <a
              key={r}
              href={`#/${r}`}
              aria-current={route === r ? 'page' : undefined}
              className={cx(
                'flex h-8 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm transition',
                route === r ? 'bg-raised font-medium text-fg' : 'text-muted hover:text-fg',
              )}
            >
              <Icon size={15} />
              <span className="hidden md:inline">{label}</span>
              {r === 'sort' && stats?.unsorted > 0 && <Count accent>{stats.unsorted.toLocaleString('en-GB')}</Count>}
              {r === 'review' && stats?.unreviewed > 0 && <Count>{stats.unreviewed.toLocaleString('en-GB')}</Count>}
              {r === 'shortlists' && shortlists.length > 0 && <Count>{shortlists.length}</Count>}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <Shortcuts />
          <IconButton icon={dark ? Sun : Moon} label={dark ? 'Light mode' : 'Dark mode'} onClick={toggleTheme} />
        </div>
      </div>
    </header>
  );
}

function Count({ children, accent }) {
  return (
    <span className={cx('rounded-full px-1.5 text-[11px] font-semibold leading-5', accent ? 'bg-accent/15 text-accent' : 'bg-raised text-muted')}>
      {children}
    </span>
  );
}

function Shortcuts() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <IconButton icon={Keyboard} label="Keyboard shortcuts" onClick={() => setOpen((o) => !o)} active={open} />
      {open && (
        <div className="animate-fade-up absolute right-0 top-10 w-64 rounded-xl border border-line bg-panel p-3 text-sm shadow-lift">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">Shortcuts</div>
          {[
            [['/'], 'Search'],
            [['←', '→', '↑', '↓'], 'Move through the grid'],
            [['Enter'], 'Open the selected stand'],
            [['F'], 'Favourite the selected stand'],
            [['Esc'], 'Close the panel'],
            [['1', '–', '7'], 'Quick sort: set category'],
            [['N'], 'Quick sort: not a project'],
            [['Enter'], 'Quick sort: save the page'],
            [['Enter'], 'Review: approve'],
            [['Alt', 'N'], 'Review: not a stand'],
            [['Alt', 'S'], 'Review: skip'],
          ].map(([keys, what]) => (
            <div key={what} className="flex items-center justify-between py-1">
              <span className="text-muted">{what}</span>
              <span className="flex gap-1">
                {keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
