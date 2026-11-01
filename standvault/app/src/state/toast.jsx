import { createContext, useCallback, useContext, useState } from 'react';
import { CircleCheck, Info } from 'lucide-react';

const Toasts = createContext(() => {});

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const toast = useCallback((message, { tone = 'ok', detail } = {}) => {
    const id = Math.random().toString(36).slice(2);
    setItems((t) => [...t.slice(-3), { id, message, tone, detail }]);
    // Longer messages (results, warnings) stay up long enough to read.
    setTimeout(() => setItems((t) => t.filter((x) => x.id !== id)), detail && detail.length > 80 ? 9000 : 2800);
  }, []);
  return (
    <Toasts.Provider value={toast}>
      {children}
      <div className="no-print pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-2" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            className="animate-fade-up flex max-w-md items-start gap-2.5 rounded-xl border border-line bg-panel px-4 py-2.5 text-sm shadow-lift"
          >
            {t.tone === 'info' ? <Info size={16} className="mt-0.5 shrink-0 text-muted" /> : <CircleCheck size={16} className="mt-0.5 shrink-0 text-accent" />}
            <div>
              <div className="font-medium">{t.message}</div>
              {t.detail && <div className="mt-0.5 break-all text-xs text-muted">{t.detail}</div>}
            </div>
          </div>
        ))}
      </div>
    </Toasts.Provider>
  );
}

export const useToast = () => useContext(Toasts);
