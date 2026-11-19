'use client';
import { useState } from 'react';
import { MONTHS, faNum, jalaliMonthLength, jalaliOf, toGregorian, toJalali } from '@/lib/jalali';

/** Picks a Jalali date; submits Gregorian "YYYY-MM-DD" in a hidden field named `name`. */
export default function JalaliDateInput({ name, defaultValue, required }: { name: string; defaultValue?: string | null; required?: boolean }) {
  const initial = defaultValue ? (() => { const [y, m, d] = defaultValue.split('-').map(Number); return toJalali(y, m, d); })() : null;
  const thisYear = jalaliOf(new Date()).jy;
  const [y, setY] = useState<number | ''>(initial?.jy ?? '');
  const [m, setM] = useState<number | ''>(initial?.jm ?? '');
  const [d, setD] = useState<number | ''>(initial?.jd ?? '');
  let iso = '';
  if (y && m && d) {
    const dd = Math.min(d, jalaliMonthLength(y, m));
    const g = toGregorian(y, m, dd);
    iso = `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;
  }
  const maxDay = y && m ? jalaliMonthLength(y, m) : 31;
  return (
    <span className="jdate">
      <select value={d} onChange={(e) => setD(e.target.value ? +e.target.value : '')} aria-label="روز" required={required}>
        <option value="">روز</option>
        {Array.from({ length: maxDay }, (_, i) => <option key={i} value={i + 1}>{faNum(i + 1)}</option>)}
      </select>
      <select value={m} onChange={(e) => setM(e.target.value ? +e.target.value : '')} aria-label="ماه" required={required}>
        <option value="">ماه</option>
        {MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
      </select>
      <select value={y} onChange={(e) => setY(e.target.value ? +e.target.value : '')} aria-label="سال" required={required}>
        <option value="">سال</option>
        {Array.from({ length: 9 }, (_, i) => thisYear - 1 + i).map((yy) => <option key={yy} value={yy}>{faNum(yy)}</option>)}
      </select>
      <input type="hidden" name={name} value={iso} />
    </span>
  );
}
