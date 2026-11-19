'use client';
import { useEffect, useState } from 'react';
import { faNum, formatJalali, WEEKDAYS_SAT, weekdaySat, tehranParts } from '@/lib/jalali';

export default function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return <div className="clock" aria-hidden />;
  const { gy, gm, gd } = tehranParts(now);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(now);
  return (
    <div className="clock" title="به وقت تهران">
      <span className="clock-time">{faNum(time)}</span>
      <span className="clock-date">{WEEKDAYS_SAT[weekdaySat(gy, gm, gd)]}، {formatJalali(now)}</span>
    </div>
  );
}
