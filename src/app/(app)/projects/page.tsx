import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { isManager, projectScope } from '@/lib/perm';
import { computeHealth, projectProgress } from '@/lib/health';
import { HEALTH, PRIORITY, PROJECT_STATUS } from '@/lib/labels';
import { faNum, formatJalaliShort } from '@/lib/jalali';
import JalaliDateInput from '@/components/JalaliDateInput';
import { createProject } from '../actions';

export default async function Projects({ searchParams }: { searchParams: { s?: string } }) {
  const u = await requireUser();
  const mgr = isManager(u);
  const s = searchParams.s ?? 'current';
  const statusF = s === 'current' ? { status: { notIn: ['COMPLETED', 'ARCHIVED'] as never[] } } : s === 'all' ? {} : { status: s as never };
  const [projects, cats, people] = await Promise.all([
    prisma.project.findMany({ where: { AND: [projectScope(u), statusF] }, include: { client: true, pm: { select: { name: true } }, category: true, tasks: { select: { status: true, deadline: true, deletedAt: true } } }, orderBy: [{ priority: 'asc' }, { deadline: 'asc' }] }),
    prisma.projectCategory.findMany({ orderBy: { name: 'asc' } }),
    mgr ? prisma.user.findMany({ where: { active: true, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: 'asc' } }) : Promise.resolve([]),
  ]);
  const now = new Date();
  const tabs: [string, string][] = [['current', 'جاری'], ['COMPLETED', 'تکمیل‌شده'], ['ARCHIVED', 'بایگانی'], ['all', 'همه']];
  return (
    <>
      <div className="page-head"><div><h1>پروژه‌ها</h1><div className="muted">{faNum(projects.length)} پروژه</div></div></div>
      {mgr && <details className="panel"><summary>پروژه‌ی جدید</summary>
        <form action={createProject} className="form cols">
          <label className="full">عنوان<input name="title" required /></label>
          <label>مشتری<input name="client" placeholder="نام مشتری یا سازمان" /></label>
          <label>دسته<select name="categoryId"><option value="">—</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>مدیر پروژه<select name="pmId" defaultValue={u.id}><option value="">—</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label>اولویت<select name="priority" defaultValue="MEDIUM">{Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>مهلت<JalaliDateInput name="deadline" /></label>
          {(u.role === 'OWNER' || u.canSeeFinance) && <><label>بودجه‌ی برآوردی (تومان)<input name="estBudget" inputMode="numeric" dir="ltr" /></label><label>درآمد برآوردی (تومان)<input name="estRevenue" inputMode="numeric" dir="ltr" /></label></>}
          <label className="full">اعضای تیم<select name="members" multiple size={Math.min(5, Math.max(2, people.length))}>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label className="full">توضیحات<textarea name="description" /></label>
          <div><button className="btn">ساخت پروژه</button></div>
        </form>
      </details>}
      <div className="filters" style={{ marginTop: 14 }}>{tabs.map(([k, l]) => <Link key={k} href={`/projects?s=${k}`} className={s === k ? 'on' : ''}>{l}</Link>)}</div>
      <div className="panel" style={{ overflowX: 'auto' }}>
        <table><thead><tr><th>کد</th><th>پروژه</th><th>مشتری</th><th>مدیر</th><th>وضعیت</th><th>سلامت</th><th>پیشرفت</th><th>مهلت</th></tr></thead><tbody>
          {projects.map((p) => { const h = computeHealth(p, now); const pr = projectProgress(p); return (
            <tr key={p.id}>
              <td className="num muted">{p.code}</td>
              <td><Link href={`/projects/${p.id}`}><strong>{p.title}</strong></Link><div className="muted sm">{p.category?.name}</div></td>
              <td>{p.client?.name ?? '—'}</td><td>{p.pm?.name ?? '—'}</td>
              <td><span className="badge">{PROJECT_STATUS[p.status]}</span></td>
              <td><span className={`badge b-${h.health}`} title={h.reasons.join('، ')}>{HEALTH[h.health]}</span></td>
              <td><div className="bar"><i style={{ width: `${pr}%` }} /></div><span className="sm muted num">{faNum(pr)}٪</span></td>
              <td className="num">{formatJalaliShort(p.deadline)}</td>
            </tr>); })}
          {!projects.length && <tr><td colSpan={8} className="empty-note">پروژه‌ای نیست.</td></tr>}
        </tbody></table>
      </div>
    </>
  );
}
