import { requireUser } from '@/lib/auth';
import { calendarItems } from '@/lib/data';
import { jalaliOf } from '@/lib/jalali';
import MiniCalendar from '@/components/MiniCalendar';

export default async function CalendarPage({ searchParams }: { searchParams: { y?: string; m?: string } }) {
  const u = await requireUser();
  const now = jalaliOf(new Date());
  const jy = Number(searchParams.y) || now.jy;
  const jm = Math.min(12, Math.max(1, Number(searchParams.m) || now.jm));
  const items = await calendarItems(u, jy, jm);
  return (
    <>
      <div className="page-head"><div><h1>تقویم</h1><div className="muted">مهلت وظایف، مهلت پروژه‌ها و یادآورهای شما</div></div></div>
      <div className="panel"><MiniCalendar jy={jy} jm={jm} items={items} big /></div>
      <div className="sm muted" style={{ marginTop: 8 }}>سبز: وظیفه · قرمز: دیرکرد · خاکی: یادآور · آبی: مهلت پروژه</div>
    </>
  );
}
