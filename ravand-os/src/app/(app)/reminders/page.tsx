import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { faNum, formatJalali, formatTime } from '@/lib/jalali';
import JalaliDateInput from '@/components/JalaliDateInput';
import { createReminder, deleteReminder, doneReminder } from '../actions';

export default async function Reminders() {
  const u = await requireUser();
  const all = await prisma.reminder.findMany({ where: { userId: u.id }, orderBy: { remindAt: 'asc' }, take: 100 });
  const open = all.filter((r) => !r.doneAt), done = all.filter((r) => r.doneAt).slice(-10);
  return (
    <>
      <div className="page-head"><div><h1>یادآورها</h1><div className="muted">تا وقتی این برنامه در مرورگر باز است، سر وقت اعلان می‌شوند.</div></div></div>
      <form action={createReminder} className="panel form cols">
        <label className="full">چه چیزی را یادآوری کنم؟<input name="title" required /></label>
        <label>تاریخ<JalaliDateInput name="date" required /></label>
        <label>ساعت<input name="time" type="time" defaultValue="09:00" dir="ltr" /></label>
        <div><button className="btn">افزودن یادآور</button></div>
      </form>
      <div className="panel" style={{ marginTop: 14 }}><h2>پیش‌رو ({faNum(open.length)})</h2>
        {open.length ? open.map((r) => (
          <div className="row" key={r.id}>
            <span className="grow">{r.title}{r.notifiedAt && <span className="badge b-HIGH" style={{ marginRight: 8 }}>اعلان شد</span>}</span>
            <span className="muted sm num">{formatJalali(r.remindAt)} — {formatTime(r.remindAt)}</span>
            <form action={doneReminder}><input type="hidden" name="id" value={r.id} /><button className="btn ghost sm">انجام شد</button></form>
            <form action={deleteReminder}><input type="hidden" name="id" value={r.id} /><button className="btn danger sm">حذف</button></form>
          </div>)) : <div className="empty-note">یادآوری ثبت نشده.</div>}
      </div>
      {done.length > 0 && <div className="panel"><h3>انجام‌شده‌های اخیر</h3>{done.map((r) => <div className="row sm muted" key={r.id}><span className="grow">{r.title}</span><span>{formatJalali(r.remindAt)}</span></div>)}</div>}
    </>
  );
}
