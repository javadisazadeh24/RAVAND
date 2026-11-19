import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { isManager, taskScope, projectScope } from '@/lib/perm';
import { OPEN, calendarItems } from '@/lib/data';
import { computeHealth, projectProgress } from '@/lib/health';
import { HEALTH, PROJECT_STATUS, REPORT_TYPE } from '@/lib/labels';
import { faNum, formatJalali, formatJalaliShort, jalaliOf, startOfTehranDay, dateToIso, isoToDate } from '@/lib/jalali';
import MiniCalendar from '@/components/MiniCalendar';
import TaskRow, { taskInclude } from '@/components/TaskRow';
import { markNotificationsRead } from '../actions';

const stat = (n: number, label: string, tone = '') => <div className={`stat ${tone}`}><b className="num">{faNum(n)}</b><span>{label}</span></div>;

export default async function Dashboard() {
  const u = await requireUser();
  const mgr = isManager(u);
  const now = new Date();
  const today0 = startOfTehranDay(now);
  const tomorrow0 = new Date(today0.getTime() + 86400000);
  const in7 = new Date(today0.getTime() + 7 * 86400000);
  const j = jalaliOf(now);
  const [cal, reminders, notes] = await Promise.all([
    calendarItems(u, j.jy, j.jm),
    prisma.reminder.findMany({ where: { userId: u.id, doneAt: null }, orderBy: { remindAt: 'asc' }, take: 5 }),
    prisma.notification.findMany({ where: { userId: u.id, readAt: null }, orderBy: { createdAt: 'desc' }, take: 6 }),
  ]);

  const side = (
    <div>
      <div className="panel">
        <div className="muted sm">امروز</div>
        <h2 style={{ fontSize: 17, marginBottom: 10 }}>{formatJalali(now)}</h2>
        <MiniCalendar jy={j.jy} jm={j.jm} items={cal} />
      </div>
      <div className="panel">
        <h3>یادآورهای پیش‌رو</h3>
        {reminders.length ? reminders.map((r) => <div className="row sm" key={r.id}><span className="grow">{r.title}</span><span className="muted num">{formatJalaliShort(r.remindAt)}</span></div>) : <div className="empty-note">یادآوری ثبت نشده. <Link href="/reminders">افزودن</Link></div>}
      </div>
      {notes.length > 0 && <div className="panel">
        <h3>اعلان‌ها</h3>
        {notes.map((n) => <div className="row sm" key={n.id}><Link className="grow" href={n.link ?? '/'}>{n.message}</Link></div>)}
        <form action={markNotificationsRead}><button className="btn ghost sm">علامت‌گذاری همه به‌عنوان خوانده‌شده</button></form>
      </div>}
    </div>
  );

  if (!mgr) {
    const base = taskScope(u);
    const mine = { ...base, assigneeId: u.id };
    const [todayT, overdue, upcoming, blocked, doing, projects, lastReport, dailyToday] = await Promise.all([
      prisma.task.findMany({ where: { ...mine, status: { in: [...OPEN] }, deadline: { gte: today0, lt: tomorrow0 } }, include: taskInclude }),
      prisma.task.findMany({ where: { ...mine, status: { in: [...OPEN] }, deadline: { lt: today0 } }, include: taskInclude, orderBy: { deadline: 'asc' } }),
      prisma.task.findMany({ where: { ...mine, status: { in: [...OPEN] }, deadline: { gte: tomorrow0, lt: in7 } }, include: taskInclude, orderBy: { deadline: 'asc' } }),
      prisma.task.findMany({ where: { ...mine, status: 'BLOCKED' }, include: taskInclude }),
      prisma.task.findMany({ where: { ...mine, status: 'IN_PROGRESS' }, include: taskInclude, take: 8 }),
      prisma.project.findMany({ where: { ...projectScope(u), status: { notIn: ['COMPLETED', 'ARCHIVED'] } }, take: 6, orderBy: { deadline: 'asc' } }),
      prisma.report.findFirst({ where: { authorId: u.id }, orderBy: { createdAt: 'desc' } }),
      prisma.report.findFirst({ where: { authorId: u.id, type: 'DAILY', periodStart: isoToDate(dateToIso(now)) } }),
    ]);
    const list = (title: string, ts: typeof todayT, empty: string) => (
      <div className="panel"><h2>{title} {ts.length > 0 && <span className="muted">({faNum(ts.length)})</span>}</h2>
        {ts.length ? ts.map((t) => <TaskRow key={t.id} t={t} today0={today0} mgr={false} me={u.id} compact />) : <div className="empty-note">{empty}</div>}</div>
    );
    return (
      <>
        <div className="page-head"><div><h1>سلام {u.name}</h1><div className="muted">برنامه‌ی امروز شما</div></div><Link className="btn" href="/tasks">همه‌ی وظایف من</Link></div>
        <div className="grid g2">
          <div>
            {!dailyToday && <div className="panel" style={{ borderRight: '4px solid var(--khaki-500)' }}>گزارش روزانه‌ی امروز هنوز ثبت نشده. <Link href="/reports">ثبت گزارش</Link></div>}
            {list('مهلت امروز', todayT, 'امروز مهلتی ندارید.')}
            {overdue.length > 0 && list('دیرکرد', overdue, '')}
            {list('هفته‌ی پیش‌رو', upcoming, 'تا یک هفته‌ی آینده مهلتی ندارید.')}
            {blocked.length > 0 && list('موانع من', blocked, '')}
            {list('در حال انجام', doing, 'وظیفه‌ی در حال انجامی نیست.')}
            <div className="panel"><h2>پروژه‌های من</h2>
              {projects.length ? projects.map((p) => <div className="row" key={p.id}><Link className="grow" href={`/projects/${p.id}`}>{p.title}</Link><span className="badge">{PROJECT_STATUS[p.status]}</span><span className="muted sm num">{formatJalaliShort(p.deadline)}</span></div>) : <div className="empty-note">پروژه‌ای به شما نسبت داده نشده.</div>}
            </div>
            {lastReport && <div className="panel sm">آخرین گزارش: {REPORT_TYPE[lastReport.type]} — {formatJalaliShort(lastReport.periodStart)} <Link href="/reports">مشاهده</Link></div>}
          </div>
          {side}
        </div>
      </>
    );
  }

  // ----- management view -----
  const live = { deletedAt: null, status: { in: [...OPEN] } };
  const [openN, overdue, blocked, unowned, pendingReports, projects, byAssignee, overdueBy, users, upcoming, projCounts] = await Promise.all([
    prisma.task.count({ where: live }),
    prisma.task.findMany({ where: { ...live, deadline: { lt: today0 } }, include: taskInclude, orderBy: { deadline: 'asc' }, take: 8 }),
    prisma.task.findMany({ where: { deletedAt: null, status: 'BLOCKED' }, include: taskInclude, take: 6 }),
    prisma.task.findMany({ where: { ...live, assigneeId: null }, include: taskInclude, take: 6 }),
    prisma.report.findMany({ where: { state: 'SUBMITTED' }, include: { author: { select: { name: true } } }, orderBy: { submittedAt: 'desc' }, take: 6 }),
    prisma.project.findMany({ where: { deletedAt: null, status: { notIn: ['COMPLETED', 'ARCHIVED'] } }, include: { tasks: { select: { status: true, deadline: true, deletedAt: true } } } }),
    prisma.task.groupBy({ by: ['assigneeId'], where: { ...live, assigneeId: { not: null } }, _count: true }),
    prisma.task.groupBy({ by: ['assigneeId'], where: { ...live, assigneeId: { not: null }, deadline: { lt: today0 } }, _count: true }),
    prisma.user.findMany({ where: { active: true, deletedAt: null }, select: { id: true, name: true, role: true }, orderBy: { name: 'asc' } }),
    prisma.task.findMany({ where: { ...live, deadline: { gte: today0, lt: in7 } }, include: taskInclude, orderBy: { deadline: 'asc' }, take: 8 }),
    prisma.project.groupBy({ by: ['status'], where: { deletedAt: null }, _count: true }),
  ]);
  const unhealthy = projects.map((p) => ({ p, h: computeHealth(p, now) })).filter((x) => x.h.health !== 'HEALTHY').slice(0, 6);
  const count = (m: { assigneeId: string | null; _count: number }[], id: string) => m.find((x) => x.assigneeId === id)?._count ?? 0;
  const attention = overdue.length + blocked.length + unowned.length + pendingReports.length + unhealthy.length;
  return (
    <>
      <div className="page-head"><div><h1>کنترل مدیریت</h1><div className="muted">{faNum(attention)} مورد نیازمند توجه</div></div>
        <div style={{ display: 'flex', gap: 8 }}><Link className="btn ghost" href="/projects">پروژه جدید</Link><Link className="btn" href="/tasks">وظیفه جدید</Link></div></div>
      <div className="grid g6" style={{ marginBottom: 14 }}>
        {stat(projects.length, 'پروژه‌ی جاری', 'ok')}
        {stat(openN, 'وظیفه‌ی باز')}
        {stat(overdue.length, 'دیرکرد', overdue.length ? 'bad' : '')}
        {stat(blocked.length, 'مسدود', blocked.length ? 'bad' : '')}
        {stat(unowned.length, 'بدون مسئول', unowned.length ? 'warn' : '')}
        {stat(pendingReports.length, 'گزارش در انتظار بررسی', pendingReports.length ? 'accent' : '')}
      </div>
      <div className="grid g2">
        <div>
          <div className="panel"><h2>نیازمند توجه</h2>
            {attention === 0 && <div className="empty-note">مورد فوری وجود ندارد.</div>}
            {overdue.map((t) => <TaskRow key={t.id} t={t} today0={today0} mgr me={u.id} compact />)}
            {blocked.map((t) => <TaskRow key={t.id} t={t} today0={today0} mgr me={u.id} compact />)}
            {unowned.map((t) => <TaskRow key={t.id} t={t} today0={today0} mgr me={u.id} compact />)}
            {pendingReports.map((r) => <div className="row" key={r.id}><span className="grow">گزارش {REPORT_TYPE[r.type]} از {r.author.name}</span><Link className="btn ghost sm" href="/reports">بررسی</Link></div>)}
            {unhealthy.map(({ p, h }) => <div className="row" key={p.id}><Link className="grow" href={`/projects/${p.id}`}>{p.title}</Link><span className="muted sm">{h.reasons.join('، ')}</span><span className={`badge b-${h.health}`}>{HEALTH[h.health]}</span></div>)}
          </div>
          <div className="panel"><h2>بار کاری تیم</h2>
            <table><thead><tr><th>نفر</th><th>وظیفه‌ی باز</th><th>دیرکرد</th></tr></thead><tbody>
              {users.map((p) => <tr key={p.id}><td>{p.name}</td><td className="num">{faNum(count(byAssignee, p.id))}</td><td className={`num ${count(overdueBy, p.id) ? 'late' : ''}`}>{faNum(count(overdueBy, p.id))}</td></tr>)}
            </tbody></table>
          </div>
          <div className="panel"><h2>مهلت‌های ۷ روز آینده</h2>
            {upcoming.length ? upcoming.map((t) => <TaskRow key={t.id} t={t} today0={today0} mgr me={u.id} compact />) : <div className="empty-note">مهلتی در هفته‌ی پیش‌رو نیست.</div>}
          </div>
          <div className="panel"><h2>پروژه‌ها بر اساس وضعیت</h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{projCounts.map((c) => <Link key={c.status} className="badge" href="/projects">{PROJECT_STATUS[c.status]}: {faNum(c._count)}</Link>)}{!projCounts.length && <span className="empty-note">هنوز پروژه‌ای ثبت نشده.</span>}</div>
          </div>
        </div>
        {side}
      </div>
    </>
  );
}
