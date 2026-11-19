'use client';
import { useEffect, useState } from 'react';

type Item = { id: string; title: string };
export default function ReminderPoller() {
  const [toasts, setToasts] = useState<Item[]>([]);
  const [perm, setPerm] = useState<string>('granted');
  useEffect(() => {
    if (typeof Notification !== 'undefined') setPerm(Notification.permission);
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch('/api/reminders/due', { cache: 'no-store' });
        if (!r.ok) return;
        const { items } = (await r.json()) as { items: Item[] };
        if (stop || !items.length) return;
        setToasts((t) => [...t, ...items]);
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') items.forEach((i) => new Notification('یادآور راوند', { body: i.title }));
      } catch { /* offline: try again next tick */ }
    };
    tick();
    const t = setInterval(tick, 30_000);
    return () => { stop = true; clearInterval(t); };
  }, []);
  return (
    <>
      {perm === 'default' && <button className="btn ghost sm" onClick={async () => setPerm(await Notification.requestPermission())}>فعال‌سازی اعلان مرورگر</button>}
      <div className="toasts" role="status">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            <span>{t.title}</span>
            <button aria-label="بستن" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>×</button>
          </div>
        ))}
      </div>
    </>
  );
}
