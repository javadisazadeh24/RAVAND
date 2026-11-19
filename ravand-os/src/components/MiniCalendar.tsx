import Link from 'next/link';
import { MONTHS, faNum, isoToDate, jalaliMonthLength, jalaliOf, toGregorian, weekdaySat } from '@/lib/jalali';

export type CalItem = { iso: string; label: string; tone?: 'task' | 'late' | 'remind' | 'project' };
const HEAD = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

export default function MiniCalendar({ jy, jm, items, big, basePath = '/calendar' }: { jy: number; jm: number; items: CalItem[]; big?: boolean; basePath?: string }) {
  const first = toGregorian(jy, jm, 1);
  const offset = weekdaySat(first.gy, first.gm, first.gd);
  const len = jalaliMonthLength(jy, jm);
  const today = jalaliOf(new Date());
  const isToday = (d: number) => today.jy === jy && today.jm === jm && today.jd === d;
  const byIso = new Map<string, CalItem[]>();
  items.forEach((i) => byIso.set(i.iso, [...(byIso.get(i.iso) ?? []), i]));
  const prev = jm === 1 ? { y: jy - 1, m: 12 } : { y: jy, m: jm - 1 };
  const next = jm === 12 ? { y: jy + 1, m: 1 } : { y: jy, m: jm + 1 };
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: len }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  return (
    <div className={big ? 'cal big' : 'cal'}>
      <div className="cal-head">
        <Link href={`${basePath}?y=${next.y}&m=${next.m}`} aria-label="ماه بعد">‹</Link>
        <strong>{MONTHS[jm - 1]} {faNum(jy)}</strong>
        <Link href={`${basePath}?y=${prev.y}&m=${prev.m}`} aria-label="ماه قبل">›</Link>
      </div>
      <div className="cal-grid">
        {HEAD.map((h) => <div key={h} className="cal-dow">{h}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="cal-cell empty" />;
          const g = toGregorian(jy, jm, d);
          const iso = `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;
          const its = byIso.get(iso) ?? [];
          const friday = (offset + d - 1) % 7 === 6;
          return (
            <div key={i} className={`cal-cell${isToday(d) ? ' today' : ''}${friday ? ' fri' : ''}`}>
              <span className="cal-d">{faNum(d)}</span>
              {big
                ? its.slice(0, 3).map((it, k) => <span key={k} className={`cal-item ${it.tone ?? 'task'}`} title={it.label}>{it.label}</span>)
                : its.length > 0 && <span className="cal-dot" title={its.map((x) => x.label).join('\n')} />}
              {big && its.length > 3 && <span className="cal-more">+{faNum(its.length - 3)}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
export { isoToDate };
