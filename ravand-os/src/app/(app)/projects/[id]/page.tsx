import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { canSeeMoney, isManager, projectScope } from '@/lib/perm';
import { computeHealth, projectProgress } from '@/lib/health';
import { HEALTH, PROJECT_STATUS, REPORT_TYPE, REPORT_STATE, PRIORITY } from '@/lib/labels';
import { faNum, formatJalali, formatJalaliShort, startOfTehranDay } from '@/lib/jalali';
import TaskRow, { taskInclude } from '@/components/TaskRow';
import AutoSelect from '@/components/AutoSelect';
import JalaliDateInput from '@/components/JalaliDateInput';
import { archiveProject, createTask, setProjectHealth, setProjectStatus } from '../../actions';

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const u = await requireUser();
  const mgr = isManager(u);
  const p = await prisma.project.findFirst({
    where: { AND: [{ id: params.id }, projectScope(u)] },
    include: { client: true, pm: { select: { name: true } }, category: true, members: { include: { user: { select: { name: true } } } }, tasks: { where: { deletedAt: null }, include: taskInclude, orderBy: [{ status: 'asc' }, { deadline: 'asc' }] }, reports: { include: { author: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 5 } },
  });
  if (!p) notFound();
  const people = mgr ? await prisma.user.findMany({ where: { active: true, deletedAt: null }, select: { id: true, name: true } }) : [];
  const h = computeHealth(p), pr = projectProgress(p), today0 = startOfTehranDay();
  const money = canSeeMoney(u);
  const fmt = (n: bigint | null) => (n == null ? '—' : `${faNum(n.toLocaleString('en-US'))} تومان`);
  return (
    <>
      <div className="page-head"><div><h1>{p.title}</h1><div className="muted num">{p.code} · {p.client?.name ?? 'بدون مشتری'} · {p.category?.name ?? 'بدون دسته'}</div></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className={`badge b-${h.health}`}>{HEALTH[h.health]}</span>
          {mgr ? <form action={setProjectStatus}><input type="hidden" name="id" value={p.id} /><AutoSelect name="status" defaultValue={p.status}>{Object.entries(PROJECT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</AutoSelect></form> : <span className="badge">{PROJECT_STATUS[p.status]}</span>}
        </div></div>
      <div className="grid g2">
        <div>
          <div className="panel"><h2>وظایف ({faNum(p.tasks.length)})</h2>
            {p.tasks.length ? p.tasks.map((t) => <TaskRow key={t.id} t={t} today0={today0} mgr={mgr} me={u.id} people={people} />) : <div className="empty-note">وظیفه‌ای ثبت نشده.</div>}
            <form action={createTask} className="form cols" style={{ marginTop: 12 }}>
              <input type="hidden" name="projectId" value={p.id} />
              <label className="full">وظیفه‌ی جدید در این پروژه<input name="title" required /></label>
              {mgr && <label>مسئول<select name="assigneeId" defaultValue=""><option value="">بدون مسئول</option>{people.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}
              <label>مهلت<JalaliDateInput name="deadline" /></label>
              <div><button className="btn">افزودن</button></div>
            </form>
          </div>
          <div className="panel"><h2>گزارش‌های اخیر</h2>
            {p.reports.length ? p.reports.map((r) => <div className="row sm" key={r.id}><span className="grow">{REPORT_TYPE[r.type]} — {r.author.name}</span><span className="muted">{REPORT_STATE[r.state]} · {formatJalaliShort(r.periodStart)}</span></div>) : <div className="empty-note">گزارشی به این پروژه وصل نشده.</div>}
          </div>
        </div>
        <div>
          <div className="panel"><h2>خلاصه</h2>
            <div className="bar"><i style={{ width: `${pr}%` }} /></div><div className="sm muted">پیشرفت (از وظایف): {faNum(pr)}٪</div>
            <div className="row sm"><span className="grow muted">مدیر پروژه</span>{p.pm?.name ?? '—'}</div>
            <div className="row sm"><span className="grow muted">اولویت</span>{PRIORITY[p.priority]}</div>
            <div className="row sm"><span className="grow muted">مهلت</span>{formatJalali(p.deadline)}</div>
            <div className="row sm"><span className="grow muted">تیم</span>{p.members.map((m) => m.user.name).join('، ') || '—'}</div>
            {money && <><div className="row sm"><span className="grow muted">بودجه‌ی برآوردی</span>{fmt(p.estBudget)}</div><div className="row sm"><span className="grow muted">درآمد برآوردی</span>{fmt(p.estRevenue)}</div></>}
            {p.description && <p className="sm">{p.description}</p>}
          </div>
          <div className="panel"><h3>چرا «{HEALTH[h.health]}»؟</h3><div className="sm">{h.reasons.join('، ')}{h.overridden && ' (تعیین‌شده توسط مدیر)'}</div>
            {mgr && <form action={setProjectHealth} className="form" style={{ marginTop: 10 }}>
              <input type="hidden" name="id" value={p.id} />
              <label>تغییر دستی<select name="health" defaultValue={p.healthOverride ?? ''}><option value="">محاسبه‌ی خودکار</option>{Object.entries(HEALTH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label>دلیل (برای تغییر دستی الزامی است)<input name="reason" defaultValue={p.healthReason ?? ''} /></label>
              <button className="btn ghost sm">ذخیره</button>
            </form>}
          </div>
          {mgr && p.status !== 'ARCHIVED' && <form action={archiveProject}><input type="hidden" name="id" value={p.id} /><button className="btn danger sm">بایگانی پروژه</button></form>}
        </div>
      </div>
    </>
  );
}
