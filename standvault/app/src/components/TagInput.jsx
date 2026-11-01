import { useState } from 'react';
import { X } from 'lucide-react';

export default function TagInput({ tags, onChange }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const t = draft.trim().toLowerCase();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setDraft('');
  };
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-line bg-panel p-1.5 focus-within:border-accent">
      {tags.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-md bg-raised py-0.5 pl-2 pr-1 text-xs">
          {t}
          <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))} className="rounded text-muted hover:text-fg">
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        data-tag-input="1"
        aria-label="Add a tag"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add();
          } else if (e.key === 'Backspace' && !draft && tags.length) onChange(tags.slice(0, -1));
        }}
        onBlur={add}
        placeholder={tags.length ? '' : 'Add a tag and press Enter'}
        className="min-w-24 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-faint"
      />
    </div>
  );
}
