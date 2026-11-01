// Daily review: one stand at a time, newest work first. Confirm it is a stand, check its size, show and client,
// pick the good version and cover, then approve (it gets its Asset ID) - or mark it "not a stand", or skip it.
import { useCallback, useEffect, useState } from 'react';
import { CircleCheck, Layers, PartyPopper } from 'lucide-react';
import StandEditor from '../components/StandEditor.jsx';
import { Gallery, StandActions, VersionsList } from '../components/StandParts.jsx';
import { Button, EmptyState, RendererBadge, Select } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { date } from '../lib/format.js';
import { useStore } from '../state/store.jsx';
import { useToast } from '../state/toast.jsx';

export default function Review() {
  const { standChanged, taxonomy, stats } = useStore();
  const toast = useToast();
  const [goal, setGoal] = useState(() => {
    try {
      return Number(localStorage.getItem('sv.dailyGoal')) || 10;
    } catch {
      return 10;
    }
  });
  const [queue, setQueue] = useState(null);
  const [stand, setStand] = useState(null);
  const [keepGoing, setKeepGoing] = useState(false);
  // One category at a time: each has its own questions (stands: size and show; events: setting and occasion).
  const [category, setCategory] = useState(() => {
    try {
      return localStorage.getItem('sv.reviewCategory') ?? 'ExhibitionStand';
    } catch {
      return 'ExhibitionStand';
    }
  });

  const load = useCallback(async () => {
    const q = await api.review(5, category);
    setQueue(q);
    setStand(q.queue[0] ? await api.stand(q.queue[0]) : null);
  }, [category]);

  useEffect(() => {
    try {
      localStorage.setItem('sv.reviewCategory', category);
    } catch {}
  }, [category]);

  useEffect(() => {
    load().catch((e) => toast(e.message, { tone: 'info' }));
  }, [load, toast]);

  useEffect(() => {
    try {
      localStorage.setItem('sv.dailyGoal', String(goal));
    } catch {}
  }, [goal]);

  const patch = async (fields, message) => {
    try {
      setStand(await api.updateStand(stand.id, fields));
      standChanged();
      if (message) toast(message);
    } catch (e) {
      toast(e.message, { tone: 'info' });
    }
  };

  if (!queue) return <div className="skeleton h-[70vh] rounded-2xl" />;
  const done = queue.reviewedToday;
  const goalReached = done >= goal && !keepGoing;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">Daily review</h1>
          <p className="mt-0.5 text-sm text-muted">
            {queue.left.toLocaleString('en-GB')} to review in {category ? taxonomy?.projectTypes.find((t) => t.code === category)?.label ?? category : 'all categories'} · newest work first
            {stats?.unsorted > 0 && (
              <>
                {' · '}
                <a href="#/sort" className="text-accent hover:underline">
                  {stats.unsorted.toLocaleString('en-GB')} not sorted into a category yet
                </a>
              </>
            )}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Select
            value={category}
            onChange={setCategory}
            label="Category"
            options={[...(taxonomy?.projectTypes ?? []).map((t) => ({ value: t.code, label: t.label })), { value: '', label: 'All categories' }]}
          />
          <div className="w-56">
            <div className="flex justify-between text-xs text-muted">
              <span>Today</span>
              <span className="tabular-nums">
                {done} / {goal}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-raised">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.min(100, (done / goal) * 100)}%` }} />
            </div>
          </div>
          <Select
            value={String(goal)}
            onChange={(v) => setGoal(Number(v))}
            label="Daily goal"
            options={[5, 10, 15, 20, 30].map((n) => ({ value: String(n), label: `${n} a day` }))}
          />
        </div>
      </div>

      <div className="mt-6">
        {goalReached ? (
          <EmptyState
            icon={PartyPopper}
            title={`That's today's ${goal} done`}
            action={<Button onClick={() => setKeepGoing(true)}>Review a few more</Button>}
          >
            {queue.left.toLocaleString('en-GB')} left. At {goal} a day that's about {Math.ceil(queue.left / goal)} more days.
          </EmptyState>
        ) : !stand ? (
          <EmptyState icon={CircleCheck} title="Everything is reviewed">
            New stands appear here after the next scan and import.
          </EmptyState>
        ) : (
          <div key={stand.id} className="animate-fade-up grid gap-8 xl:grid-cols-[minmax(0,1.5fr)_minmax(380px,1fr)]">
            <div className="min-w-0">
              <Gallery stand={stand} tall onCover={(path) => patch({ preview_path: path }, 'Cover picture set')} />
              <div className="mt-6">
                <VersionsList stand={stand} onBest={(fileId) => patch({ best_file_id: fileId })} />
              </div>
            </div>
            <div className="min-w-0">
              <div className="rounded-2xl border border-line bg-panel p-5">
                <div className="text-[11px] font-medium uppercase tracking-wider text-faint">Is this a stand? Check the details</div>
                <h2 className="mt-1 text-lg font-semibold leading-snug tracking-tight">{stand.title}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <RendererBadge renderer={stand.scan_renderer} />
                  <span className="flex items-center gap-1">
                    <Layers size={12} /> {stand.versions.length} versions
                  </span>
                  <span>· last saved {date(stand.scan_last_modified)}</span>
                  {stand.scan_textures_missing > 0 && <span className="text-danger">· {stand.scan_textures_missing} textures missing</span>}
                </div>
                <div className="mt-2 break-all text-[11px] text-faint">{stand.scan_project}</div>
                <div className="mt-4">
                  <StandActions stand={stand} />
                </div>
                <div className="mt-5 border-t border-line pt-5">
                  <StandEditor stand={stand} review onSaved={setStand} onNext={() => load()} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
