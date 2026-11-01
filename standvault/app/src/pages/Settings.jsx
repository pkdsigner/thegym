import { useEffect, useState } from 'react';
import { FolderOpen, Plus, X } from 'lucide-react';
import { Button, IconButton, SectionTitle } from '../components/ui.jsx';
import { useStore } from '../state/store.jsx';
import { useToast } from '../state/toast.jsx';
import { api } from '../lib/api.js';
import { date } from '../lib/format.js';
import { spaced, toCamel } from '../lib/naming.js';

export default function Settings() {
  const { config, stats, refreshConfig } = useStore();
  const toast = useToast();
  const [folders, setFolders] = useState([]);
  const [folder, setFolder] = useState('');
  useEffect(() => setFolders(config?.scanFolders ?? []), [config]);

  const saveFolders = async (next) => {
    try {
      await api.saveScanFolders(next);
      setFolders(next);
      refreshConfig();
      toast('Scan folders saved', { detail: 'They are used the next time the scan runs.' });
    } catch (e) {
      toast(e.message, { tone: 'info' });
    }
  };

  if (!config) return <div className="skeleton h-96 max-w-4xl rounded-2xl" />;

  return (
    <div className="max-w-4xl">
      <h1 className="text-[22px] font-semibold tracking-tight">Settings</h1>

      <section className="mt-8">
        <SectionTitle>Library</SectionTitle>
        <div className="grid gap-3 rounded-xl border border-line bg-panel p-4 text-sm sm:grid-cols-2">
          <Info label="Library folder">{config.libraryRoot}</Info>
          <Info label="Database">{config.libraryRoot}\db\standvault.db</Info>
          <Info label="Last import">{stats?.lastImport ? date(stats.lastImport) : '–'}</Info>
          <Info label="Last backup">{stats?.lastBackup ?? '–'} (one a day, in db\backups)</Info>
        </div>
      </section>

      <section className="mt-8">
        <SectionTitle>Scan folders</SectionTitle>
        <ul className="overflow-hidden rounded-xl border border-line bg-panel">
          {folders.map((f) => (
            <li key={f} className="flex items-center gap-3 border-b border-line px-4 py-2 text-sm last:border-0">
              <FolderOpen size={15} className="text-faint" />
              <span className="flex-1">{f}</span>
              <IconButton icon={X} label={`Remove ${f}`} onClick={() => saveFolders(folders.filter((x) => x !== f))} />
            </li>
          ))}
        </ul>
        {config.excludeFolders?.length > 0 && <p className="mt-2 text-xs text-faint">Skipped: {config.excludeFolders.join(' · ')}</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (folder.trim()) saveFolders([...folders, folder.trim()]).then(() => setFolder(''));
          }}
          className="mt-2 flex gap-2"
        >
          <input
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            placeholder="e.g. E:\2022"
            aria-label="Folder to scan"
            className="h-9 flex-1 rounded-lg border border-line bg-panel px-3 text-sm outline-none placeholder:text-faint focus:border-accent"
          />
          <Button type="submit" icon={Plus} disabled={!folder.trim()}>
            Add folder
          </Button>
        </form>
      </section>

      <section className="mt-8">
        <SectionTitle>Shows and themes</SectionTitle>
        <p className="-mt-1 mb-4 text-sm text-muted">
          Shows are recognised in file and folder names during the scan, and suggested in the review. New entries are written CamelCase (“middle east energy” becomes MiddleEastEnergy).
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <ListEditor title="Shows" listKey="shows" items={config.taxonomy.shows} />
          <ListEditor title="Themes (search tags)" listKey="themes" items={config.taxonomy.themes} />
        </div>
      </section>
    </div>
  );
}

function Info({ label, children }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-faint">{label}</div>
      <div className="mt-0.5 break-all">{children}</div>
    </div>
  );
}

function ListEditor({ title, listKey, items }) {
  const { refreshConfig } = useStore();
  const toast = useToast();
  const [draft, setDraft] = useState('');
  const add = async (e) => {
    e.preventDefault();
    try {
      const r = await api.addToTaxonomy(listKey, draft);
      toast(`Added ${r.added}`);
      setDraft('');
      refreshConfig();
    } catch (err) {
      toast(err.message, { tone: 'info' });
    }
  };
  return (
    <div className="rounded-xl border border-line bg-panel p-3">
      <div className="mb-2 px-1 text-sm font-medium">
        {title} <span className="text-faint">{items.length}</span>
      </div>
      <div className="flex max-h-60 flex-wrap gap-1.5 overflow-y-auto">
        {items.map((code) => (
          <span key={code} className="rounded-md bg-raised px-2 py-1 text-xs">
            {spaced(code)}
          </span>
        ))}
      </div>
      <form onSubmit={add} className="mt-3 flex gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add…"
          aria-label={`Add to ${title}`}
          className="h-8 min-w-0 flex-1 rounded-md border border-line bg-bg px-2 text-sm outline-none placeholder:text-faint focus:border-accent"
        />
        <Button type="submit" size="sm" icon={Plus} disabled={!toCamel(draft)} aria-label="Add" />
      </form>
    </div>
  );
}
