// The review form for one stand: project type, size (or setting, for events), show, year, venue, client,
// open sides, classification labels, tags, notes. Events get their own setting and labels.
// The Asset ID it would get is checked live against the naming rules (by the server, with the shared rules).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CircleAlert, CircleCheck, Ban, SkipForward, TriangleAlert, Undo2 } from 'lucide-react';
import TagInput from './TagInput.jsx';
import { Button, Segmented, Select, cx } from './ui.jsx';
import { api } from '../lib/api.js';
import { spaced } from '../lib/naming.js';
import { useStore } from '../state/store.jsx';
import { useToast } from '../state/toast.jsx';

const STAND_GROUPS = [
  { kind: 'style', title: 'Style', list: 'styles' },
  { kind: 'spatial', title: 'Spatial', list: 'spatialFeatures' },
  { kind: 'functional', title: 'Functional', list: 'zoneTypes' },
  { kind: 'look', title: 'Look & feel', list: 'lookAndFeel' },
];
// Events are classified differently: what kind of event, and what it was made of.
const EVENT_GROUPS = [
  { kind: 'eventCategory', title: 'Event type', list: 'eventCategories' },
  { kind: 'eventElement', title: 'Elements', list: 'eventElements' },
  { kind: 'style', title: 'Style', list: 'styles' },
  { kind: 'look', title: 'Look & feel', list: 'lookAndFeel' },
];
const SETTING_LABELS = { Indoor: 'Indoor', Outdoor: 'Outdoor', IndoorOutdoor: 'Indoor & outdoor' };

const fieldsOf = (s) => ({
  project_type: s.project_type ?? 'ExhibitionStand',
  width: s.width ?? '',
  depth: s.depth ?? '',
  show: s.show ?? '',
  year: s.year ?? '',
  client: s.client ?? '',
  open_sides: s.open_sides ?? '',
  venue: s.venue ?? '',
  setting: s.setting ?? '',
  labels: { style: [], spatial: [], functional: [], look: [], eventCategory: [], eventElement: [], ...s.labels },
  tags: s.tags ?? [],
  notes: s.notes ?? '',
});

export default function StandEditor({ stand, onSaved, review = false, onNext }) {
  const { taxonomy, stats, standChanged } = useStore();
  const toast = useToast();
  const [form, setForm] = useState(() => fieldsOf(stand));
  const [check, setCheck] = useState(null);
  const [busy, setBusy] = useState(false);
  const initial = useMemo(() => fieldsOf(stand), [stand]);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const widthRef = useRef(null);

  useEffect(() => setForm(fieldsOf(stand)), [stand]);

  // Live name check, a moment after typing stops.
  useEffect(() => {
    const t = setTimeout(() => {
      api
        .checkName(stand.id, {
          width: Number(form.width) || null,
          depth: Number(form.depth) || null,
          show: form.show || null,
          year: Number(form.year) || null,
          client: form.client || null,
          project_type: form.project_type,
          setting: form.setting || null,
        })
        .then(setCheck)
        .catch(() => setCheck(null));
    }, 250);
    return () => clearTimeout(t);
  }, [stand.id, form.width, form.depth, form.show, form.year, form.client, form.project_type, form.setting]);

  useEffect(() => {
    if (review) widthRef.current?.focus();
  }, [review, stand.id]);

  const payload = () => ({
    project_type: form.project_type,
    labels: form.labels,
    width: form.width === '' ? null : Number(form.width),
    depth: form.depth === '' ? null : Number(form.depth),
    show: form.show.trim() || null,
    year: form.year === '' ? null : Number(form.year),
    client: form.client.trim() || null,
    open_sides: form.open_sides || null,
    venue: form.venue.trim() || null,
    setting: form.setting || null,
    tags: form.tags,
    notes: form.notes,
  });

  const save = async (extra = {}, message) => {
    setBusy(true);
    try {
      const updated = await api.updateStand(stand.id, { ...payload(), ...extra });
      standChanged();
      onSaved?.(updated);
      if (message) toast(message(updated));
      return updated;
    } catch (e) {
      toast(e.message, { tone: 'info' });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    const done = await save({ status: 'approved' }, (u) => `Approved as ${u.asset_id}`);
    if (done) onNext?.();
  };
  const notStand = async () => {
    const done = await save({ status: 'not_stand' }, () => 'Marked as not a stand');
    if (done) onNext?.();
  };
  const skip = async () => {
    const done = await save({ skip: true });
    if (done) onNext?.();
  };

  // Review shortcuts: Enter approves (from any field but notes), Alt+N not a stand, Alt+S skip.
  const onKeyDown = (e) => {
    if (!review) return;
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && !e.target.dataset.tagInput) {
      e.preventDefault();
      if (check?.valid && !busy) approve();
    } else if (e.altKey && (e.key === 'n' || e.key === 'N')) {
      e.preventDefault();
      notStand();
    } else if (e.altKey && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      skip();
    }
  };

  const approved = stand.status === 'approved';
  const scanSize = stand.scan_width && stand.scan_depth ? `${stand.scan_width} × ${stand.scan_depth}` : null;

  const type = taxonomy?.projectTypes.find((t) => t.code === form.project_type);
  const isEvent = form.project_type === 'Event';
  const groups = isEvent ? EVENT_GROUPS : STAND_GROUPS;
  // Venues already used in the library first, then the common ones.
  const venueOptions = [...new Set([...(stats?.venues ?? []).map((v) => v.venue), ...(taxonomy?.venues ?? [])])];

  return (
    <div onKeyDown={onKeyDown}>
      <Field label="Project type">
        <Select
          value={form.project_type}
          onChange={set('project_type')}
          label="Project type"
          className="w-full"
          options={(taxonomy?.projectTypes ?? []).map((t) => ({ value: t.code, label: t.label }))}
        />
      </Field>

      {isEvent && (
        <div className="mt-3">
          <Field label="Setting">
            <Segmented
              value={form.setting}
              onChange={set('setting')}
              label="Setting"
              options={[{ value: '', label: '?' }, ...(taxonomy?.settings ?? []).map((s) => ({ value: s, label: SETTING_LABELS[s] ?? spaced(s) }))]}
            />
          </Field>
        </div>
      )}

      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <Field label={isEvent ? 'Width (m) · optional' : 'Width (m)'}>
          <input
            ref={widthRef}
            type="number"
            min="1"
            max="200"
            step="0.5"
            value={form.width}
            onChange={(e) => set('width')(e.target.value)}
            aria-label="Width in metres"
            className={inputCls}
          />
        </Field>
        <span className="pb-2 text-muted">×</span>
        <Field label={isEvent ? 'Depth (m) · optional' : 'Depth (m)'}>
          <input
            type="number"
            min="1"
            max="200"
            step="0.5"
            value={form.depth}
            onChange={(e) => set('depth')(e.target.value)}
            aria-label="Depth in metres"
            className={inputCls}
          />
        </Field>
      </div>
      {scanSize && stand.size_source !== 'user' && (
        <div className="mt-1 text-[11px] text-faint">
          Read from the name “{stand.scan_size_text}” - check it against the plan.
        </div>
      )}

      <div className="mt-3 grid grid-cols-[1fr_96px] gap-2">
        <Field label={isEvent ? 'Event / occasion' : type?.nameWord ? 'Show (optional)' : 'Show'}>
          <input
            list="sv-shows"
            value={form.show}
            onChange={(e) => set('show')(e.target.value)}
            placeholder={isEvent ? 'e.g. UAE National Day' : type?.nameWord ? `empty = “${type.nameWord}” in the name` : 'e.g. GITEX'}
            aria-label="Show"
            className={inputCls}
          />
          <datalist id="sv-shows">
            {taxonomy?.shows.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        <Field label="Year">
          <input type="number" min="1990" max="2100" value={form.year} onChange={(e) => set('year')(e.target.value)} aria-label="Year" className={inputCls} />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Venue / location">
          <input list="sv-venues" value={form.venue} onChange={(e) => set('venue')(e.target.value)} placeholder="e.g. DWTC, ADNEC, Dubai Mall" aria-label="Venue" className={inputCls} />
          <datalist id="sv-venues">
            {venueOptions.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Client">
          <input value={form.client} onChange={(e) => set('client')(e.target.value)} placeholder="e.g. DEWA" aria-label="Client" className={inputCls} />
        </Field>
      </div>

      {!isEvent && (
        <div className="mt-3">
          <Field label="Open sides">
            <Segmented
              value={form.open_sides}
              onChange={set('open_sides')}
              label="Open sides"
              options={[{ value: '', label: '?' }, ...(taxonomy?.openSides ?? []).map((o) => ({ value: o, label: o }))]}
            />
          </Field>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-line p-3">
        <div className="mb-2 text-xs text-faint">Classification · optional, click what fits</div>
        {groups.map((g) => (
          <ChipRow
            key={g.kind}
            title={g.title}
            options={taxonomy?.[g.list] ?? []}
            selected={form.labels[g.kind]}
            onChange={(values) => setForm((f) => ({ ...f, labels: { ...f.labels, [g.kind]: values } }))}
          />
        ))}
      </div>
      <div className="mt-3">
        <Field label="Other tags">
          <TagInput tags={form.tags} onChange={set('tags')} />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Notes">
          <textarea
            value={form.notes}
            onChange={(e) => set('notes')(e.target.value)}
            rows={2}
            placeholder="Anything worth remembering about this stand"
            className="w-full resize-y rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-accent"
          />
        </Field>
      </div>

      <NameCheck check={check} approved={approved} assetId={stand.asset_id} />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {review ? (
          <>
            <Button variant="primary" icon={CircleCheck} onClick={approve} disabled={busy || !check?.valid} title="Enter">
              Approve
            </Button>
            <Button icon={Ban} onClick={notStand} disabled={busy} title="Alt+N">
              Not a stand
            </Button>
            <Button variant="ghost" icon={SkipForward} onClick={skip} disabled={busy} title="Alt+S">
              Skip
            </Button>
            <span className="ml-auto hidden text-[11px] text-faint xl:inline">Enter approve · Alt+N not a stand · Alt+S skip</span>
          </>
        ) : (
          <>
            {!approved && stand.status !== 'not_stand' && (
              <Button variant="primary" icon={CircleCheck} onClick={approve} disabled={busy || !check?.valid}>
                Approve
              </Button>
            )}
            <Button variant={approved ? 'primary' : 'secondary'} icon={Check} onClick={() => save({}, () => 'Saved')} disabled={busy || !dirty}>
              Save
            </Button>
            {dirty && (
              <Button variant="ghost" onClick={() => setForm(initial)}>
                Discard
              </Button>
            )}
            <span className="ml-auto" />
            {stand.status === 'unreviewed' ? (
              <Button variant="ghost" icon={Ban} onClick={notStand} disabled={busy}>
                Not a stand
              </Button>
            ) : (
              <Button variant="ghost" icon={Undo2} onClick={() => save({ status: 'unreviewed' }, () => 'Back in the review queue')} disabled={busy}>
                Back to review
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function NameCheck({ check, approved, assetId }) {
  if (!check) return <div className="mt-4 h-[42px] rounded-lg bg-raised/50" />;
  const id = approved ? (check.id ?? assetId) : check.id?.replace(/_\d{4}$/, '_####');
  return (
    <div className={cx('mt-4 rounded-lg border px-3 py-2.5 text-xs', check.valid ? 'border-line bg-raised/60' : 'border-danger/40 bg-danger/5')}>
      <div className="flex items-center gap-2">
        {check.valid ? <Check size={14} className="text-accent" /> : <CircleAlert size={14} className="text-danger" />}
        <span className="font-medium text-fg">{id || 'Not enough details for a name yet'}</span>
        {!approved && check.valid && <span className="text-faint">number given when approved</span>}
      </div>
      {check.errors?.map((m) => (
        <div key={m} className="mt-1.5 text-danger">
          {m}
        </div>
      ))}
      {check.warnings?.map((m) => (
        <div key={m} className="mt-1.5 flex gap-2 text-muted">
          <TriangleAlert size={12} className="mt-0.5 shrink-0" />
          <span>{m}</span>
        </div>
      ))}
    </div>
  );
}

function ChipRow({ title, options, selected, onChange }) {
  const toggle = (v) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  return (
    <div className="mt-1.5 flex gap-2 first-of-type:mt-0">
      <span className="w-20 shrink-0 pt-1 text-[11px] text-muted">{title}</span>
      <div className="flex flex-wrap gap-1">
        {options.map((v) => {
          const on = selected.includes(v);
          return (
            <button
              key={v}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(v)}
              className={cx(
                'rounded-md border px-1.5 py-0.5 text-[11.5px] transition',
                on ? 'border-accent/60 bg-accent/15 text-accent' : 'border-line text-muted hover:border-faint hover:text-fg',
              )}
            >
              {spaced(v)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const inputCls ='h-9 w-full rounded-lg border border-line bg-panel px-3 text-sm outline-none placeholder:text-faint focus:border-accent';

function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <span className="mb-1 block text-xs text-faint">{label}</span>
      {children}
    </div>
  );
}
